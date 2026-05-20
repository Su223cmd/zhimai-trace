from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.class_service import (
    create_class,
    list_classes,
    create_student_group,
    auto_group_students,
    get_student_groups,
    add_student_to_group,
    remove_student_from_group,
    update_class_students,
    get_class_students,
    get_class_stats,
    get_dashboard_overview,
)

router = APIRouter(prefix="/api/class", tags=["class"])


class CreateClassRequest(BaseModel):
    name: str
    project_id: str
    grade: Optional[str] = None


class CreateGroupRequest(BaseModel):
    class_id: str
    name: str
    student_ids: list[str]
    focus_kps: Optional[list[str]] = None


class AutoGroupRequest(BaseModel):
    class_id: str
    homework_id: str
    n_groups: int = 3


class StudentActionRequest(BaseModel):
    group_id: str
    student_id: str


class UpdateStudentsRequest(BaseModel):
    student_ids: list[str]


@router.post("/create")
async def api_create_class(req: CreateClassRequest, db: Session = Depends(get_db)):
    result = create_class(db, req.name, req.project_id, req.grade)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/list")
async def api_list_classes(project_id: Optional[str] = None, db: Session = Depends(get_db)):
    return list_classes(db, project_id)


@router.get("/{class_id}/students")
async def api_get_students(class_id: str, db: Session = Depends(get_db)):
    result = get_class_students(db, class_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.put("/{class_id}/students")
async def api_update_students(class_id: str, req: UpdateStudentsRequest, db: Session = Depends(get_db)):
    result = update_class_students(db, class_id, req.student_ids)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.get("/{class_id}/stats")
async def api_class_stats(class_id: str, db: Session = Depends(get_db)):
    result = get_class_stats(db, class_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.post("/group/create")
async def api_create_group(req: CreateGroupRequest, db: Session = Depends(get_db)):
    result = create_student_group(db, req.class_id, req.name, req.student_ids, req.focus_kps)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/group/auto")
async def api_auto_group(req: AutoGroupRequest, db: Session = Depends(get_db)):
    result = auto_group_students(db, req.class_id, req.homework_id, req.n_groups)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/group/{class_id}")
async def api_get_groups(class_id: str, db: Session = Depends(get_db)):
    return get_student_groups(db, class_id)


@router.post("/group/add-student")
async def api_add_student(req: StudentActionRequest, db: Session = Depends(get_db)):
    result = add_student_to_group(db, req.group_id, req.student_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/group/remove-student")
async def api_remove_student(req: StudentActionRequest, db: Session = Depends(get_db)):
    result = remove_student_from_group(db, req.group_id, req.student_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/dashboard/overview")
async def api_dashboard_overview(db: Session = Depends(get_db)):
    return get_dashboard_overview(db)
