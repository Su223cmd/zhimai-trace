from pydantic import BaseModel
from typing import Optional


class CDMEstimateRequest(BaseModel):
    homework_id: str
    model_type: str = "DINA"
    max_iter: int = 500
    tol: float = 1e-4


class CDMParamsResponse(BaseModel):
    homework_id: str
    model_type: str
    slip: dict
    guess: dict
    alpha: dict
    aic: float
    bic: float
    convergence_status: str
    iterations: int


class DiagnosisRequest(BaseModel):
    homework_id: str
    student_id: str


class RootCauseResponse(BaseModel):
    target_kp_id: str
    root_cause_kp_id: str
    trace_path: list[str]
    confidence: float


class CounterfactualRequest(BaseModel):
    root_cause_kp_id: str
    homework_id: str


class CounterfactualPrediction(BaseModel):
    knowledge_id: str
    knowledge_name: str
    current_rate: float
    predicted_rate: float
    improvement: float
    reliable: bool
    sample_size: int


class TeacherFeedbackRequest(BaseModel):
    diagnosis_id: str
    confirmed: bool
    correction: Optional[dict] = None
