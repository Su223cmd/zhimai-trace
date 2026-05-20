import numpy as np
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import CDMParameter

logger = logging.getLogger(__name__)


class OnlineEM:
    def __init__(self, n_questions: int, n_knowledge_points: int, q_matrix: np.ndarray):
        self.n_questions = n_questions
        self.n_kp = n_knowledge_points
        self.q_matrix = q_matrix

        self.slip = np.full(n_questions, 0.2)
        self.guess = np.full(n_questions, 0.2)
        self.prior_alpha = np.full(n_knowledge_points, 0.5)

        self.sufficient_stats_s = np.zeros(n_questions)
        self.sufficient_stats_g = np.zeros(n_questions)
        self.sufficient_stats_n_master = np.zeros(n_questions)
        self.sufficient_stats_n_nonmaster = np.zeros(n_questions)
        self.sufficient_stats_alpha = np.zeros(n_knowledge_points)
        self.sufficient_stats_n_students = 0

        self.learning_rate = 0.1
        self.update_count = 0

    def save_to_db(self, db: Session, homework_id: str) -> dict:
        slip_dict = {str(j): float(self.slip[j]) for j in range(self.n_questions)}
        guess_dict = {str(j): float(self.guess[j]) for j in range(self.n_questions)}

        alpha_estimates = [[float(self.prior_alpha[k])] for k in range(self.n_kp)]

        existing = db.query(CDMParameter).filter(
            CDMParameter.homework_id == homework_id,
            CDMParameter.model_type == "online_em"
        ).first()

        if existing:
            existing.slip = slip_dict
            existing.guess = guess_dict
            existing.alpha = {
                "kp_codes": [f"KP{str(k).zfill(2)}" for k in range(self.n_kp)],
                "student_ids": ["online_em_pool"],
                "alpha_estimates": alpha_estimates,
                "prior_alpha": self.prior_alpha.tolist(),
            }
            existing.estimated_at = datetime.now()
            existing.convergence_status = f"updated_{self.update_count}"
        else:
            cdm = CDMParameter(
                homework_id=homework_id,
                model_type="online_em",
                slip=slip_dict,
                guess=guess_dict,
                alpha={
                    "kp_codes": [f"KP{str(k).zfill(2)}" for k in range(self.n_kp)],
                    "student_ids": ["online_em_pool"],
                    "alpha_estimates": alpha_estimates,
                    "prior_alpha": self.prior_alpha.tolist(),
                },
                aic=None,
                bic=None,
                convergence_status=f"updated_{self.update_count}",
                estimated_at=datetime.now(),
            )
            db.add(cdm)

        db.commit()
        logger.info("OnlineEM saved to DB for homework %s, update_count=%d", homework_id, self.update_count)
        return {"status": "success", "homework_id": str(homework_id), "update_count": self.update_count}

    @classmethod
    def load_from_db(cls, db: Session, homework_id: str, q_matrix: np.ndarray) -> Optional["OnlineEM"]:
        cdm = db.query(CDMParameter).filter(
            CDMParameter.homework_id == homework_id,
            CDMParameter.model_type == "online_em"
        ).order_by(CDMParameter.estimated_at.desc()).first()

        if not cdm:
            return None

        n_questions, n_kp = q_matrix.shape
        em = cls(n_questions, n_kp, q_matrix)

        slip_data = cdm.slip or {}
        guess_data = cdm.guess or {}

        if isinstance(slip_data, dict):
            for j in range(n_questions):
                key = str(j)
                if key in slip_data:
                    em.slip[j] = float(slip_data[key])
        elif isinstance(slip_data, list):
            for j in range(min(n_questions, len(slip_data))):
                em.slip[j] = float(slip_data[j])

        if isinstance(guess_data, dict):
            for j in range(n_questions):
                key = str(j)
                if key in guess_data:
                    em.guess[j] = float(guess_data[key])
        elif isinstance(guess_data, list):
            for j in range(min(n_questions, len(guess_data))):
                em.guess[j] = float(guess_data[j])

        alpha_data = cdm.alpha or {}
        prior = alpha_data.get("prior_alpha", [])
        if prior and len(prior) == n_kp:
            em.prior_alpha = np.array(prior)

        logger.info("OnlineEM loaded from DB for homework %s", homework_id)
        return em

    def eta(self, alpha: np.ndarray, q_row: np.ndarray) -> float:
        relevant = q_row * alpha
        return 1.0 if np.all(relevant == q_row) and np.sum(q_row) > 0 else 0.0

    def p_correct(self, alpha: np.ndarray, q_row: np.ndarray, j: int) -> float:
        e = self.eta(alpha, q_row)
        return (1 - self.slip[j]) * e + self.guess[j] * (1 - e)

    def e_step_single(self, response: np.ndarray) -> np.ndarray:
        n_patterns = 2 ** self.n_kp
        log_probs = np.zeros(n_patterns)

        for pattern_idx in range(n_patterns):
            alpha = np.array([(pattern_idx >> k) & 1 for k in range(self.n_kp)], dtype=float)
            log_prior = np.sum(np.log(np.where(alpha == 1, self.prior_alpha, 1 - self.prior_alpha) + 1e-10))

            log_lik = 0.0
            for j in range(self.n_questions):
                p = self.p_correct(alpha, self.q_matrix[j], j)
                if response[j] == 1:
                    log_lik += np.log(max(p, 1e-10))
                else:
                    log_lik += np.log(max(1 - p, 1e-10))

            log_probs[pattern_idx] = log_prior + log_lik

        max_log = np.max(log_probs)
        probs = np.exp(log_probs - max_log)
        probs /= np.sum(probs)

        posterior_alpha = np.zeros(self.n_kp)
        for pattern_idx in range(n_patterns):
            alpha = np.array([(pattern_idx >> k) & 1 for k in range(self.n_kp)], dtype=float)
            posterior_alpha += probs[pattern_idx] * alpha

        return posterior_alpha, probs

    def update_single(self, response: np.ndarray) -> dict:
        posterior_alpha, pattern_probs = self.e_step_single(response)

        for j in range(self.n_questions):
            p_master = 0.0
            p_nonmaster = 0.0
            for pattern_idx in range(len(pattern_probs)):
                alpha = np.array([(pattern_idx >> k) & 1 for k in range(self.n_kp)], dtype=float)
                e = self.eta(alpha, self.q_matrix[j])
                if e > 0.5:
                    p_master += pattern_probs[pattern_idx]
                    if response[j] == 0:
                        self.sufficient_stats_s[j] += pattern_probs[pattern_idx]
                else:
                    p_nonmaster += pattern_probs[pattern_idx]
                    if response[j] == 1:
                        self.sufficient_stats_g[j] += pattern_probs[pattern_idx]
                self.sufficient_stats_n_master[j] += pattern_probs[pattern_idx] * e
                self.sufficient_stats_n_nonmaster[j] += pattern_probs[pattern_idx] * (1 - e)

        self.sufficient_stats_alpha += posterior_alpha
        self.sufficient_stats_n_students += 1
        self.update_count += 1

        lr = self.learning_rate / (1 + 0.01 * self.update_count)

        new_slip = np.copy(self.slip)
        new_guess = np.copy(self.guess)
        for j in range(self.n_questions):
            if self.sufficient_stats_n_master[j] > 0:
                target_s = self.sufficient_stats_s[j] / max(self.sufficient_stats_n_master[j], 1e-10)
                new_slip[j] = self.slip[j] + lr * (target_s - self.slip[j])
            if self.sufficient_stats_n_nonmaster[j] > 0:
                target_g = self.sufficient_stats_g[j] / max(self.sufficient_stats_n_nonmaster[j], 1e-10)
                new_guess[j] = self.guess[j] + lr * (target_g - self.guess[j])

        new_slip = np.clip(new_slip, 0.01, 0.49)
        new_guess = np.clip(new_guess, 0.01, 0.49)
        for j in range(self.n_questions):
            if new_slip[j] + new_guess[j] >= 0.99:
                total = new_slip[j] + new_guess[j]
                new_slip[j] *= 0.98 / total
                new_guess[j] *= 0.98 / total

        new_prior = self.sufficient_stats_alpha / max(self.sufficient_stats_n_students, 3)
        self.prior_alpha = self.prior_alpha + lr * (new_prior - self.prior_alpha)

        delta_slip = float(np.max(np.abs(new_slip - self.slip)))
        delta_guess = float(np.max(np.abs(new_guess - self.guess)))

        self.slip = new_slip
        self.guess = new_guess

        return {
            "slip": self.slip.tolist(),
            "guess": self.guess.tolist(),
            "prior_alpha": self.prior_alpha.tolist(),
            "delta_slip": float(delta_slip),
            "delta_guess": float(delta_guess),
            "update_count": int(self.update_count),
            "significant_change": bool(delta_slip > 0.1 or delta_guess > 0.1),
        }

    def get_params(self) -> dict:
        return {
            "slip": self.slip.tolist(),
            "guess": self.guess.tolist(),
            "prior_alpha": self.prior_alpha.tolist(),
            "update_count": self.update_count,
            "n_students_processed": self.sufficient_stats_n_students,
        }


_online_em_instances: dict[str, OnlineEM] = {}


def get_online_em(homework_id: str, n_questions: int, n_kp: int, q_matrix: np.ndarray) -> OnlineEM:
    if homework_id not in _online_em_instances:
        _online_em_instances[homework_id] = OnlineEM(n_questions, n_kp, q_matrix)
    return _online_em_instances[homework_id]


def process_single_answer(
    homework_id: str,
    response: list[int],
    q_matrix: list[list[int]],
) -> dict:
    q_np = np.array(q_matrix)
    n_questions, n_kp = q_np.shape
    em = get_online_em(homework_id, n_questions, n_kp, q_np)
    response_np = np.array(response, dtype=float)
    return em.update_single(response_np)
