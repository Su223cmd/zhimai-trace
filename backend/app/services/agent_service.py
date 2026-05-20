import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.db_models import AgentMessage, Homework
from app.services.agent_bus import AgentBus

logger = logging.getLogger(__name__)


def _resolve_teacher_id(db: Session, msg: AgentMessage) -> int:
    teacher_id = msg.payload.get("teacher_id")
    if teacher_id:
        return teacher_id
    homework_id = msg.payload.get("homework_id")
    if homework_id:
        hw = db.query(Homework).filter(Homework.id == homework_id).first()
        if hw and hw.project_id:
            from app.models.db_models import Project
            project = db.query(Project).filter(Project.id == hw.project_id).first()
            if project and project.settings and isinstance(project.settings, dict):
                tid = project.settings.get("teacher_id")
                if tid:
                    return tid
    logger.warning("No teacher_id found in message payload or project, defaulting to 1")
    return 1


def _handle_courseware_parsed(db: Session, msg: AgentMessage):
    courseware_id = msg.payload.get("courseware_id")
    if not courseware_id:
        return
    from app.services.knowledge_service import sync_courseware_knowledge, persist_to_db, edc_extract_from_courseware
    from app.models.db_models import Courseware, KnowledgePoint

    courseware = db.query(Courseware).filter(Courseware.id == courseware_id).first()
    if not courseware:
        logger.warning("KnowledgeAgent: courseware %s not found", courseware_id)
        return

    parsed_data = {
        "id": courseware.id,
        "name": courseware.name,
        "knowledge_points": [
            {"code": kp.code, "name": kp.name, "cognitive_level": kp.cognitive_level, "chapter": kp.chapter, "source_type": kp.source_type}
            for kp in db.query(KnowledgePoint).filter(KnowledgePoint.courseware_id == courseware_id).all()
        ],
    }

    sync_courseware_knowledge(parsed_data, db)

    kps = parsed_data.get("knowledge_points", [])
    if kps:
        slides_text = "\n".join([kp.get("name", "") for kp in kps])
        edc_result = edc_extract_from_courseware([{"texts": [slides_text]}])
        if edc_result.get("relations"):
            for rel in edc_result["relations"]:
                from app.services.knowledge_service import add_relation
                add_relation(
                    rel.get("source", ""), rel.get("target", ""),
                    rel.get("relation_type", "RELATES_TO"),
                    confidence=rel.get("confidence", 0.5),
                    discovered_by="edc",
                )

    persist_to_db(db)
    AgentBus.update_agent_state(db, "knowledge", "courseware_synced", {"last_courseware_id": courseware_id})

    AgentBus.send(db, "knowledge", "diagnosis", "graph_updated", {
        "courseware_id": courseware_id,
        "kp_count": len(kps),
    })

    teacher_id = _resolve_teacher_id(db, msg)
    AgentBus.notify_teacher(db, teacher_id, "knowledge_sync", "知识图谱已更新",
                            f"课件「{courseware.name}」已同步到知识图谱，新增{len(kps)}个知识点")


def _handle_curriculum_imported(db: Session, msg: AgentMessage):
    project_id = msg.payload.get("project_id")
    entity_count = msg.payload.get("entity_count", 0)
    relation_count = msg.payload.get("relation_count", 0)

    from app.services.knowledge_service import persist_to_db
    persist_to_db(db)

    AgentBus.update_agent_state(db, "knowledge", "curriculum_imported", {
        "project_id": project_id,
        "entity_count": entity_count,
        "relation_count": relation_count,
    })

    AgentBus.send(db, "knowledge", "diagnosis", "graph_updated", {
        "source": "curriculum",
        "project_id": project_id,
        "entity_count": entity_count,
    })


def _handle_graph_updated(db: Session, msg: AgentMessage):
    AgentBus.update_agent_state(db, "diagnosis", "graph_updated_received", {
        "source": msg.payload.get("source", "unknown"),
    })


def _handle_answer_imported(db: Session, msg: AgentMessage):
    homework_id = msg.payload.get("homework_id")
    student_count = msg.payload.get("student_count", 0)
    if not homework_id:
        return

    from app.services.dina_model import run_cdm_estimation
    try:
        result = run_cdm_estimation(db, homework_id)
        AgentBus.update_agent_state(db, "diagnosis", "cdm_estimated", {
            "homework_id": homework_id,
            "n_students": result.get("n_students", 0),
            "n_kp": result.get("n_knowledge_points", 0),
        })

        AgentBus.send(db, "diagnosis", "tracing", "diagnosis_completed", {
            "homework_id": homework_id,
            "cdm_params_id": result.get("cdm_params_id"),
            "knowledge_state": result.get("knowledge_state"),
            "teacher_id": msg.payload.get("teacher_id"),
        })

        AgentBus.send(db, "diagnosis", "teaching", "diagnosis_completed", {
            "homework_id": homework_id,
            "cdm_params_id": result.get("cdm_params_id"),
            "knowledge_state": result.get("knowledge_state"),
            "teacher_id": msg.payload.get("teacher_id"),
        })

        teacher_id = _resolve_teacher_id(db, msg)
        AgentBus.notify_teacher(db, teacher_id, "diagnosis_complete", "CDM诊断完成",
                                f"作业诊断完成，{student_count}名学生，{result.get('n_knowledge_points', 0)}个知识点")
    except Exception as e:
        logger.error("DiagnosisAgent CDM estimation failed: %s", str(e))
        AgentBus.update_agent_state(db, "diagnosis", "cdm_failed", {"error": str(e)})


