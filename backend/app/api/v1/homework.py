from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.homework_service import create_homework, add_questions, import_student_answers, get_homework_results
from app.services.qmatrix_service import generate_q_matrix, generate_q_matrix_async, get_q_matrix, confirm_q_matrix, validate_q_matrix
from app.models.db_models import Homework, StudentAnswer, Question

router = APIRouter(prefix="/api/homework", tags=["homework"])


class CreateHomeworkRequest(BaseModel):
    project_id: str
    title: str
    class_id: str = "default-class"
    homework_date: Optional[str] = None


class AddItemsRequest(BaseModel):
    questions: list[dict]


class ImportAnswersRequest(BaseModel):
    answers: list[dict]


class GenerateQMatrixRequest(BaseModel):
    method: str = "nlp"


class ConfirmQMatrixRequest(BaseModel):
    adjustments: Optional[dict] = None


class HomeworkListItem(BaseModel):
    id: str
    title: str
    class_id: Optional[str] = None
    status: Optional[str] = None
    question_count: int = 0
    student_count: int = 0
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class HomeworkListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    items: list[HomeworkListItem]


class HomeworkDetailResponse(BaseModel):
    id: str
    title: str
    project_id: str
    class_id: Optional[str] = None
    homework_date: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[str] = None
    question_count: int = 0
    student_count: int = 0

    class Config:
        from_attributes = True


@router.post("/")
async def api_create_homework(req: CreateHomeworkRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    homework_date = None
    if req.homework_date:
        homework_date = datetime.fromisoformat(req.homework_date)
    hw = create_homework(db, req.project_id, req.title, req.class_id, homework_date)
    return {"status": "success", "homework_id": str(hw.id), "title": hw.title}


@router.get("/")
async def api_list_homework(
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(Homework)
    if project_id:
        query = query.filter(Homework.project_id == project_id)
    total = query.count()
    homeworks = query.order_by(Homework.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for hw in homeworks:
        question_count = db.query(Question).filter(Question.homework_id == hw.id).count()
        answers = db.query(StudentAnswer).filter(StudentAnswer.homework_id == hw.id).all()
        student_ids = set(a.student_id for a in answers)
        items.append({
            "id": str(hw.id),
            "title": hw.title,
            "class_id": hw.class_id,
            "status": hw.status,
            "question_count": question_count,
            "student_count": len(student_ids),
            "created_at": hw.created_at.isoformat() if hw.created_at else None,
        })

    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.post("/{homework_id}/items")
async def api_add_items(homework_id: str, req: AddItemsRequest, db: Session = Depends(get_db)):
    questions = add_questions(db, homework_id, req.questions)
    return {"status": "success", "homework_id": homework_id, "added_count": len(questions)}


@router.post("/{homework_id}/import")
async def api_import_answers(homework_id: str, req: ImportAnswersRequest, db: Session = Depends(get_db)):
    answers = import_student_answers(db, homework_id, req.answers)
    from app.services.agent_bus import AgentBus
    AgentBus.send(db, "diagnosis", "diagnosis", "answer_imported", {
        "homework_id": homework_id,
        "student_count": len(set(a.get("student_id", "") for a in req.answers)),
    })
    return {"status": "success", "homework_id": homework_id, "imported_count": len(answers)}


@router.get("/{homework_id}/results")
async def api_get_results(homework_id: str, db: Session = Depends(get_db)):
    result = get_homework_results(db, homework_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.post("/{homework_id}/q-matrix/generate")
async def api_generate_q_matrix(homework_id: str, req: GenerateQMatrixRequest, db: Session = Depends(get_db)):
    if req.method == "llm":
        result = await generate_q_matrix_async(db, homework_id, req.method)
    else:
        result = generate_q_matrix(db, homework_id, req.method)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/{homework_id}/q-matrix")
async def api_get_q_matrix(homework_id: str, db: Session = Depends(get_db)):
    result = get_q_matrix(db, homework_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.put("/{homework_id}/q-matrix/confirm")
async def api_confirm_q_matrix(homework_id: str, req: ConfirmQMatrixRequest, db: Session = Depends(get_db)):
    result = confirm_q_matrix(db, homework_id, req.adjustments)
    from app.services.agent_bus import AgentBus
    AgentBus.send(db, "diagnosis", "diagnosis", "qmatrix_confirmed", {
        "homework_id": homework_id,
    })
    return result


@router.post("/{homework_id}/q-matrix/validate")
async def api_validate_q_matrix(homework_id: str, db: Session = Depends(get_db)):
    result = validate_q_matrix(db, homework_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result
