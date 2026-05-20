import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.db_models import Courseware, KnowledgePoint
from app.services.courseware_service import (
    save_upload_file,
    parse_courseware,
    create_template_ppt,
)
from app.config import settings

router = APIRouter(prefix="/api/courseware", tags=["courseware"])


@router.post("/upload")
async def upload_courseware(
    file: UploadFile = File(...),
    subject: str = "geography",
    version: str = "人教版",
    grade: str = "高一",
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".pptx"):
        raise HTTPException(status_code=400, detail="仅支持.pptx文件")

    filepath = save_upload_file(file, settings.UPLOAD_DIR)

    courseware = Courseware(
        name=os.path.splitext(file.filename)[0],
        subject=subject,
        version=version,
        grade=grade,
        file_path=filepath,
        parse_status="pending",
        parse_mode="free",
    )
    db.add(courseware)
    db.commit()
    db.refresh(courseware)

    return {
        "id": str(courseware.id),
        "name": courseware.name,
        "subject": courseware.subject,
        "version": courseware.version,
        "grade": courseware.grade,
        "parse_status": courseware.parse_status,
        "created_at": courseware.created_at.isoformat() if courseware.created_at else None,
    }


@router.post("/{courseware_id}/parse")
async def trigger_parse(
    courseware_id: str,
    db: Session = Depends(get_db),
):
    try:
        result = await parse_courseware(courseware_id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/")
async def list_coursewares(
    subject: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(Courseware)
    if subject:
        query = query.filter(Courseware.subject == subject)
    total = query.count()
    coursewares = query.order_by(Courseware.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": str(cw.id),
                "name": cw.name,
                "subject": cw.subject,
                "version": cw.version,
                "grade": cw.grade,
                "slide_count": cw.slide_count,
                "parse_status": cw.parse_status,
                "parse_mode": cw.parse_mode,
                "parsed_at": cw.parsed_at.isoformat() if cw.parsed_at else None,
                "created_at": cw.created_at.isoformat() if cw.created_at else None,
            }
            for cw in coursewares
        ],
    }


@router.get("/{courseware_id}")
async def get_courseware(
    courseware_id: str,
    db: Session = Depends(get_db),
):
    courseware = db.query(Courseware).filter(Courseware.id == courseware_id).first()
    if not courseware:
        raise HTTPException(status_code=404, detail="课件不存在")

    knowledge_points = db.query(KnowledgePoint).filter(
        KnowledgePoint.courseware_id == courseware.id
    ).all()

    return {
        "id": str(courseware.id),
        "name": courseware.name,
        "subject": courseware.subject,
        "version": courseware.version,
        "grade": courseware.grade,
        "slide_count": courseware.slide_count,
        "parse_status": courseware.parse_status,
        "parse_mode": courseware.parse_mode,
        "parsed_at": courseware.parsed_at.isoformat() if courseware.parsed_at else None,
        "created_at": courseware.created_at.isoformat() if courseware.created_at else None,
        "knowledge_points": [
            {
                "id": str(kp.id),
                "code": kp.code,
                "name": kp.name,
                "cognitive_level": kp.cognitive_level,
                "chapter": kp.chapter,
                "source_type": kp.source_type,
            }
            for kp in knowledge_points
        ],
    }


@router.get("/template/download")
async def download_template():
    template_dir = os.path.join(settings.UPLOAD_DIR, "templates")
    os.makedirs(template_dir, exist_ok=True)
    template_path = os.path.join(template_dir, "courseware_template.pptx")

    if not os.path.exists(template_path):
        create_template_ppt(template_path)

    return FileResponse(
        path=template_path,
        filename="课件模板.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )


@router.get("/{courseware_id}/feedback")
async def get_courseware_feedback(
    courseware_id: str,
    db: Session = Depends(get_db),
):
    courseware = db.query(Courseware).filter(Courseware.id == courseware_id).first()
    if not courseware:
        raise HTTPException(status_code=404, detail="课件不存在")

    return {
        "courseware_id": courseware_id,
        "feedback": [],
        "message": "暂无课件反馈，需完成诊断后生成",
    }
