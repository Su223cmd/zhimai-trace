from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.knowledge_tracing_service import (
    BKTModel,
    create_diagnosis_session,
    get_student_mastery_trajectory,
)
from app.services.online_em_service import process_single_answer
from app.services.learning_path_service import (
    generate_learning_path,
    get_student_learning_paths,
    update_activity_result,
)
from app.services.dina_model import run_cdm_estimation
from app.services.root_cause import (
    diagnose_student,
    diagnose_class,
    get_diagnosis_result as get_root_cause_result,
    confirm_diagnosis as confirm_root_cause,
)
from app.services.counterfactual import compute_counterfactual
from app.services.teaching_service import (
    compute_remediation_priority,
    cluster_students,
    generate_teaching_suggestions,
)
from app.models.db_models import DiagnosisSession, CDMParameter, Diagnosis
import numpy as np

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])


class OnlineEMRequest(BaseModel):
    homework_id: str
    response: list[int]
    q_matrix: list[list[int]]


class CDMEstimateRequest(BaseModel):
    homework_id: str


class DiagnoseRequest(BaseModel):
    homework_id: str
    student_id: str


class ConfirmRequest(BaseModel):
    correction: Optional[dict] = None


class LearningPathRequest(BaseModel):
    student_id: str
    diagnosis_session_id: str
    root_cause_kp_id: str
    prerequisite_chain: list[dict]


class ActivityResultRequest(BaseModel):
    result: dict


