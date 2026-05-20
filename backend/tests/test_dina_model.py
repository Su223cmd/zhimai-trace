import numpy as np
import pytest
from app.services.dina_model import DINAModel, MAX_EXHAUSTIVE_KP


def _generate_synthetic_data(n_questions, n_kp, n_students, slip_true=None, guess_true=None):
    q_matrix = np.zeros((n_questions, n_kp), dtype=int)
    for j in range(n_questions):
        kp_indices = np.random.choice(n_kp, size=max(1, n_kp // 3), replace=False)
        q_matrix[j, kp_indices] = 1

    if slip_true is None:
        slip_true = np.random.uniform(0.05, 0.2, n_questions)
    if guess_true is None:
        guess_true = np.random.uniform(0.05, 0.2, n_questions)

    alpha_true = (np.random.rand(n_students, n_kp) > 0.5).astype(float)

    responses = np.zeros((n_students, n_questions), dtype=int)
    for i in range(n_students):
        for j in range(n_questions):
            eta = 1.0
            for k in range(n_kp):
                if q_matrix[j, k] == 1 and alpha_true[i, k] == 0:
                    eta = 0.0
                    break
            p_correct = (1 - slip_true[j]) * eta + guess_true[j] * (1 - eta)
            responses[i, j] = 1 if np.random.random() < p_correct else 0

    return q_matrix, responses, slip_true, guess_true, alpha_true


class TestDINABasics:
    def test_eta_all_mastered(self):
        q_matrix = np.array([[1, 1, 0], [0, 1, 1], [1, 1, 1]])
        model = DINAModel(n_questions=3, n_knowledge_points=3, q_matrix=q_matrix)
        alpha = np.array([1.0, 1.0, 1.0])
        eta = model.eta(alpha)
        np.testing.assert_array_equal(eta, np.array([1.0, 1.0, 1.0]))

    def test_eta_partial_mastery(self):
        q_matrix = np.array([[1, 1, 0], [0, 1, 1], [1, 1, 1]])
        model = DINAModel(n_questions=3, n_knowledge_points=3, q_matrix=q_matrix)
        alpha = np.array([1.0, 0.0, 1.0])
        eta = model.eta(alpha)
        assert eta[0] == 0.0
        assert eta[1] == 0.0
        assert eta[2] == 0.0

    def test_eta_empty_q_row(self):
        q_matrix = np.array([[0, 0], [1, 0]])
        model = DINAModel(n_questions=2, n_knowledge_points=2, q_matrix=q_matrix)
        alpha = np.array([1.0, 1.0])
        eta = model.eta(alpha)
        assert eta[0] == 1.0

    def test_p_correct_bounds(self):
        q_matrix = np.array([[1, 1]])
        model = DINAModel(n_questions=1, n_knowledge_points=2, q_matrix=q_matrix)
        model.slip = np.array([0.1])
        model.guess = np.array([0.2])

        alpha_mastered = np.array([1.0, 1.0])
        p = model.p_correct(alpha_mastered)
        assert abs(p[0] - 0.9) < 1e-6

        alpha_not_mastered = np.array([0.0, 1.0])
        p = model.p_correct(alpha_not_mastered)
        assert abs(p[0] - 0.2) < 1e-6

    def test_initial_parameters(self):
        q_matrix = np.ones((5, 3))
        model = DINAModel(n_questions=5, n_knowledge_points=3, q_matrix=q_matrix)
        np.testing.assert_array_equal(model.slip, np.full(5, 0.2))
        np.testing.assert_array_equal(model.guess, np.full(5, 0.2))
        np.testing.assert_array_equal(model.prior_alpha, np.full(3, 0.5))

    def test_disabled_sampling_for_small_kp(self):
        q_matrix = np.zeros((5, 3))
        model = DINAModel(n_questions=5, n_knowledge_points=3, q_matrix=q_matrix)
        assert model.use_sampling is False

    def test_enabled_sampling_for_large_kp(self):
        n_kp = MAX_EXHAUSTIVE_KP + 1
        q_matrix = np.zeros((5, n_kp))
        model = DINAModel(n_questions=5, n_knowledge_points=n_kp, q_matrix=q_matrix)
        assert model.use_sampling is True


class TestDINAEMExact:
    def test_em_converges(self):
        np.random.seed(42)
        slip_true = np.array([0.15, 0.1, 0.12, 0.08, 0.18])
        guess_true = np.array([0.22, 0.19, 0.25, 0.21, 0.17])
        q_matrix, responses, _, _, _ = _generate_synthetic_data(
            5, 3, 80, slip_true=slip_true, guess_true=guess_true
        )

        model = DINAModel(n_questions=5, n_knowledge_points=3, q_matrix=q_matrix)
        model.max_iter = 150
        model.tol = 1e-3
        result = model.fit(responses)

        assert result["iterations"] > 0
        assert result["method"] == "exact_em"
        assert result["log_likelihood"] < 0
        assert np.isfinite(result["aic"])

    def test_em_improves_log_likelihood(self):
        np.random.seed(42)
        q_matrix = np.array([[1, 1, 0], [0, 1, 1], [1, 1, 1], [1, 0, 0], [0, 0, 1]])
        slip_true = np.array([0.15, 0.1, 0.12, 0.08, 0.18])
        guess_true = np.array([0.22, 0.19, 0.25, 0.21, 0.17])
        _, responses, _, _, _ = _generate_synthetic_data(
            5, 3, 30, slip_true=slip_true, guess_true=guess_true
        )

        model = DINAModel(n_questions=5, n_knowledge_points=3, q_matrix=q_matrix)
        initial_ll = model.compute_log_likelihood(responses)
        result = model.fit(responses)
        final_ll = result["log_likelihood"]

        assert final_ll >= initial_ll, f"LL degraded: {initial_ll} -> {final_ll}"

    def test_em_single_student(self):
        np.random.seed(42)
        q_matrix = np.array([[1, 0], [0, 1], [1, 1]])
        slip_true = np.array([0.1, 0.1, 0.1])
        guess_true = np.array([0.2, 0.2, 0.2])
        _, responses, _, _, _ = _generate_synthetic_data(
            3, 2, 1, slip_true=slip_true, guess_true=guess_true
        )

        model = DINAModel(n_questions=3, n_knowledge_points=2, q_matrix=q_matrix)
        result = model.fit(responses)
        alpha = model.estimate_alpha(responses)

        assert result["converged"]
        assert alpha.shape == (1, 2)

    def test_em_all_correct(self):
        q_matrix = np.array([[1, 1], [0, 1]])
        responses = np.ones((10, 2), dtype=int)

        model = DINAModel(n_questions=2, n_knowledge_points=2, q_matrix=q_matrix)
        result = model.fit(responses)

        assert result["converged"]

    def test_em_all_wrong(self):
        q_matrix = np.array([[1, 1], [0, 1]])
        responses = np.zeros((10, 2), dtype=int)

        model = DINAModel(n_questions=2, n_knowledge_points=2, q_matrix=q_matrix)
        result = model.fit(responses)

        assert result["converged"]

    def test_log_likelihood_is_finite(self):
        np.random.seed(42)
        q_matrix, responses, _, _, _ = _generate_synthetic_data(5, 3, 20)

        model = DINAModel(n_questions=5, n_knowledge_points=3, q_matrix=q_matrix)
        ll = model.compute_log_likelihood(responses)

        assert np.isfinite(ll)


class TestDINAEMSampling:
    def test_sampling_mode_converges(self):
        np.random.seed(42)
        n_questions = 5
        n_kp = MAX_EXHAUSTIVE_KP + 1
        q_matrix = np.zeros((n_questions, n_kp), dtype=int)
        for j in range(n_questions):
            kp_indices = np.random.choice(n_kp, size=2, replace=False)
            q_matrix[j, kp_indices] = 1

        responses = np.random.binomial(1, 0.6, (20, n_questions))

        model = DINAModel(n_questions=n_questions, n_knowledge_points=n_kp, q_matrix=q_matrix)
        model.max_iter = 10
        assert model.use_sampling is True

        result = model.fit(responses)
        assert result["method"] == "monte_carlo_em"
        assert result["iterations"] > 0
        assert result["log_likelihood"] < 0

    def test_sampling_log_likelihood_is_finite(self):
        np.random.seed(42)
        n_questions = 5
        n_kp = MAX_EXHAUSTIVE_KP + 2
        q_matrix = np.zeros((n_questions, n_kp), dtype=int)
        for j in range(n_questions):
            kp_indices = np.random.choice(n_kp, size=2, replace=False)
            q_matrix[j, kp_indices] = 1

        responses = np.random.binomial(1, 0.6, (10, n_questions))

        model = DINAModel(n_questions=n_questions, n_knowledge_points=n_kp, q_matrix=q_matrix)
        ll = model.compute_log_likelihood(responses)

        assert np.isfinite(ll)

    def test_sampling_estimate_alpha_shape(self):
        np.random.seed(42)
        n_questions = 5
        n_kp = MAX_EXHAUSTIVE_KP + 1
        q_matrix = np.zeros((n_questions, n_kp), dtype=int)
        for j in range(n_questions):
            kp_indices = np.random.choice(n_kp, size=2, replace=False)
            q_matrix[j, kp_indices] = 1

        responses = np.random.binomial(1, 0.6, (10, n_questions))

        model = DINAModel(n_questions=n_questions, n_knowledge_points=n_kp, q_matrix=q_matrix)
        model.fit(responses)
        alpha = model.estimate_alpha(responses)

        assert alpha.shape == (10, n_kp)


class TestDINAParameterRecovery:
    def test_slip_recovery_with_clean_data(self):
        np.random.seed(42)
        slip_true = np.array([0.05, 0.1, 0.08])
        guess_true = np.array([0.3, 0.25, 0.28])
        q_matrix = np.array([[1, 1], [0, 1], [1, 0]])
        n_students = 120

        alpha_true = np.zeros((n_students, 2))
        for i in range(n_students):
            alpha_true[i, np.random.randint(2)] = 1.0
            if np.random.random() < 0.3:
                alpha_true[i, :] = 1.0

        responses = np.zeros((n_students, 3), dtype=int)
        for i in range(n_students):
            for j in range(3):
                eta = 1.0
                for k in range(2):
                    if q_matrix[j, k] == 1 and alpha_true[i, k] == 0:
                        eta = 0.0
                        break
                p_correct = (1 - slip_true[j]) * eta + guess_true[j] * (1 - eta)
                responses[i, j] = 1 if np.random.random() < p_correct else 0

        model = DINAModel(n_questions=3, n_knowledge_points=2, q_matrix=q_matrix)
        model.max_iter = 150
        model.tol = 1e-3
        result = model.fit(responses)

        recovered_slip = np.array(result["slip"])
        recovered_guess = np.array(result["guess"])

        slip_correlation = np.corrcoef(slip_true, recovered_slip)[0, 1]
        guess_correlation = np.corrcoef(guess_true, recovered_guess)[0, 1]

        assert slip_correlation > 0.15, f"Slip correlation too low: {slip_correlation}"
        assert guess_correlation > 0.15, f"Guess correlation too low: {guess_correlation}"

    def test_alpha_estimate_on_single_response(self):
        np.random.seed(42)
        q_matrix = np.array([[1, 1], [0, 1]])
        responses = np.array([[1, 1]])
        slip_true = np.array([0.05, 0.1])
        guess_true = np.array([0.2, 0.3])

        model = DINAModel(n_questions=2, n_knowledge_points=2, q_matrix=q_matrix)
        model.slip = slip_true
        model.guess = guess_true
        model.prior_alpha = np.array([0.5, 0.5])

        alpha = model.estimate_alpha(responses)
        assert alpha.shape == (1, 2)
        assert 0 <= alpha[0, 0] <= 1
        assert 0 <= alpha[0, 1] <= 1


class TestDINAEdgeCases:
    def test_kp_zero(self):
        q_matrix = np.zeros((3, 0))
        responses = np.array([[1, 0, 1], [0, 1, 0]])

        model = DINAModel(n_questions=3, n_knowledge_points=0, q_matrix=q_matrix)
        result = model.fit(responses)

        assert result["converged"]
        alpha = model.estimate_alpha(responses)
        assert alpha.shape == (2, 0)

    def test_single_question_single_kp(self):
        q_matrix = np.array([[1]])
        responses = np.array([[1], [0], [1], [1], [0], [1]])

        model = DINAModel(n_questions=1, n_knowledge_points=1, q_matrix=q_matrix)
        result = model.fit(responses)

        assert result["converged"]

    def test_deterministic_convergence_state(self):
        q_matrix = np.array([[1, 1], [0, 1], [1, 0]])
        responses = np.array([
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ])

        model = DINAModel(n_questions=3, n_knowledge_points=2, q_matrix=q_matrix)
        result = model.fit(responses)

        assert result["converged"]
        alpha = model.estimate_alpha(responses)
        assert alpha[0, :].mean() > alpha[4, :].mean()


class TestDINALargeKP:
    def test_boundary_at_max_exhaustive(self):
        n_kp = MAX_EXHAUSTIVE_KP
        q_matrix = np.zeros((3, n_kp), dtype=int)
        q_matrix[0, 0] = 1
        q_matrix[1, 0] = 1
        q_matrix[1, 1] = 1
        q_matrix[2, 1] = 1
        responses = np.random.binomial(1, 0.5, (5, 3))

        model = DINAModel(n_questions=3, n_knowledge_points=n_kp, q_matrix=q_matrix)
        model.max_iter = 5
        assert model.use_sampling is False

        result = model.fit(responses)
        assert result["iterations"] > 0

    def test_boundary_just_above_max_exhaustive(self):
        n_kp = MAX_EXHAUSTIVE_KP + 1
        q_matrix = np.zeros((3, n_kp), dtype=int)
        q_matrix[0, 0] = 1
        q_matrix[1, 0] = 1
        q_matrix[1, 1] = 1
        q_matrix[2, 1] = 1
        responses = np.random.binomial(1, 0.5, (5, 3))

        model = DINAModel(n_questions=3, n_knowledge_points=n_kp, q_matrix=q_matrix)
        model.max_iter = 5
        assert model.use_sampling is True

        result = model.fit(responses)
        assert result["method"] == "monte_carlo_em"