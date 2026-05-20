from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.curriculum_service import create_project, list_projects, get_project, import_curriculum_to_project
from app.services.knowledge_service import init_from_curriculum, persist_to_db

router = APIRouter(prefix="/api/project", tags=["project"])


class ProjectCreate(BaseModel):
    name: str
    subject: str
    grade: Optional[str] = None
    description: Optional[str] = None


class CurriculumImportRequest(BaseModel):
    curriculum_data: Optional[dict] = None


@router.post("/")
async def create_new_project(req: ProjectCreate, db: Session = Depends(get_db)):
    project = create_project(db, req.name, req.subject, req.grade, req.description)
    return {"id": str(project.id), "name": project.name, "subject": project.subject, "status": project.status}


@router.get("/")
async def get_projects(db: Session = Depends(get_db)):
    projects = list_projects(db)
    return {"total": len(projects), "items": projects}


@router.get("/{project_id}")
async def get_project_detail(project_id: str, db: Session = Depends(get_db)):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.post("/{project_id}/import-curriculum")
async def import_curriculum(project_id: str, req: CurriculumImportRequest, db: Session = Depends(get_db)):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    curriculum_data = req.curriculum_data
    if not curriculum_data:
        from app.services.curriculum_service import GEOGRAPHY_CURRICULUM
        if project["subject"] == "geography":
            curriculum_data = GEOGRAPHY_CURRICULUM
        else:
            raise HTTPException(status_code=400, detail=f"暂无{project['subject']}的内置课标数据，请上传课标JSON")
    result = import_curriculum_to_project(db, project_id, curriculum_data)
    init_from_curriculum(curriculum_data, project_id)
    persist_to_db(db)
    return result