@router.post("/cdm-estimate")
async def estimate_cdm(req: CDMEstimateRequest, db: Session = Depends(get_db)):
    result = run_cdm_estimation(db, req.homework_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/cdm/status")
async def get_cdm_status(homework_id: str, db: Session = Depends(get_db)):
    latest = db.query(CDMParameter).filter(
        CDMParameter.homework_id == homework_id,
    ).order_by(CDMParameter.estimated_at.desc()).first()
    if not latest:
        return {"status": "not_estimated", "message": "尚未进行CDM参数估计"}
    return {
        "status": "estimated",
        "cdm_params_id": str(latest.id),
        "model_type": latest.model_type,
        "convergence_status": latest.convergence_status,
        "estimated_at": latest.estimated_at.isoformat() if latest.estimated_at else None,
    }


@router.get("/cdm/params")
async def get_cdm_params(homework_id: str, db: Session = Depends(get_db)):
    latest = db.query(CDMParameter).filter(
        CDMParameter.homework_id == homework_id,
    ).order_by(CDMParameter.estimated_at.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="未找到CDM参数记录")
    return {
        "cdm_params_id": str(latest.id),
        "homework_id": str(latest.homework_id),
        "model_type": latest.model_type,
        "slip": latest.slip,
        "guess": latest.guess,
        "alpha": latest.alpha,
        "aic": latest.aic,
        "bic": latest.bic,
        "convergence_status": latest.convergence_status,
        "estimated_at": latest.estimated_at.isoformat() if latest.estimated_at else None,
    }


@router.get("/cdm/update-history")
async def get_cdm_update_history(homework_id: str, db: Session = Depends(get_db)):
    records = db.query(CDMParameter).filter(
        CDMParameter.homework_id == homework_id,
    ).order_by(CDMParameter.estimated_at.desc()).all()
    if not records:
        return {"homework_id": homework_id, "history": []}
    history = []
    for r in records:
        history.append({
            "cdm_params_id": str(r.id),
            "model_type": r.model_type,
            "convergence_status": r.convergence_status,
            "aic": r.aic,
            "bic": r.bic,
            "estimated_at": r.estimated_at.isoformat() if r.estimated_at else None,
        })
    return {"homework_id": homework_id, "history": history}


@router.post("/diagnose")
async def diagnose(req: DiagnoseRequest, db: Session = Depends(get_db)):
    if req.student_id == "__class__":
        result = diagnose_class(db, req.homework_id)
    else:
        result = diagnose_student(db, req.homework_id, req.student_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/result/{exam_id}/{student_id}")
async def get_result(exam_id: str, student_id: str, db: Session = Depends(get_db)):
    result = get_root_cause_result(db, exam_id, student_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/{diagnosis_id}/confirm")
async def confirm(diagnosis_id: str, req: ConfirmRequest, db: Session = Depends(get_db)):
    result = confirm_root_cause(db, diagnosis_id, req.correction)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


class CounterfactualRequest(BaseModel):
    homework_id: str
    student_id: str
    target_kp_codes: Optional[list[str]] = None


@router.post("/counterfactual")
async def counterfactual(req: CounterfactualRequest, db: Session = Depends(get_db)):
    result = compute_counterfactual(db, req.homework_id, req.student_id, req.target_kp_codes)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/online-em/update")
async def online_em_update(req: OnlineEMRequest):
    result = process_single_answer(req.homework_id, req.response, req.q_matrix)
    return result


@router.post("/session")
async def create_session(
    homework_id: str,
    student_id: str,
    knowledge_state: dict,
    db: Session = Depends(get_db),
):
    session = create_diagnosis_session(db, homework_id, student_id, knowledge_state)
    return {
        "id": str(session.id),
        "student_id": session.student_id,
        "knowledge_state": session.knowledge_state_snapshot,
        "timestamp": session.session_timestamp.isoformat() if session.session_timestamp else None,
    }


@router.get("/trajectory/{student_id}")
async def get_mastery_trajectory(
    student_id: str,
    db: Session = Depends(get_db),
):
    trajectory = get_student_mastery_trajectory(db, student_id)
    return {"student_id": student_id, "trajectory": trajectory, "session_count": len(trajectory)}


class KTPredictRequest(BaseModel):
    n_knowledge_points: int
    observations: list[list[int]]


class KTMasteryTimeRequest(BaseModel):
    n_knowledge_points: int
    current_mastery: list[float]
    target: float = 0.8


@router.post("/kt/predict")
async def kt_predict(req: KTPredictRequest):
    model = BKTModel(req.n_knowledge_points)
    obs = np.array(req.observations, dtype=float)
    mastery = model.predict(obs)
    learning_rates = model.estimate_learning_rate(obs)
    return {
        "mastery_trajectory": mastery.tolist(),
        "learning_rates": learning_rates.tolist(),
    }


@router.post("/kt/mastery-time")
async def kt_mastery_time(req: KTMasteryTimeRequest):
    model = BKTModel(req.n_knowledge_points)
    mastery = np.array(req.current_mastery)
    steps = model.predict_mastery_time(mastery, req.target)
    curves = model.forgetting_curve(mastery)
    return {
        "steps_to_mastery": steps.tolist(),
        "forgetting_curve": curves.tolist(),
    }


@router.post("/learning-path")
async def create_learning_path(
    req: LearningPathRequest,
    db: Session = Depends(get_db),
):
    path = generate_learning_path(
        db, req.student_id, req.diagnosis_session_id, req.root_cause_kp_id, req.prerequisite_chain,
    )
    return {
        "id": str(path.id),
        "student_id": path.student_id,
        "path_nodes": path.path_nodes,
        "estimated_duration": path.estimated_duration,
        "status": path.status,
    }


@router.get("/learning-path/{student_id}")
async def get_learning_paths(
    student_id: str,
    db: Session = Depends(get_db),
):
    paths = get_student_learning_paths(db, student_id)
    return {"student_id": student_id, "paths": paths}


@router.put("/learning-activity/{activity_id}/result")
async def update_activity(
    activity_id: str,
    req: ActivityResultRequest,
    db: Session = Depends(get_db),
):
    activity = update_activity_result(db, activity_id, req.result)
    return {
        "id": str(activity.id),
        "status": activity.status,
        "result": activity.result,
    }


@router.get("/remediation-priority")
async def remediation_priority(homework_id: str, db: Session = Depends(get_db)):
    result = compute_remediation_priority(db, homework_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/student-clusters")
async def student_clusters(homework_id: str, n_clusters: int = 3, db: Session = Depends(get_db)):
    result = cluster_students(db, homework_id, n_clusters)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/teaching-suggestions")
async def teaching_suggestions(homework_id: str, db: Session = Depends(get_db)):
    result = generate_teaching_suggestions(db, homework_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result
