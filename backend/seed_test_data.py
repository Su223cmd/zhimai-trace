import sys
import os
import json
import logging
import random
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(__file__))
import app._patch_win32

from app.database import engine, SessionLocal
from app.models.db_models import (
    Base, Project, Homework, Question, StudentAnswer, CDMParameter,
    Courseware, AgentState, AgentEvent, AgentNotification, AgentMessage,
    Diagnosis,
)
from app.services.curriculum_service import create_project, import_curriculum_to_project, _load_geography_curriculum
from app.services.knowledge_service import init_from_curriculum, persist_to_db
from app.services.homework_service import add_questions, import_student_answers
from app.services.qmatrix_service import confirm_q_matrix
from app.services.dina_model import run_cdm_estimation


KP_CODES = [
    "GEO-B1-C01-KP06",  # 0: 黄赤交角
    "GEO-B1-C01-KP07",  # 1: 太阳直射点移动
    "GEO-B1-C02-KP01",  # 2: 大气受热过程
    "GEO-B1-C02-KP02",  # 3: 大气逆辐射
    "GEO-B1-C02-KP03",  # 4: 热力环流
    "GEO-B1-C02-KP04",  # 5: 等值线判读
    "GEO-B1-C02-KP05",  # 6: 气压带风带
    "GEO-B1-C02-KP06",  # 7: 气候类型判断
    "GEO-B1-C03-KP01",  # 8: 水循环
    "GEO-B1-C03-KP02",  # 9: 洋流
    "GEO-B1-C04-KP01",  # 10: 内力作用
    "GEO-B1-C04-KP04",  # 11: 褶皱构造
]

QUESTIONS = [
    {
        "seq": 1,
        "content": "太阳辐射、地面辐射和大气辐射的转换过程中，大气对地面的保温作用主要来自（）\nA. 太阳辐射 B. 大气逆辐射 C. 地面辐射 D. 大气削弱作用",
        "question_type": "choice",
        "score": 5.0,
        "answer": "B",
        "kp_indices": [2, 3],
    },
    {
        "seq": 2,
        "content": "热力环流的形成原理是（）\nA. 水平气压梯度力 B. 地转偏向力 C. 冷热不均引起的大气运动 D. 摩擦力",
        "question_type": "choice",
        "score": 5.0,
        "answer": "C",
        "kp_indices": [4],
    },
    {
        "seq": 3,
        "content": "关于气压带和风带的分布，下列说法正确的是（）\nA. 赤道低气压带盛行下沉气流 B. 副热带高气压带盛行上升气流 C. 中纬西风带由副热带吹向副极地 D. 极地东风带由极地吹向副极地",
        "question_type": "choice",
        "score": 5.0,
        "answer": "C",
        "kp_indices": [5, 6],
    },
    {
        "seq": 4,
        "content": "全球气候类型中，受副热带高压控制形成的是（）\nA. 热带雨林气候 B. 热带沙漠气候 C. 温带海洋性气候 D. 地中海气候",
        "question_type": "choice",
        "score": 5.0,
        "answer": "B",
        "kp_indices": [7],
    },
    {
        "seq": 5,
        "content": "水循环的主要环节包括（）\nA. 蒸发、凝结、降水 B. 蒸发、水汽输送、降水、径流 C. 蒸腾、凝结、渗透 D. 下渗、蒸发、凝结",
        "question_type": "choice",
        "score": 5.0,
        "answer": "B",
        "kp_indices": [8],
    },
    {
        "seq": 6,
        "content": "洋流对地理环境的影响不包括（）\nA. 调节全球热量分布 B. 影响沿岸气候 C. 改变地球自转速度 D. 影响海洋生物分布",
        "question_type": "choice",
        "score": 5.0,
        "answer": "C",
        "kp_indices": [9],
    },
    {
        "seq": 7,
        "content": "地表形态中，褶皱山系的成因是（）\nA. 岩浆活动 B. 内力作用下的岩层弯曲变形 C. 流水侵蚀 D. 风力堆积",
        "question_type": "choice",
        "score": 5.0,
        "answer": "B",
        "kp_indices": [10, 11],
    },
    {
        "seq": 8,
        "content": "黄赤交角的存在导致什么现象？（）\nA. 昼夜长短不变 B. 太阳直射点在南北回归线间移动 C. 地球只有自转 D. 大气层形成",
        "question_type": "choice",
        "score": 5.0,
        "answer": "B",
        "kp_indices": [0, 1],
    },
]

