from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import Diagnosis, CDMParameter, Homework, Question, KnowledgePoint
from app.services.knowledge_service import get_prerequisite_chain, _get_store
import numpy as np
import uuid


def _flatten_prereq_nodes(prereq_chains: list[dict]) -> list[dict]:
    if not prereq_chains:
        return []
    return prereq_chains[0].get("chain", [])


def diagnose_student(
    db: Session,
    homework_id: str,
    student_id: str,
) -> dict:
    cdm_params = db.query(CDMParameter).filter(CDMParameter.homework_id == homework_id).order_by(CDMParameter.estimated_at.desc()).first()
    if not cdm_params:
        return {"status": "error", "message": "请先运行CDM参数估计"}

    alpha_data = cdm_params.alpha or {}
    kp_codes = alpha_data.get("kp_codes", [])
    student_ids = alpha_data.get("student_ids", [])
    alpha_estimates = alpha_data.get("alpha_estimates", [])

    if student_id not in student_ids:
        return {"status": "error", "message": f"学生 {student_id} 不在本次诊断中"}

    student_idx = student_ids.index(student_id)
    student_alpha = alpha_estimates[student_idx] if student_idx < len(alpha_estimates) else []

    knowledge_state = {}
    weak_kps = []
    for i, kp_code in enumerate(kp_codes):
        mastery = student_alpha[i] if i < len(student_alpha) else 0.0
        knowledge_state[kp_code] = round(mastery, 4)
        if mastery < 0.5:
            weak_kps.append({"code": kp_code, "mastery": round(mastery, 4)})

    weak_kps.sort(key=lambda x: x["mastery"])

    root_causes = []
    for weak_kp in weak_kps[:5]:
        prereq_chains = get_prerequisite_chain(weak_kp["code"])
        prereq_nodes = _flatten_prereq_nodes(prereq_chains)
        chain_names = []
        for node in prereq_nodes:
            chain_names.append({
                "code": node.get("code", ""),
                "name": node.get("name", ""),
                "mastery": knowledge_state.get(node.get("code", ""), 0.0),
            })

        root_cause = weak_kp
        best_depth = -1
        best_mastery = 1.0
        if prereq_nodes:
            for depth, node in enumerate(prereq_nodes):
                node_mastery = knowledge_state.get(node.get("code", ""), 1.0)
                if node_mastery < 0.5:
                    if depth > best_depth or (depth == best_depth and node_mastery < best_mastery):
                        best_depth = depth
                        best_mastery = node_mastery
                        root_cause = {"code": node.get("code", ""), "mastery": node_mastery, "name": node.get("name", "")}

        root_causes.append({
            "weak_kp": weak_kp,
            "root_cause": root_cause,
            "prerequisite_chain": chain_names,
            "trace_depth": len(chain_names),
            "root_cause_depth": best_depth if best_depth >= 0 else 0,
        })

    diagnosis = Diagnosis(
        homework_id=homework_id,
        student_id=student_id,
        root_cause_kp_id=weak_kps[0]["code"] if weak_kps else None,
        confidence=1.0 - (weak_kps[0]["mastery"] if weak_kps else 0.0),
        knowledge_state=knowledge_state,
        trace_path=[rc["root_cause"] for rc in root_causes],
        cdm_params_ref=str(cdm_params.id),
    )
    db.add(diagnosis)
    db.commit()
    db.refresh(diagnosis)

    return {
        "status": "success",
        "diagnosis_id": str(diagnosis.id),
        "student_id": student_id,
        "knowledge_state": knowledge_state,
        "weak_kp_count": len(weak_kps),
        "weak_kps": weak_kps,
        "root_causes": root_causes,
    }


