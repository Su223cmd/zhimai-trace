import numpy as np
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import CDMParameter, Homework, Question, StudentAnswer
import json
import uuid
import logging

logger = logging.getLogger(__name__)

MAX_EXHAUSTIVE_KP = 15
MC_SAMPLES = 5000


class DINAModel:
    def __init__(self, n_questions: int, n_knowledge_points: int, q_matrix: np.ndarray):
        self.n_questions = n_questions
        self.n_kp = n_knowledge_points
        self.q_matrix = q_matrix

        self.slip = np.full(n_questions, 0.2)
        self.guess = np.full(n_questions, 0.2)
        self.prior_alpha = np.full(n_knowledge_points, 0.5)

        self.max_iter = 100
        self.tol = 1e-4
        self.converged = False
        self.iterations = 0
        self.log_likelihood_history = []

        self.use_sampling = n_knowledge_points > MAX_EXHAUSTIVE_KP
        if self.use_sampling:
            logger.info("DINAModel: n_kp=%d > %d, using Monte Carlo EM with %d samples",
                        n_knowledge_points, MAX_EXHAUSTIVE_KP, MC_SAMPLES)

    def _all_patterns(self):
        n_patterns = 2 ** self.n_kp
        for i in range(n_patterns):
            yield np.array([(i >> k) & 1 for k in range(self.n_kp)], dtype=float)

    def _sample_patterns(self, n_samples: int) -> np.ndarray:
        patterns = np.zeros((n_samples, self.n_kp))
        for k in range(self.n_kp):
            patterns[:, k] = np.random.binomial(1, self.prior_alpha[k], n_samples)
        return patterns

    def _log_prior(self, alpha: np.ndarray) -> float:
        return np.sum(np.log(np.where(alpha == 1, self.prior_alpha, 1 - self.prior_alpha) + 1e-10))

    def eta(self, alpha: np.ndarray) -> np.ndarray:
        relevant = self.q_matrix * alpha[np.newaxis, :]
        return (np.sum(relevant, axis=1) == np.sum(self.q_matrix, axis=1)).astype(float)

    def p_correct(self, alpha: np.ndarray) -> np.ndarray:
        e = self.eta(alpha)
        return (1 - self.slip) * e + self.guess * (1 - e)

    def e_step(self, responses: np.ndarray) -> np.ndarray:
        n_students = responses.shape[0]

        if self.use_sampling:
            return self._e_step_sampling(responses)
        else:
            return self._e_step_exact(responses)

    def _e_step_exact(self, responses: np.ndarray) -> np.ndarray:
        n_students = responses.shape[0]
        n_patterns = 2 ** self.n_kp
        log_posteriors = np.zeros((n_students, n_patterns))

        for pattern_idx in range(n_patterns):
            alpha = np.array([(pattern_idx >> k) & 1 for k in range(self.n_kp)], dtype=float)
            log_prior = self._log_prior(alpha)
            p = self.p_correct(alpha)
            log_lik = np.sum(responses * np.log(p + 1e-10) + (1 - responses) * np.log(1 - p + 1e-10), axis=1)
            log_posteriors[:, pattern_idx] = log_prior + log_lik

        max_log = np.max(log_posteriors, axis=1, keepdims=True)
        log_posteriors -= max_log
        posteriors = np.exp(log_posteriors)
        posteriors /= np.sum(posteriors, axis=1, keepdims=True)

        return posteriors

    def _e_step_sampling(self, responses: np.ndarray) -> np.ndarray:
        n_students = responses.shape[0]
        patterns = self._sample_patterns(MC_SAMPLES)
        n_samples = patterns.shape[0]

        log_posteriors = np.zeros((n_students, n_samples))

        for s in range(n_samples):
            alpha = patterns[s]
            log_prior = self._log_prior(alpha)
            p = self.p_correct(alpha)
            log_lik = np.sum(responses * np.log(p + 1e-10) + (1 - responses) * np.log(1 - p + 1e-10), axis=1)
            log_posteriors[:, s] = log_prior + log_lik

        max_log = np.max(log_posteriors, axis=1, keepdims=True)
        log_posteriors -= max_log
        posteriors = np.exp(log_posteriors)
        posteriors /= np.sum(posteriors, axis=1, keepdims=True)

        self._sampled_patterns = patterns
        return posteriors

    def m_step(self, responses: np.ndarray, posteriors: np.ndarray) -> float:
        if self.use_sampling:
            return self._m_step_sampling(responses, posteriors)
        else:
            return self._m_step_exact(responses, posteriors)

    def _m_step_exact(self, responses: np.ndarray, posteriors: np.ndarray) -> float:
        n_students = responses.shape[0]
        n_patterns = posteriors.shape[1]

        new_slip = np.zeros(self.n_questions)
        new_guess = np.zeros(self.n_questions)
        new_prior = np.zeros(self.n_kp)

        master_count = np.zeros(self.n_questions)
        nonmaster_count = np.zeros(self.n_questions)

        for pattern_idx in range(n_patterns):
            alpha = np.array([(pattern_idx >> k) & 1 for k in range(self.n_kp)], dtype=float)
            e = self.eta(alpha)
            post = posteriors[:, pattern_idx]

            for j in range(self.n_questions):
                if e[j] > 0.5:
                    new_slip[j] += np.sum(post * (1 - responses[:, j]))
                else:
                    new_guess[j] += np.sum(post * responses[:, j])

            for k in range(self.n_kp):
                new_prior[k] += np.sum(post) * alpha[k]

            post_sum = np.sum(post)
            master_count += post_sum * e
            nonmaster_count += post_sum * (1 - e)

        new_slip = np.clip(new_slip / np.maximum(master_count, 1e-10), 0.01, 0.49)
        new_guess = np.clip(new_guess / np.maximum(nonmaster_count, 1e-10), 0.01, 0.49)

        for j in range(self.n_questions):
            if new_slip[j] + new_guess[j] >= 0.99:
                total = new_slip[j] + new_guess[j]
                new_slip[j] *= 0.98 / total
                new_guess[j] *= 0.98 / total

        new_prior = new_prior / n_students

        delta = max(np.max(np.abs(new_slip - self.slip)), np.max(np.abs(new_guess - self.guess)))

        self.slip = new_slip
        self.guess = new_guess
        self.prior_alpha = new_prior

        return delta

    def _m_step_sampling(self, responses: np.ndarray, posteriors: np.ndarray) -> float:
        n_students = responses.shape[0]
        patterns = self._sampled_patterns
        n_samples = patterns.shape[0]

        new_slip = np.zeros(self.n_questions)
        new_guess = np.zeros(self.n_questions)
        new_prior = np.zeros(self.n_kp)

        master_total = np.zeros(self.n_questions)
        nonmaster_total = np.zeros(self.n_questions)

        for s in range(n_samples):
            alpha = patterns[s]
            e = self.eta(alpha)
            post = posteriors[:, s]
            post_sum = np.sum(post)

            for j in range(self.n_questions):
                if e[j] > 0.5:
                    new_slip[j] += np.sum(post * (1 - responses[:, j]))
                    master_total[j] += post_sum
                else:
                    new_guess[j] += np.sum(post * responses[:, j])
                    nonmaster_total[j] += post_sum

            for k in range(self.n_kp):
                new_prior[k] += post_sum * alpha[k]

        new_slip = np.clip(new_slip / np.maximum(master_total, 1e-10), 0.01, 0.49)
        new_guess = np.clip(new_guess / np.maximum(nonmaster_total, 1e-10), 0.01, 0.49)

        for j in range(self.n_questions):
            if new_slip[j] + new_guess[j] >= 0.99:
                total = new_slip[j] + new_guess[j]
                new_slip[j] *= 0.98 / total
                new_guess[j] *= 0.98 / total

        new_prior = new_prior / n_students

        delta = max(np.max(np.abs(new_slip - self.slip)), np.max(np.abs(new_guess - self.guess)))

        self.slip = new_slip
        self.guess = new_guess
        self.prior_alpha = new_prior

        return delta

    def compute_log_likelihood(self, responses: np.ndarray) -> float:
        if self.use_sampling:
            return self._compute_ll_sampling(responses)
        else:
            return self._compute_ll_exact(responses)

    def _compute_ll_exact(self, responses: np.ndarray) -> float:
        n_students = responses.shape[0]
        n_patterns = 2 ** self.n_kp
        total_ll = 0.0

        for i in range(n_students):
            student_ll = -np.inf
            for pattern_idx in range(n_patterns):
                alpha = np.array([(pattern_idx >> k) & 1 for k in range(self.n_kp)], dtype=float)
                log_prior = self._log_prior(alpha)
                p = self.p_correct(alpha)
                log_lik = np.sum(responses[i] * np.log(p + 1e-10) + (1 - responses[i]) * np.log(1 - p + 1e-10))
                student_ll = np.logaddexp(student_ll, log_prior + log_lik)
            total_ll += student_ll

        return total_ll

    def _compute_ll_sampling(self, responses: np.ndarray) -> float:
        n_students = responses.shape[0]
        patterns = self._sample_patterns(MC_SAMPLES * 2)
        n_samples = patterns.shape[0]
        total_ll = 0.0

        for i in range(n_students):
            student_ll = -np.inf
            for s in range(n_samples):
                alpha = patterns[s]
                log_prior = self._log_prior(alpha)
                p = self.p_correct(alpha)
                log_lik = np.sum(responses[i] * np.log(p + 1e-10) + (1 - responses[i]) * np.log(1 - p + 1e-10))
                student_ll = np.logaddexp(student_ll, log_prior + log_lik)
            student_ll -= np.log(n_samples)
            total_ll += student_ll

        return total_ll

    def fit(self, responses: np.ndarray) -> dict:
        for iteration in range(self.max_iter):
            posteriors = self.e_step(responses)
            delta = self.m_step(responses, posteriors)
            self.iterations = iteration + 1

            if iteration % 10 == 0:
                ll = self.compute_log_likelihood(responses)
                self.log_likelihood_history.append(ll)

            if delta < self.tol:
                self.converged = True
                break

        ll = self.compute_log_likelihood(responses)
        self.log_likelihood_history.append(ll)

        n_params = self.n_questions * 2 + self.n_kp
        n = responses.shape[0] * responses.shape[1]
        aic = -2 * ll + 2 * n_params
        bic = -2 * ll + n_params * np.log(n)

        return {
            "converged": self.converged,
            "iterations": self.iterations,
            "slip": self.slip.tolist(),
            "guess": self.guess.tolist(),
            "prior_alpha": self.prior_alpha.tolist(),
            "aic": float(aic),
            "bic": float(bic),
            "log_likelihood": float(ll),
            "method": "monte_carlo_em" if self.use_sampling else "exact_em",
        }

    def estimate_alpha(self, responses: np.ndarray) -> np.ndarray:
        if self.use_sampling:
            return self._estimate_alpha_sampling(responses)
        else:
            return self._estimate_alpha_exact(responses)

    def _estimate_alpha_exact(self, responses: np.ndarray) -> np.ndarray:
        posteriors = self.e_step(responses)
        n_students = responses.shape[0]
        n_patterns = posteriors.shape[1]

        alpha_estimates = np.zeros((n_students, self.n_kp))
        for pattern_idx in range(n_patterns):
            alpha = np.array([(pattern_idx >> k) & 1 for k in range(self.n_kp)], dtype=float)
            alpha_estimates += posteriors[:, pattern_idx:pattern_idx+1] * alpha[np.newaxis, :]

        return alpha_estimates

    def _estimate_alpha_sampling(self, responses: np.ndarray) -> np.ndarray:
        posteriors = self.e_step(responses)
        patterns = self._sampled_patterns
        n_students = responses.shape[0]
        n_samples = patterns.shape[0]

        alpha_estimates = np.zeros((n_students, self.n_kp))
        for s in range(n_samples):
            alpha_estimates += posteriors[:, s:s+1] * patterns[s:s+1, :]

        return alpha_estimates