ANSWER_OPTIONS = ["A", "B", "C", "D"]

STUDENT_PROFILES = {
    # (student_id, mastery_bitmap, description)
    # mastery_bitmap: 1=mastered for each KP index
    "S001": ([1,1,1,1,1,1,1,1,1,1,1,1], "优秀-全掌握"),
    "S002": ([1,1,1,1,1,0,1,1,1,1,1,1], "优秀-等值线判读弱"),
    "S003": ([0,1,1,1,1,1,1,1,1,1,1,1], "优秀-黄赤交角弱"),
    "S004": ([1,1,1,1,1,0,0,1,1,1,1,1], "良好-等值线+气压带弱"),
    "S005": ([1,1,1,1,1,1,1,0,1,1,1,0], "良好-气候+褶皱弱"),
    "S006": ([1,1,1,0,0,1,1,1,1,1,1,1], "良好-大气逆辐射+热力环流弱"),
    "S007": ([1,1,1,1,1,1,1,1,0,0,1,1], "良好-水循环+洋流弱"),
    "S008": ([1,1,1,1,1,0,0,0,1,1,1,0], "中等-等值线+气压带+气候+褶皱弱"),
    "S009": ([1,1,0,0,0,0,1,1,1,1,0,0], "中等-大气三要素+等值线+构造弱"),
    "S010": ([0,1,1,1,1,1,0,0,1,1,0,0], "中等-黄赤交角+气压带+气候+构造弱"),
    "S011": ([1,1,1,1,1,0,1,1,0,0,1,1], "中等-等值线+水循环+洋流弱"),
    "S012": ([0,0,1,0,1,0,0,0,1,0,0,0], "较弱-仅大气受热+热力环流+水循环"),
    "S013": ([0,0,1,1,1,0,0,0,1,0,0,0], "较弱-仅大气+热力环流+水循环"),
    "S014": ([1,1,0,0,0,0,0,0,1,1,0,0], "较弱-仅黄赤交角+水循环+洋流"),
    "S015": ([1,1,0,0,0,0,0,0,1,1,1,1], "特殊-大气全弱,其他全掌握"),
}


def compute_response(mastery, q_kp_indices, slip_rate=0.05, guess_rate=0.15):
    mastered = all(mastery[i] == 1 for i in q_kp_indices)
    if mastered:
        correct = random.random() > slip_rate
    else:
        correct = random.random() < guess_rate
    return correct