def diagnose_class(
    db: Session,
    homework_id: str,
) -> dict:
    cdm_params = db.query(CDMParameter).filter(CDMParameter.homework_id == homework_id).order_by(CDMParameter.estimated_at.desc()).first()
    if not cdm_params:
        return {"status": "error", "message": "请先运行CDM参数估计"}

    alpha_data = cdm_params.alpha or {}
    kp_codes = alpha_data.get("kp_codes", [])
    student_ids = alpha_data.get("student_ids", [])
    alpha_estimates = alpha_data.get("alpha_estimates", [])

    kp_weak_counts = {code: 0 for code in kp_codes}
    kp_mastery_sum = {code: 0.0 for code in kp_codes}

    for i, sid in enumerate(student_ids):
        for j, kp_code in enumerate(kp_codes):
            mastery = alpha_estimates[i][j] if i < len(alpha_estimates) and j < len(alpha_estimates[i]) else 0.0
            kp_mastery_sum[kp_code] += mastery
            if mastery < 0.5:
                kp_weak_counts[kp_code] += 1

    n_students = max(len(student_ids), 1)
    kp_avg_mastery = {code: round(kp_mastery_sum[code] / n_students, 4) for code in kp_codes}

    class_weak_kps = sorted(kp_weak_counts.items(), key=lambda x: x[1], reverse=True)

    class_root_causes = []
    for kp_code, weak_count in class_weak_kps[:5]:
        if weak_count == 0:
            continue
        prereq_chains = get_prerequisite_chain(kp_code)
        prereq_nodes = _flatten_prereq_nodes(prereq_chains)
        root_cause = kp_code
        best_depth = -1
        best_mastery = 1.0
        for depth, node in enumerate(prereq_nodes):
            node_mastery = kp_avg_mastery.get(node.get("code", ""), 1.0)
            if node_mastery < 0.5:
                if depth > best_depth or (depth == best_depth and node_mastery < best_mastery):
                    best_depth = depth
                    best_mastery = node_mastery
                    root_cause = node.get("code", kp_code)

        store = _get_store()
        kp_name = ""
        for etype, entities in store["entities"].items():
            if kp_code in entities:
                kp_name = entities[kp_code].get("name", "")
                break

        class_root_causes.append({
            "kp_code": kp_code,
            "kp_name": kp_name,
            "weak_count": weak_count,
            "weak_rate": round(weak_count / n_students, 4),
            "avg_mastery": kp_avg_mastery.get(kp_code, 0.0),
            "root_cause_code": root_cause,
            "prerequisite_chain": prereq_nodes,
        })

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "n_students": n_students,
        "n_knowledge_points": len(kp_codes),
        "kp_avg_mastery": kp_avg_mastery,
        "class_root_causes": class_root_causes,
    }


def get_diagnosis_result(db: Session, homework_id: str, student_id: str) -> dict:
    diagnosis = db.query(Diagnosis).filter(
        Diagnosis.homework_id == homework_id,
        Diagnosis.student_id == student_id,
    ).order_by(Diagnosis.created_at.desc()).first()

    if not diagnosis:
        return {"status": "pending", "message": "该学生尚未诊断"}

    return {
        "status": "success",
        "diagnosis_id": str(diagnosis.id),
        "student_id": diagnosis.student_id,
        "knowledge_state": diagnosis.knowledge_state,
        "root_cause_kp_id": str(diagnosis.root_cause_kp_id) if diagnosis.root_cause_kp_id else None,
        "confidence": diagnosis.confidence,
        "trace_path": diagnosis.trace_path,
        "teacher_confirmed": diagnosis.teacher_confirmed,
        "created_at": diagnosis.created_at.isoformat() if diagnosis.created_at else None,
    }


def confirm_diagnosis(db: Session, diagnosis_id: str, correction: Optional[dict] = None) -> dict:
    diagnosis = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).first()
    if not diagnosis:
        return {"status": "error", "message": "诊断记录不存在"}

    diagnosis.teacher_confirmed = True
    if correction:
        diagnosis.teacher_correction = correction
    db.commit()

    return {"status": "success", "diagnosis_id": str(diagnosis.id), "confirmed": True}