def _handle_qmatrix_confirmed(db: Session, msg: AgentMessage):
    homework_id = msg.payload.get("homework_id")
    if not homework_id:
        return
    AgentBus.update_agent_state(db, "diagnosis", "qmatrix_confirmed", {"homework_id": homework_id})


def _handle_diagnosis_completed(db: Session, msg: AgentMessage):
    homework_id = msg.payload.get("homework_id")
    knowledge_state = msg.payload.get("knowledge_state", {})
    if not homework_id:
        return

    from app.services.knowledge_tracing_service import BKTModel
    from app.models.db_models import StudentAnswer, CDMParameter
    import numpy as np

    try:
        mastery_values = list(knowledge_state.values()) if isinstance(knowledge_state, dict) else []
        if not mastery_values:
            return

        n_kp = len(mastery_values)
        bkt = BKTModel(n_kp)
        current_mastery = np.array(mastery_values)

        cdm_params = db.query(CDMParameter).filter(CDMParameter.homework_id == homework_id).first()
        if cdm_params and cdm_params.alpha and cdm_params.alpha.get("alpha_estimates"):
            alpha_history = np.array(cdm_params.alpha["alpha_estimates"])
            observations = (alpha_history > 0.5).astype(int)
        else:
            answers = db.query(StudentAnswer).filter(StudentAnswer.homework_id == homework_id).all()
            if answers:
                correct_count = sum(1 for a in answers if a.is_correct)
                total = len(answers)
                obs_row = np.full(n_kp, 1 if correct_count / max(total, 1) > 0.5 else 0)
                observations = np.tile(obs_row, (min(5, n_kp), 1))
            else:
                logger.warning("No answer data for homework %s, using mastery-based synthetic observations for BKT", homework_id)
                obs_row = (current_mastery > 0.5).astype(int)
                observations = np.tile(obs_row, (3, 1))

        trajectory = bkt.predict(observations)
        learning_rates = bkt.estimate_learning_rate(observations)
        mastery_time = bkt.predict_mastery_time(current_mastery)
        forgetting = bkt.forgetting_curve(current_mastery)

        AgentBus.update_agent_state(db, "tracing", "tracing_completed", {
            "homework_id": homework_id,
            "avg_mastery": float(np.mean(current_mastery)),
            "avg_learning_rate": float(np.mean(learning_rates)),
        })

        AgentBus.send(db, "tracing", "evolution", "tracing_data_available", {
            "homework_id": homework_id,
            "avg_mastery": float(np.mean(current_mastery)),
            "avg_learning_rate": float(np.mean(learning_rates)),
            "mastery_time": mastery_time.tolist(),
            "forgetting_curve": forgetting.tolist(),
            "teacher_id": msg.payload.get("teacher_id"),
        })

    except Exception as e:
        logger.error("TracingAgent failed: %s", str(e))
        AgentBus.update_agent_state(db, "tracing", "tracing_failed", {"error": str(e)})


def _handle_diagnosis_completed_teaching(db: Session, msg: AgentMessage):
    homework_id = msg.payload.get("homework_id")
    knowledge_state = msg.payload.get("knowledge_state", {})
    if not homework_id:
        return

    weak_kps = []
    if isinstance(knowledge_state, dict):
        weak_kps = [{"code": k, "mastery": v} for k, v in knowledge_state.items() if isinstance(v, (int, float)) and v < 0.5]

    teacher_id = _resolve_teacher_id(db, msg)

    if weak_kps:
        from app.services.knowledge_service import get_prerequisite_chain

        for kp_info in weak_kps[:5]:
            try:
                chain = get_prerequisite_chain(kp_info["code"], max_depth=3)
                if chain:
                    deepest = chain[-1] if chain else kp_info
                    AgentBus.notify_teacher(db, teacher_id, "teaching_suggestion", "教学建议",
                                            f"知识点「{deepest.get('name', kp_info['code'])}」掌握率仅{kp_info['mastery']:.0%}，建议优先补强")
            except Exception as e:
                logger.error("TeachingAgent chain error for %s: %s", kp_info.get("code"), str(e))

    AgentBus.update_agent_state(db, "teaching", "suggestions_generated", {
        "homework_id": homework_id,
        "weak_kp_count": len(weak_kps),
    })

    AgentBus.send(db, "teaching", "evolution", "teaching_data_available", {
        "homework_id": homework_id,
        "weak_kp_count": len(weak_kps),
        "teacher_id": msg.payload.get("teacher_id"),
    })


