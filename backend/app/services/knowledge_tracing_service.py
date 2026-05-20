import numpy as np
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import DiagnosisSession, CDMParameter

logger = logging.getLogger(__name__)


class BKTModel:
    def __init__(self, n_knowledge_points: int):
        self.n_kp = n_knowledge_points
        self.P_L0 = np.full(n_knowledge_points, 0.1)
        self.P_T = np.full(n_knowledge_points, 0.1)
        self.P_G = np.full(n_knowledge_points, 0.2)
        self.P_S = np.full(n_knowledge_points, 0.1)

    def fit_em(
        self,
        observations: np.ndarray,
        max_iters: int = 50,
        tol: float = 1e-4,
    ) -> dict:
        n_students, n_questions = observations.shape
        n_kp = self.n_kp

        prev_ll = -1e10
        for iteration in range(max_iters):
            P_L0_new = np.zeros(n_kp)
            P_T_num = np.zeros(n_kp)
            P_T_den = np.zeros(n_kp)
            P_G_num = np.zeros(n_kp)
            P_G_den = np.zeros(n_kp)
            P_S_num = np.zeros(n_kp)
            P_S_den = np.zeros(n_kp)
            total_ll = 0.0

            for i in range(n_students):
                forward_probs = np.zeros(n_questions)
                P_L = self.P_L0.copy()

                for j in range(n_questions):
                    obs = observations[i, j]
                    for k in range(n_kp):
                        P_correct = P_L[k] * (1 - self.P_S[k]) + (1 - P_L[k]) * self.P_G[k]

                        if obs == 1:
                            p_obs = P_correct
                        else:
                            p_obs = 1 - P_correct

                        if j == 0:
                            forward_probs[j] = np.prod([P_L[m] * (1 - self.P_S[m]) + (1 - P_L[m]) * self.P_G[m] if obs == 1 else 1 - (P_L[m] * (1 - self.P_S[m]) + (1 - P_L[m]) * self.P_G[m]) for m in range(n_kp)])

                        P_L_given_obs = P_L[k]
                        if P_correct > 1e-10:
                            if obs == 1:
                                P_L_given_obs = self.P_L[k] * (1 - self.P_S[k]) / P_correct
                            else:
                                P_L_given_obs = self.P_L[k] * self.P_S[k] / max(1 - P_correct, 1e-10)

                        P_L_next = P_L_given_obs + (1 - P_L_given_obs) * self.P_T[k]

                        P_L0_new[k] += P_L[k] * (1 - P_correct if obs == 0 else P_correct) / max(P_correct if obs == 1 else 1 - P_correct, 1e-10)

                        P_T_den[k] += 1 - P_L[k]
                        P_T_num[k] += P_L_next - P_L[k]

                        if P_correct > 1e-10:
                            P_G_num[k] += obs * (1 - P_L[k])
                            P_G_den[k] += 1 - P_L[k]
                            P_S_num[k] += (1 - obs) * P_L[k]
                            P_S_den[k] += P_L[k]

                        P_L[k] = P_L_next

            for k in range(n_kp):
                self.P_L0[k] = max(0.01, min(0.99, P_L0_new[k] / max(n_students, 1)))
                if P_T_den[k] > 0:
                    self.P_T[k] = max(0.01, min(0.5, P_T_num[k] / max(P_T_den[k], 1)))
                if P_G_den[k] > 0:
                    self.P_G[k] = max(0.01, min(0.5, P_G_num[k] / max(P_G_den[k], 1)))
                if P_S_den[k] > 0:
                    self.P_S[k] = max(0.01, min(0.5, P_S_num[k] / max(P_S_den[k], 1)))

            if abs(total_ll - prev_ll) < tol:
                logger.info("BKT EM converged at iteration %d, LL=%.4f", iteration + 1, total_ll)
                break
            prev_ll = total_ll

        return {
            "P_L0": self.P_L0.tolist(),
            "P_T": self.P_T.tolist(),
            "P_G": self.P_G.tolist(),
            "P_S": self.P_S.tolist(),
            "converged": True,
        }

    def predict(self, observations: np.ndarray) -> np.ndarray:
        n_students, n_questions = observations.shape
        n_kp = self.n_kp
        mastery_trajectory = np.zeros((n_students, n_kp))

        for i in range(n_students):
            P_L = self.P_L0.copy()
            for j in range(n_questions):
                for k in range(n_kp):
                    P_correct = P_L[k] * (1 - self.P_S[k]) + (1 - P_L[k]) * self.P_G[k]
                    if observations[i, j] == 1:
                        P_L_given_obs = P_correct * P_L[k] / max(P_correct, 1e-10)
                    else:
                        P_not_correct = 1 - P_correct
                        P_L_given_obs = (1 - self.P_S[k]) * P_L[k] / max(P_not_correct, 1e-10) if P_not_correct > 0 else P_L[k]
                    P_L[k] = P_L_given_obs + (1 - P_L_given_obs) * self.P_T[k]
            mastery_trajectory[i] = P_L

        return mastery_trajectory

    def estimate_learning_rate(self, observations: np.ndarray) -> np.ndarray:
        n_students = observations.shape[0]
        n_kp = self.n_kp
        learning_rates = np.zeros((n_students, n_kp))

        for i in range(n_students):
            P_L = self.P_L0.copy()
            prev_mastery = P_L.copy()
            for j in range(observations.shape[1]):
                for k in range(n_kp):
                    P_correct = P_L[k] * (1 - self.P_S[k]) + (1 - P_L[k]) * self.P_G[k]
                    if observations[i, j] == 1:
                        P_L_given_obs = P_correct * P_L[k] / max(P_correct, 1e-10)
                    else:
                        P_not_correct = 1 - P_correct
                        P_L_given_obs = (1 - self.P_S[k]) * P_L[k] / max(P_not_correct, 1e-10) if P_not_correct > 0 else P_L[k]
                    P_L[k] = P_L_given_obs + (1 - P_L_given_obs) * self.P_T[k]
                delta = P_L - prev_mastery
                learning_rates[i] = np.maximum(learning_rates[i], delta)
                prev_mastery = P_L.copy()

        return learning_rates

    def predict_mastery_time(self, current_mastery: np.ndarray, target: float = 0.8) -> np.ndarray:
        steps = np.zeros(self.n_kp)
        for k in range(self.n_kp):
            P_L = current_mastery[k]
            step = 0
            while P_L < target and step < 100:
                P_L = P_L + (1 - P_L) * self.P_T[k]
                step += 1
            steps[k] = step
        return steps

    def forgetting_curve(self, current_mastery: np.ndarray, time_steps: int = 30) -> np.ndarray:
        decay_rate = 0.02
        curves = np.zeros((self.n_kp, time_steps))
        for k in range(self.n_kp):
            for t in range(time_steps):
                curves[k, t] = current_mastery[k] * np.exp(-decay_rate * t)
        return curves