def run_cdm_estimation(db: Session, homework_id: str) -> dict:
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        return {"status": "error", "message": "作业不存在"}

    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    if not questions:
        return {"status": "error", "message": "作业没有题目"}

    has_q_matrix = any(q.q_matrix for q in questions)
    if not has_q_matrix:
        return {"status": "error", "message": "请先生成并确认Q矩阵"}

    answers = db.query(StudentAnswer).filter(StudentAnswer.homework_id == homework_id).all()
    if not answers:
        return {"status": "error", "message": "没有学生答题数据"}

    kp_codes = list(questions[0].q_matrix.keys()) if questions[0].q_matrix else []
    for q in questions:
        if q.q_matrix:
            for k in q.q_matrix.keys():
                if k not in kp_codes:
                    kp_codes.append(k)

    n_questions = len(questions)
    n_kp = len(kp_codes)
    q_matrix = np.zeros((n_questions, n_kp), dtype=int)
    for i, q in enumerate(questions):
        if q.q_matrix:
            for kp_code, val in q.q_matrix.items():
                if kp_code in kp_codes:
                    q_matrix[i][kp_codes.index(kp_code)] = int(val)

    students = {}
    for a in answers:
        if a.student_id not in students:
            students[a.student_id] = {}
        students[a.student_id][str(a.question_id)] = 1 if a.is_correct else 0

    student_ids = sorted(students.keys())
    n_students = len(student_ids)

    question_ids = [str(q.id) for q in questions]
    responses = np.zeros((n_students, n_questions))
    for i, sid in enumerate(student_ids):
        for j, qid in enumerate(question_ids):
            responses[i][j] = students[sid].get(qid, 0)

    model = DINAModel(n_questions, n_kp, q_matrix)
    fit_result = model.fit(responses)

    alpha_estimates = model.estimate_alpha(responses)

    cdm_params = CDMParameter(
        homework_id=homework_id,
        model_type="DINA",
        slip=fit_result["slip"],
        guess=fit_result["guess"],
        alpha={"kp_codes": kp_codes, "student_ids": student_ids, "alpha_estimates": alpha_estimates.tolist()},
        aic=fit_result["aic"],
        bic=fit_result["bic"],
        convergence_status="converged" if fit_result["converged"] else "not_converged",
    )
    db.add(cdm_params)

    if hw:
        hw.status = "cdm_estimated"
    db.commit()
    db.refresh(cdm_params)

    return {
        "status": "success",
        "cdm_params_id": str(cdm_params.id),
        "model_type": "DINA",
        "method": fit_result.get("method", "exact_em"),
        "converged": fit_result["converged"],
        "iterations": fit_result["iterations"],
        "n_students": n_students,
        "n_questions": n_questions,
        "n_knowledge_points": n_kp,
        "kp_codes": kp_codes,
        "aic": fit_result["aic"],
        "bic": fit_result["bic"],
    }