import numpy as np
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.db_models import CDMParameter, Homework, Question, KnowledgePoint

logger = logging.getLogger(__name__)


def compute_counterfactual(
    db: Session,
    homework_id: str,
    student_id: str,
    target_kp_codes: Optional[list[str]] = None,
) -> dict:
    cdm_params = db.query(CDMParameter).filter(
        CDMParameter.homework_id == homework_id
    ).order_by(CDMParameter.estimated_at.desc()).first()

    if not cdm_params:
        return {"status": "error", "message": "请先运行CDM参数估计"}

    alpha_data = cdm_params.alpha or {}
    kp_codes = alpha_data.get("kp_codes", [])
    student_ids = alpha_data.get("student_ids", [])
    alpha_estimates = alpha_data.get("alpha_estimates", [])

    if student_id not in student_ids:
        return {"status": "error", "message": f"学生 {student_id} 不在本次诊断中"}

    student_idx = student_ids.index(student_id)
    student_alpha = np.array(alpha_estimates[student_idx]) if student_idx < len(alpha_estimates) else np.zeros(len(kp_codes))

    slip_data = cdm_params.slip or []
    guess_data = cdm_params.guess or []

    slip = np.full(n_questions, 0.2)
    guess = np.full(n_questions, 0.2)

    if isinstance(slip_data, list):
        for j in range(min(n_questions, len(slip_data))):
            slip[j] = float(slip_data[j])
    elif isinstance(slip_data, dict):
        for j in range(n_questions):
            key = str(j)
            if key in slip_data:
                slip[j] = float(slip_data[key])

    if isinstance(guess_data, list):
        for j in range(min(n_questions, len(guess_data))):
            guess[j] = float(guess_data[j])
    elif isinstance(guess_data, dict):
        for j in range(n_questions):
            key = str(j)
            if key in guess_data:
                guess[j] = float(guess_data[key])

    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    if not questions:
        return {"status": "error", "message": "作业没有题目"}

    n_questions = len(questions)
    n_kp = len(kp_codes)

    q_matrix = np.zeros((n_questions, n_kp), dtype=int)
    question_ids = []
    for i, q in enumerate(questions):
        question_ids.append(str(q.id))
        qm = q.q_matrix or {}
        for kp_idx, kp_code in enumerate(kp_codes):
            q_matrix[i, kp_idx] = int(qm.get(kp_code, 0))

    if target_kp_codes is None:
        target_kp_codes = [kp_codes[i] for i in range(n_kp) if student_alpha[i] < 0.5]

    target_kp_indices = []
    for kp_code in target_kp_codes:
        if kp_code in kp_codes:
            target_kp_indices.append(kp_codes.index(kp_code))

    if not target_kp_indices:
        return {
            "status": "success",
            "student_id": student_id,
            "homework_id": str(homework_id),
            "counterfactuals": [],
            "message": "该学生所有知识点均已掌握，无需反事实推理",
        }

    results = []
    for kp_idx in target_kp_indices:
        affected_questions = []
        cf_alpha = student_alpha.copy()
        cf_alpha[kp_idx] = 1.0

        for j in range(n_questions):
            q_row = q_matrix[j]
            if q_row[kp_idx] == 0:
                continue

            eta_current = _dina_eta(student_alpha, q_row)
            eta_cf = _dina_eta(cf_alpha, q_row)

            if abs(eta_current - eta_cf) < 1e-10:
                continue

            s = slip[j]
            g = guess[j]

            p_current = (1 - s) * eta_current + g * (1 - eta_current)
            p_cf = (1 - s) * eta_cf + g * (1 - eta_cf)
            delta = p_cf - p_current

            affected_questions.append({
                "question_id": question_ids[j],
                "seq": questions[j].seq,
                "content": questions[j].content[:100] if questions[j].content else "",
                "before": round(float(p_current), 4),
                "after": round(float(p_cf), 4),
                "delta": round(float(delta), 4),
            })

        affected_questions.sort(key=lambda x: x["delta"], reverse=True)

        results.append({
            "kp_code": kp_codes[kp_idx],
            "kp_name": _get_kp_name(db, kp_codes[kp_idx]),
            "current_mastery": round(float(student_alpha[kp_idx]), 4),
            "affected_question_count": len(affected_questions),
            "affected_questions": affected_questions,
            "avg_improvement": round(float(np.mean([q["delta"] for q in affected_questions])), 4) if affected_questions else 0.0,
        })

    results.sort(key=lambda x: x["avg_improvement"], reverse=True)

    return {
        "status": "success",
        "student_id": student_id,
        "homework_id": str(homework_id),
        "n_kp": n_kp,
        "counterfactuals": results,
        "summary": {
            "total_kp_analyzed": len(results),
            "total_questions_improved": sum(len(r["affected_questions"]) for r in results),
            "top_recommendation": results[0]["kp_code"] if results else None,
        },
    }


def _dina_eta(alpha: np.ndarray, q_row: np.ndarray) -> float:
    relevant = q_row * alpha
    if np.sum(q_row) == 0:
        return 1.0
    return 1.0 if np.all(relevant >= q_row) else 0.0


def _get_kp_name(db: Session, kp_code: str) -> str:
    kp = db.query(KnowledgePoint).filter(KnowledgePoint.code == kp_code).first()
    if kp and kp.name:
        return kp.name
    from app.services.knowledge_service import find_entity
    entity = find_entity(kp_code)
    if entity:
        return entity.get("name", kp_code)
    return kp_code