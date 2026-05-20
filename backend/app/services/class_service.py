import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.db_models import CDMParameter, StudentGroup, SchoolClass
import numpy as np

logger = logging.getLogger(__name__)


def create_class(db: Session, name: str, project_id: str, grade: Optional[str] = None) -> dict:
    existing = db.query(SchoolClass).filter(SchoolClass.name == name, SchoolClass.project_id == project_id).first()
    if existing:
        return {"status": "error", "message": f"班级 '{name}' 已存在"}

    cls_obj = SchoolClass(name=name, project_id=project_id, grade=grade)
    db.add(cls_obj)
    db.commit()
    db.refresh(cls_obj)

    return {
        "status": "success",
        "class_id": str(cls_obj.id),
        "name": cls_obj.name,
        "grade": cls_obj.grade,
        "project_id": str(cls_obj.project_id),
    }


def list_classes(db: Session, project_id: Optional[str] = None) -> dict:
    from sqlalchemy import func

    query = db.query(SchoolClass)
    if project_id:
        query = query.filter(SchoolClass.project_id == project_id)
    classes = query.all()

    class_ids = [c.id for c in classes]
    if class_ids:
        group_counts = dict(
            db.query(StudentGroup.class_id, func.count(StudentGroup.id))
            .filter(StudentGroup.class_id.in_(class_ids))
            .group_by(StudentGroup.class_id)
            .all()
        )
    else:
        group_counts = {}

    result = []
    for c in classes:
        result.append({
            "id": str(c.id),
            "name": c.name,
            "grade": c.grade,
            "project_id": str(c.project_id),
            "student_count": 0,
            "group_count": group_counts.get(c.id, 0),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return {"status": "success", "classes": result, "total": len(result)}


def create_student_group(
    db: Session,
    class_id: str,
    name: str,
    student_ids: list[str],
    focus_kps: Optional[list[str]] = None,
) -> dict:
    group = StudentGroup(
        class_id=class_id,
        name=name,
        student_ids=student_ids,
        focus_kps=focus_kps or [],
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    return {
        "status": "success",
        "group_id": str(group.id),
        "name": group.name,
        "student_count": len(student_ids),
        "focus_kps": group.focus_kps,
    }


def auto_group_students(
    db: Session,
    class_id: str,
    homework_id: str,
    n_groups: int = 3,
) -> dict:
    from app.services.teaching_service import cluster_students

    cluster_result = cluster_students(db, homework_id, n_groups)
    if cluster_result.get("status") == "error":
        return cluster_result

    db.query(StudentGroup).filter(StudentGroup.class_id == class_id).delete(synchronize_session="fetch")

    clusters = cluster_result.get("clusters", [])
    created_groups = []

    for c in clusters:
        weak_codes = [wk["kp_code"] for wk in c.get("weak_kps", [])]
        group = StudentGroup(
            class_id=class_id,
            name=f"第{c['cluster_id'] + 1}组 - {c.get('label', '未知')}",
            student_ids=c.get("student_ids", []),
            focus_kps=weak_codes,
        )
        db.add(group)
        created_groups.append(group)

    db.commit()

    for i, group in enumerate(created_groups):
        db.refresh(group)
        created_groups[i] = {
            "id": str(group.id),
            "name": group.name,
            "student_count": clusters[i]["size"],
            "avg_mastery": clusters[i]["avg_overall_mastery"],
            "label": clusters[i].get("label", ""),
            "focus_kps": [wk["kp_code"] for wk in clusters[i].get("weak_kps", [])],
        }

    return {
        "status": "success",
        "class_id": class_id,
        "n_groups": len(created_groups),
        "groups": created_groups,
    }


def get_student_groups(db: Session, class_id: str) -> dict:
    groups = db.query(StudentGroup).filter(StudentGroup.class_id == class_id).all()
    result = []
    for g in groups:
        result.append({
            "id": str(g.id),
            "name": g.name,
            "student_ids": g.student_ids,
            "student_count": len(g.student_ids) if g.student_ids else 0,
            "focus_kps": g.focus_kps,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return {"status": "success", "class_id": class_id, "groups": result, "total": len(result)}


def add_student_to_group(db: Session, group_id: str, student_id: str) -> dict:
    group = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not group:
        return {"status": "error", "message": "分组不存在"}

    students = group.student_ids or []
    if student_id not in students:
        students.append(student_id)
        group.student_ids = students
        db.commit()

    return {"status": "success", "group_id": str(group.id), "student_count": len(students)}


def remove_student_from_group(db: Session, group_id: str, student_id: str) -> dict:
    group = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not group:
        return {"status": "error", "message": "分组不存在"}

    students = group.student_ids or []
    if student_id in students:
        students.remove(student_id)
        group.student_ids = students
        db.commit()

    return {"status": "success", "group_id": str(group.id), "student_count": len(students)}