def create_diagnosis_session(
    db: Session,
    homework_id: str,
    student_id: str,
    knowledge_state: dict,
    cdm_params_id: Optional[str] = None,
    kt_prediction: Optional[dict] = None,
    learning_rate: Optional[dict] = None,
    forgetting_curve: Optional[dict] = None,
    mastery_time_prediction: Optional[dict] = None,
) -> DiagnosisSession:
    session = DiagnosisSession(
        homework_id=homework_id,
        student_id=student_id,
        knowledge_state_snapshot=knowledge_state,
        cdm_params_ref=cdm_params_id,
        kt_prediction=kt_prediction,
        learning_rate=learning_rate,
        forgetting_curve=forgetting_curve,
        mastery_time_prediction=mastery_time_prediction,
        session_timestamp=datetime.now(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_student_mastery_trajectory(db: Session, student_id: str) -> list[dict]:
    sessions = db.query(DiagnosisSession).filter(
        DiagnosisSession.student_id == student_id
    ).order_by(DiagnosisSession.session_timestamp).all()

    trajectory = []
    for s in sessions:
        snapshot = s.knowledge_state_snapshot or {}
        trajectory.append({
            "session_id": str(s.id),
            "homework_id": str(s.homework_id),
            "timestamp": s.session_timestamp.isoformat() if s.session_timestamp else None,
            "knowledge_state": snapshot,
            "kt_prediction": s.kt_prediction,
            "learning_rate": s.learning_rate,
        })
    return trajectory