def _handle_tracing_data(db: Session, msg: AgentMessage):
    homework_id = msg.payload.get("homework_id")
    avg_mastery = msg.payload.get("avg_mastery", 0)
    avg_lr = msg.payload.get("avg_learning_rate", 0)

    AgentBus.update_agent_state(db, "evolution", "tracing_received", {
        "homework_id": homework_id,
        "avg_mastery": avg_mastery,
    })

    if avg_mastery < 0.3:
        teacher_id = _resolve_teacher_id(db, msg)
        AgentBus.notify_teacher(db, teacher_id, "mastery_alert", "掌握率预警",
                                f"班级平均掌握率仅{avg_mastery:.0%}，建议调整教学计划")


def _handle_teaching_data(db: Session, msg: AgentMessage):
    homework_id = msg.payload.get("homework_id")
    weak_kp_count = msg.payload.get("weak_kp_count", 0)

    AgentBus.update_agent_state(db, "evolution", "teaching_received", {
        "homework_id": homework_id,
        "weak_kp_count": weak_kp_count,
    })

    try:
        from app.services.online_em_service import get_online_em
        from app.models.db_models import StudentAnswer, CDMParameter
        import numpy as np

        homework = db.query(Homework).filter(Homework.id == homework_id).first()
        if not homework:
            return

        cdm_params = db.query(CDMParameter).filter(CDMParameter.homework_id == homework_id).first()
        if not cdm_params or not cdm_params.q_matrix:
            return

        q_matrix = np.array(cdm_params.q_matrix)
        n_questions, n_kp = q_matrix.shape

        em = get_online_em(homework_id, n_questions, n_kp, q_matrix)

        answers = db.query(StudentAnswer).filter(StudentAnswer.homework_id == homework_id).all()
        student_responses = {}
        for a in answers:
            sid = a.student_id
            if sid not in student_responses:
                student_responses[sid] = {}
            student_responses[sid][str(a.question_id)] = a

        from app.models.db_models import Question
        question_ids = [str(q.id) for q in db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()]

        teacher_id = _resolve_teacher_id(db, msg)

        for sid, resp_map in student_responses.items():
            response = np.zeros(n_questions)
            for j, qid in enumerate(question_ids):
                if qid in resp_map:
                    response[j] = 1 if resp_map[qid].is_correct else 0
            result = em.update_single(response)
            if result.get("significant"):
                AgentBus.notify_teacher(db, teacher_id, "parameter_drift", "CDM参数显著变化",
                                        f"slip变化: {result.get('delta_slip', 0):.3f}, guess变化: {result.get('delta_guess', 0):.3f}")

        AgentBus.update_agent_state(db, "evolution", "online_em_updated", {
            "homework_id": homework_id,
            "update_count": len(answers),
        })

    except Exception as e:
        logger.error("EvolutionAgent online EM failed: %s", str(e))


def _handle_parameter_update(db: Session, msg: AgentMessage):
    delta_slip = msg.payload.get("delta_slip", 0)
    delta_guess = msg.payload.get("delta_guess", 0)

    if abs(delta_slip) > 0.1 or abs(delta_guess) > 0.1:
        AgentBus.send(db, "evolution", "diagnosis", "parameter_drift", {
            "delta_slip": delta_slip,
            "delta_guess": delta_guess,
        })


def register_all_agents():
    AgentBus.register("knowledge", "courseware_parsed", _handle_courseware_parsed)
    AgentBus.register("knowledge", "curriculum_imported", _handle_curriculum_imported)

    AgentBus.register("diagnosis", "graph_updated", _handle_graph_updated)
    AgentBus.register("diagnosis", "answer_imported", _handle_answer_imported)
    AgentBus.register("diagnosis", "qmatrix_confirmed", _handle_qmatrix_confirmed)
    AgentBus.register("diagnosis", "parameter_drift", _handle_parameter_update)

    AgentBus.register("tracing", "diagnosis_completed", _handle_diagnosis_completed)

    AgentBus.register("teaching", "diagnosis_completed", _handle_diagnosis_completed_teaching)

    AgentBus.register("evolution", "tracing_data_available", _handle_tracing_data)
    AgentBus.register("evolution", "teaching_data_available", _handle_teaching_data)

    logger.info("All 5 agents registered with AgentBus")


def get_agent_statuses(db: Session) -> list[dict]:
    return AgentBus.get_all_states(db)


def get_agent_messages(db: Session, agent_name: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> list[dict]:
    return AgentBus.get_messages(db, agent_name, status, limit)


def send_agent_message(db: Session, sender: str, receiver: str, event_type: str, payload: dict) -> dict:
    msg = AgentBus.send(db, sender, receiver, event_type, payload)
    return {
        "id": str(msg.id),
        "sender": msg.sender_agent,
        "receiver": msg.receiver_agent,
        "type": msg.message_type,
        "status": msg.status,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }