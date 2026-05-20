import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import DiagnosisSession, CDMParameter

logger = logging.getLogger(__name__)


def save_knowledge_state(
    db: Session,
    homework_id: str,
    student_id: str,
    knowledge_state: dict,
    source: str = "diagnosis",
) -> dict:
    session = DiagnosisSession(
        homework_id=homework_id,
        student_id=student_id,
        knowledge_state_snapshot=knowledge_state,
        session_timestamp=datetime.now(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "status": "success",
        "session_id": str(session.id),
        "student_id": str(session.student_id),
        "timestamp": session.session_timestamp.isoformat() if session.session_timestamp else None,
        "knowledge_point_count": len(knowledge_state),
    }


def get_latest_knowledge_state(
    db: Session,
    student_id: str,
    homework_id: Optional[str] = None,
) -> dict:
    query = db.query(DiagnosisSession).filter(DiagnosisSession.student_id == student_id)
    if homework_id:
        query = query.filter(DiagnosisSession.homework_id == homework_id)
    query = query.order_by(DiagnosisSession.session_timestamp.desc())

    session = query.first()
    if not session:
        return {"status": "error", "message": "未找到知识状态记录"}

    return {
        "status": "success",
        "session_id": str(session.id),
        "student_id": str(session.student_id),
        "homework_id": str(session.homework_id),
        "knowledge_state": session.knowledge_state_snapshot,
        "timestamp": session.session_timestamp.isoformat() if session.session_timestamp else None,
    }


def get_knowledge_state_history(
    db: Session,
    student_id: str,
    limit: int = 10,
) -> dict:
    sessions = db.query(DiagnosisSession).filter(
        DiagnosisSession.student_id == student_id,
    ).order_by(DiagnosisSession.session_timestamp.desc()).limit(limit).all()

    history = []
    for s in sessions:
        history.append({
            "session_id": str(s.id),
            "homework_id": str(s.homework_id),
            "knowledge_state": s.knowledge_state_snapshot,
            "timestamp": s.session_timestamp.isoformat() if s.session_timestamp else None,
        })

    return {
        "status": "success",
        "student_id": student_id,
        "sessions": history,
        "total": len(history),
    }


def compare_knowledge_states(
    db: Session,
    student_id: str,
    session_id_a: str,
    session_id_b: str,
) -> dict:
    session_a = db.query(DiagnosisSession).filter(DiagnosisSession.id == session_id_a).first()
    session_b = db.query(DiagnosisSession).filter(DiagnosisSession.id == session_id_b).first()

    if not session_a:
        return {"status": "error", "message": f"会话 {session_id_a} 不存在"}
    if not session_b:
        return {"status": "error", "message": f"会话 {session_id_b} 不存在"}

    state_a = session_a.knowledge_state_snapshot or {}
    state_b = session_b.knowledge_state_snapshot or {}
    all_kps = set(list(state_a.keys()) + list(state_b.keys()))

    changes = []
    improved_count = 0
    declined_count = 0
    unchanged_count = 0

    for kp_code in all_kps:
        mastery_a = state_a.get(kp_code, 0.0)
        mastery_b = state_b.get(kp_code, 0.0)
        delta = round(mastery_b - mastery_a, 4)

        if delta > 0.01:
            improved_count += 1
        elif delta < -0.01:
            declined_count += 1
        else:
            unchanged_count += 1

        changes.append({
            "kp_code": kp_code,
            "before": round(mastery_a, 4),
            "after": round(mastery_b, 4),
            "delta": delta,
        })

    changes.sort(key=lambda x: x["delta"], reverse=True)

    return {
        "status": "success",
        "student_id": student_id,
        "session_a": {
            "id": str(session_a.id),
            "timestamp": session_a.session_timestamp.isoformat() if session_a.session_timestamp else None,
        },
        "session_b": {
            "id": str(session_b.id),
            "timestamp": session_b.session_timestamp.isoformat() if session_b.session_timestamp else None,
        },
        "changes": changes,
        "summary": {
            "improved": improved_count,
            "declined": declined_count,
            "unchanged": unchanged_count,
            "total": len(changes),
        },
    }


def get_class_knowledge_state_summary(
    db: Session,
    homework_id: str,
) -> dict:
    sessions = db.query(DiagnosisSession).filter(
        DiagnosisSession.homework_id == homework_id,
    ).order_by(DiagnosisSession.session_timestamp.desc()).all()

    if not sessions:
        cdm_params = db.query(CDMParameter).filter(
            CDMParameter.homework_id == homework_id,
        ).order_by(CDMParameter.estimated_at.desc()).first()

        if cdm_params and cdm_params.alpha:
            alpha_data = cdm_params.alpha
            kp_codes = alpha_data.get("kp_codes", [])
            student_ids = alpha_data.get("student_ids", [])
            alpha_estimates = alpha_data.get("alpha_estimates", [])

            kp_avg = {}
            n_students = max(len(student_ids), 1)
            for j, kp_code in enumerate(kp_codes):
                values = [alpha_estimates[i][j] for i in range(len(student_ids)) if i < len(alpha_estimates) and j < len(alpha_estimates[i])]
                kp_avg[kp_code] = {
                    "avg_mastery": round(sum(values) / len(values), 4) if values else 0.0,
                    "weak_count": sum(1 for v in values if v < 0.5),
                    "total": len(values),
                }

            return {
                "status": "success",
                "homework_id": str(homework_id),
                "source": "cdm_parameters",
                "n_students": n_students,
                "knowledge_points": kp_avg,
            }

        return {"status": "error", "message": "未找到诊断数据"}

    student_states = {}
    for s in sessions:
        if s.student_id not in student_states or (
            student_states[s.student_id].session_timestamp
            and s.session_timestamp
            and s.session_timestamp > student_states[s.student_id].session_timestamp
        ):
            student_states[s.student_id] = s

    all_kps = set()
    for s in student_states.values():
        if s.knowledge_state_snapshot:
            all_kps.update(s.knowledge_state_snapshot.keys())

    kp_summary = {}
    for kp_code in all_kps:
        values = []
        for s in student_states.values():
            if s.knowledge_state_snapshot and kp_code in s.knowledge_state_snapshot:
                values.append(s.knowledge_state_snapshot[kp_code])

        kp_summary[kp_code] = {
            "avg_mastery": round(sum(values) / len(values), 4) if values else 0.0,
            "weak_count": sum(1 for v in values if v < 0.5),
            "total": len(values),
        }

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "source": "diagnosis_sessions",
        "n_students": len(student_states),
        "knowledge_points": kp_summary,
    }