def seed():
    random.seed(42)

    logger.info("Step 1: Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        existing = db.query(Project).filter(Project.name == "高一地理认知诊断测试").first()
        if existing:
            logger.info("Test project already exists (id=%s), clearing old data...", existing.id)
            hw_list = db.query(Homework).filter(Homework.project_id == existing.id).all()
            for hw in hw_list:
                db.query(StudentAnswer).filter(StudentAnswer.homework_id == hw.id).delete()
                db.query(CDMParameter).filter(CDMParameter.homework_id == hw.id).delete()
                db.query(Question).filter(Question.homework_id == hw.id).delete()
            db.query(Homework).filter(Homework.project_id == existing.id).delete()
            db.delete(existing)
            db.commit()
            logger.info("Old data cleared.")

        logger.info("Step 2: Creating project...")
        project = create_project(db, "高一地理认知诊断测试", "geography", "高一", "用于测试认知诊断全流程的示例数据")
        project_id = str(project.id)
        logger.info("Project created: %s", project_id)

        logger.info("Step 3: Importing curriculum...")
        curriculum_data = _load_geography_curriculum()
        import_curriculum_to_project(db, project_id, curriculum_data)
        init_from_curriculum(curriculum_data, project_id)
        persist_to_db(db)
        project.curriculum_imported = True
        project.graph_initialized = True
        db.commit()
        logger.info("Curriculum imported and knowledge graph initialized.")

        logger.info("Step 4: Creating homework...")
        hw = Homework(
            project_id=project_id,
            title="高一地理期中考试",
            class_id="class-2024-01",
            status="created",
        )
        db.add(hw)
        db.commit()
        db.refresh(hw)
        homework_id = str(hw.id)
        logger.info("Homework created: %s (id=%s)", hw.title, homework_id)

        logger.info("Step 5: Adding questions...")
        q_dicts = [
            {"seq": q["seq"], "content": q["content"], "question_type": q["question_type"], "score": q["score"], "answer": q["answer"]}
            for q in QUESTIONS
        ]
        questions = add_questions(db, homework_id, q_dicts)
        logger.info("Added %d questions.", len(questions))

        logger.info("Step 6: Setting Q-matrix directly...")
        for q in questions:
            q_info = QUESTIONS[q.seq - 1]
            q_matrix = {KP_CODES[i]: 1 for i in q_info["kp_indices"]}
            q.q_matrix = q_matrix
            q.q_matrix_confirmed = True
            q.q_matrix_source = "manual"
        hw.status = "q_matrix_confirmed"
        db.commit()
        logger.info("Q-matrix set and confirmed for all %d questions.", len(questions))

        logger.info("Step 7: Generating student answers...")
        answers = []
        for student_id, (mastery, desc) in STUDENT_PROFILES.items():
            for q in questions:
                q_info = QUESTIONS[q.seq - 1]
                is_correct = compute_response(mastery, q_info["kp_indices"])
                if is_correct:
                    student_answer = q_info["answer"]
                    score = q_info["score"]
                else:
                    wrong_options = [o for o in ANSWER_OPTIONS if o != q_info["answer"]]
                    student_answer = random.choice(wrong_options)
                    score = 0.0
                answers.append({
                    "student_id": student_id,
                    "question_id": str(q.id),
                    "student_answer": student_answer,
                    "score": score,
                    "is_correct": is_correct,
                })

        import_student_answers(db, homework_id, answers)
        logger.info("Imported %d answers for %d students.", len(answers), len(STUDENT_PROFILES))

        logger.info("Step 8: Running CDM estimation...")
        cdm_result = run_cdm_estimation(db, homework_id)
        if cdm_result.get("status") == "error":
            logger.error("CDM estimation failed: %s", cdm_result.get("message"))
        else:
            logger.info("CDM estimation completed:")
            logger.info("  Method: %s, Converged: %s, Iterations: %d",
                        cdm_result.get("method"), cdm_result.get("converged"), cdm_result.get("iterations", 0))
            logger.info("  Students: %d, Questions: %d, KPs: %d",
                        cdm_result.get("n_students", 0), cdm_result.get("n_questions", 0), cdm_result.get("n_knowledge_points", 0))
            logger.info("  AIC: %.2f, BIC: %.2f", cdm_result.get("aic", 0), cdm_result.get("bic", 0))

        logger.info("Step 9: Creating courseware record...")
        cw = Courseware(
            name="人教版高一地理必修一",
            subject="geography",
            version="人教版",
            grade="高一",
            file_path="data/curriculum/geography.json",
            slide_count=60,
            parse_status="completed",
            parse_mode="curriculum",
            parsed_at=datetime.now(),
            project_id=project_id,
        )
        db.add(cw)
        db.commit()
        logger.info("Courseware created: %s (id=%s)", cw.name, cw.id)

        logger.info("Step 10: Initializing agent states and events...")
        agent_names = ["knowledge", "diagnosis", "tracing", "teaching", "evolution"]
        agent_labels = {
            "knowledge": "知识Agent",
            "diagnosis": "诊断Agent",
            "tracing": "追踪Agent",
            "teaching": "教学Agent",
            "evolution": "演化Agent",
        }
        for name in agent_names:
            existing_state = db.query(AgentState).filter(AgentState.agent_name == name).first()
            if not existing_state:
                db.add(AgentState(
                    agent_name=name,
                    status="active",
                    last_event_type="initialized",
                    last_event_time=datetime.now(),
                    state_data={"label": agent_labels[name], "description": f"{agent_labels[name]}已初始化"},
                ))
        db.commit()

        agent_events_data = [
            ("curriculum_imported", "knowledge", "课标导入完成，已建立知识图谱"),
            ("qmatrix_confirmed", "diagnosis", "Q矩阵已确认，开始CDM参数估计"),
            ("cdm_estimated", "diagnosis", "CDM参数估计完成，共15名学生、12个知识点"),
            ("diagnosis_completed", "tracing", "诊断完成，已生成学生认知状态追踪数据"),
            ("teaching_suggestions", "teaching", "已生成教学建议和补救优先级"),
            ("parameter_drift", "evolution", "参数漂移检测正常，无异常"),
        ]
        event_ids = []
        for event_type, source_agent, content in agent_events_data:
            evt = AgentEvent(
                event_type=event_type,
                source_type="agent",
                source_id=agent_names.index(source_agent),
                payload={"agent": source_agent, "homework_id": homework_id, "content": content},
                status="completed",
                processed_at=datetime.now(),
            )
            db.add(evt)
            db.flush()
            event_ids.append(evt.id)
        db.commit()

        notifications_data = [
            ("课标导入完成", "地理课标已成功导入，共建立136个知识节点和30+前置关系"),
            ("CDM诊断完成", "高一地理期中考试CDM估计已完成，15名学生、8道题、12个知识点，模型已收敛"),
            ("教学建议已生成", "系统已根据诊断结果生成3组分组教学建议，最优先关注：等值线判读、气压带风带"),
            ("参数漂移检测", "最新一轮CDM参数与历史参数对比正常，未检测到显著漂移"),
        ]
        for i, (title, content) in enumerate(notifications_data):
            db.add(AgentNotification(
                teacher_id=1,
                event_id=event_ids[min(i, len(event_ids) - 1)],
                notification_type="info",
                title=title,
                content=content,
                is_read=i < 2,
            ))
        db.commit()

        msg_pairs = [
            ("knowledge", "diagnosis", "curriculum_ready", {"kp_count": 136, "relation_count": 30}),
            ("diagnosis", "tracing", "cdm_result", {"converged": True, "iterations": 14}),
            ("tracing", "teaching", "mastery_data", {"weak_students": 5}),
            ("teaching", "evolution", "suggestions_generated", {"groups": 3}),
        ]
        for sender, receiver, msg_type, payload in msg_pairs:
            db.add(AgentMessage(
                sender_agent=sender,
                receiver_agent=receiver,
                message_type=msg_type,
                payload=payload,
                status="processed",
                processed_at=datetime.now(),
            ))
        db.commit()
        logger.info("Agent states, events, notifications, messages seeded.")

        logger.info("Step 11: Running student diagnosis for key students...")
        from app.services.root_cause import diagnose_student
        for sid in ["S015", "S012", "S001"]:
            try:
                diag = diagnose_student(db, homework_id, sid)
                logger.info("  Diagnosis for %s: %d weak KPs, %d root causes",
                            sid, diag.get("weak_kp_count", 0), len(diag.get("root_causes", [])))
            except Exception as e:
                logger.warning("  Diagnosis for %s failed: %s", sid, e)

        logger.info("=" * 60)
        logger.info("Seed data creation complete!")
        logger.info("  Project ID: %s", project_id)
        logger.info("  Homework ID: %s", homework_id)
        logger.info("  Courseware ID: %s", cw.id)
        logger.info("  Questions: %d", len(questions))
        logger.info("  Students: %d", len(STUDENT_PROFILES))
        logger.info("  Answers: %d", len(answers))
        logger.info("  Agents: %d", len(agent_names))
        logger.info("  Events: %d", len(agent_events_data))
        logger.info("  Notifications: %d", len(notifications_data))
        logger.info("=" * 60)

    except Exception as e:
        logger.error("Seed failed: %s", e, exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
