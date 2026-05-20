import numpy as np
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import LearningPath, LearningActivity, DiagnosisSession, KnowledgePoint
import uuid


def generate_learning_path(
    db: Session,
    student_id: str,
    diagnosis_session_id: str,
    root_cause_kp_id: str,
    prerequisite_chain: list[dict],
) -> LearningPath:
    path_nodes = []
    path_edges = []

    for i, node in enumerate(prerequisite_chain):
        path_nodes.append({
            "kp_id": node.get("code", ""),
            "kp_name": node.get("name", ""),
            "mastery_rate": node.get("mastery_rate", 0.0),
            "cognitive_level": node.get("cognitive_level", ""),
            "sequence": i,
        })
        if i > 0:
            path_edges.append({
                "from": prerequisite_chain[i - 1].get("code", ""),
                "to": node.get("code", ""),
                "relation": "PREREQUISITE_OF",
            })

    estimated_duration = _estimate_duration(path_nodes)

    path = LearningPath(
        student_id=student_id,
        diagnosis_session_id=diagnosis_session_id,
        root_cause_kp_id=root_cause_kp_id,
        path_nodes=path_nodes,
        path_edges=path_edges,
        estimated_duration=estimated_duration,
        status="active",
    )
    db.add(path)
    db.commit()
    db.refresh(path)

    _generate_activities(db, path.id, path_nodes)

    return path


def _estimate_duration(path_nodes: list[dict]) -> dict:
    cognitive_weights = {
        "remember": 1,
        "understand": 2,
        "apply": 3,
        "analyze": 4,
        "evaluate": 5,
        "create": 6,
    }
    total_hours = 0
    for node in path_nodes:
        mastery = node.get("mastery_rate", 0.0)
        level = node.get("cognitive_level", "understand")
        weight = cognitive_weights.get(level, 2)
        gap = max(0, 0.8 - mastery)
        hours = weight * gap * 2
        total_hours += hours

    return {
        "total_hours": round(total_hours, 1),
        "sessions": max(1, int(np.ceil(total_hours / 1.5))),
        "weeks": max(1, int(np.ceil(total_hours / 4.5))),
    }


def _generate_activities(db: Session, path_id: str, path_nodes: list[dict]):
    activity_templates = {
        "remember": [
            {"type": "flashcard", "name": "知识点闪卡复习"},
            {"type": "fill_blank", "name": "填空练习"},
        ],
        "understand": [
            {"type": "concept_map", "name": "概念图构建"},
            {"type": "explanation", "name": "用自己的话解释"},
        ],
        "apply": [
            {"type": "exercise", "name": "专项练习题"},
            {"type": "case_analysis", "name": "案例分析"},
        ],
        "analyze": [
            {"type": "comparison", "name": "对比分析练习"},
            {"type": "decomposition", "name": "问题分解训练"},
        ],
        "evaluate": [
            {"type": "critique", "name": "方案评价练习"},
            {"type": "argument", "name": "论证训练"},
        ],
        "create": [
            {"type": "design", "name": "方案设计"},
            {"type": "synthesis", "name": "综合应用题"},
        ],
    }

    seq = 0
    for node in path_nodes:
        level = node.get("cognitive_level", "understand")
        templates = activity_templates.get(level, activity_templates["understand"])
        for template in templates:
            activity = LearningActivity(
                learning_path_id=path_id,
                knowledge_point_id=node.get("kp_id", ""),
                activity_type=template["type"],
                content={"name": template["name"], "kp_name": node.get("kp_name", "")},
                sequence=seq,
            )
            db.add(activity)
            seq += 1

    db.commit()


def get_student_learning_paths(db: Session, student_id: str) -> list[dict]:
    paths = db.query(LearningPath).filter(
        LearningPath.student_id == student_id,
        LearningPath.status == "active",
    ).order_by(LearningPath.created_at.desc()).all()

    result = []
    for p in paths:
        activities = db.query(LearningActivity).filter(
            LearningActivity.learning_path_id == p.id
        ).order_by(LearningActivity.sequence).all()

        result.append({
            "id": str(p.id),
            "student_id": p.student_id,
            "root_cause_kp_id": str(p.root_cause_kp_id) if p.root_cause_kp_id else None,
            "path_nodes": p.path_nodes,
            "path_edges": p.path_edges,
            "estimated_duration": p.estimated_duration,
            "status": p.status,
            "progress": p.progress,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "activities": [
                {
                    "id": str(a.id),
                    "type": a.activity_type,
                    "content": a.content,
                    "sequence": a.sequence,
                    "status": a.status,
                    "result": a.result,
                }
                for a in activities
            ],
        })
    return result


def update_activity_result(
    db: Session,
    activity_id: str,
    result: dict,
) -> LearningActivity:
    activity = db.query(LearningActivity).filter(LearningActivity.id == activity_id).first()
    if not activity:
        raise ValueError(f"Activity {activity_id} not found")

    activity.result = result
    activity.status = "completed"
    activity.completed_at = datetime.now()
    db.commit()
    db.refresh(activity)

    _update_path_progress(db, activity.learning_path_id)

    return activity


def _update_path_progress(db: Session, path_id: str):
    activities = db.query(LearningActivity).filter(
        LearningActivity.learning_path_id == path_id
    ).all()

    if not activities:
        return

    completed = sum(1 for a in activities if a.status == "completed")
    progress = completed / len(activities)

    path = db.query(LearningPath).filter(LearningPath.id == path_id).first()
    if path:
        path.progress = progress
        if progress >= 1.0:
            path.status = "completed"
            path.completed_at = datetime.now()
        db.commit()
