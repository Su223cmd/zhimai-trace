# TEST-STRATEGY.md — AI认知诊断引擎 测试策略

> CDM模型质量测试是本项目的核心测试层，不是"看起来对但跑不通"
> LLM是工具，CDM是引擎——测试重点在引擎

---

## 1. 四层测试架构

```
┌─────────────────────────────────────────────┐
│  第1层: E2E测试 (Playwright)                 │  ← 端到端用户流程
│  数量: 5个核心流程                            │
├─────────────────────────────────────────────┤
│  第2层: API集成测试 (pytest + httpx)          │  ← API接口+数据库
│  数量: 每个API至少2个用例                      │
├─────────────────────────────────────────────┤
│  第3层: CDM模型质量测试 (pytest + NumPy)      │  ← 核心！模型正确性
│  DINA收敛 / 参数恢复 / Q矩阵精度 / 诊断准确率  │
│  反事实预测 / 模型比较                         │
├─────────────────────────────────────────────┤
│  第4层: 单元测试 (pytest)                     │  ← 纯逻辑函数
│  数量: 核心函数100%覆盖                        │
└─────────────────────────────────────────────┘
```

---

## 2. 第1层: E2E测试 (Playwright)

### 5个核心流程

```python
# e2e/test_core_flows.py

async def test_flow_1_courseware_to_graph(page):
    """流程1: 课件上传→解析→课标对齐→图谱构建"""
    await page.goto("/courseware")
    await page.set_input_files("input[type=file]", "test_fixtures/地理大气环流.pptx")
    await page.click("text=上传")
    await page.wait_for_selector("text=解析完成")
    await page.click("text=对齐课标")
    await page.wait_for_selector("text=对齐完成")
    await page.goto("/knowledge-graph")
    await page.wait_for_selector(".g6-graph-canvas")
    nodes = await page.query_selector_all(".g6-node")
    assert len(nodes) > 0

async def test_flow_2_homework_to_qmatrix(page):
    """流程2: 作业导入→Q矩阵生成→教师审核"""
    await page.goto("/homework")
    await page.click("text=创建作业")
    await page.fill("#title", "期中测试")
    await page.set_input_files("input[type=file]", "test_fixtures/期中测试成绩.xlsx")
    await page.click("text=导入")
    await page.wait_for_selector("text=导入成功")
    await page.click("text=生成Q矩阵")
    await page.wait_for_selector(".q-matrix-table")
    await page.click("text=确认Q矩阵")
    await page.wait_for_selector("text=Q矩阵已锁定")

async def test_flow_3_cdm_diagnosis(page):
    """流程3: CDM诊断→知识状态→根因推断"""
    await page.goto("/homework/1")
    await page.click("text=开始诊断")
    await page.wait_for_selector("text=诊断完成", timeout=30000)
    await page.click("text=查看诊断")
    knowledge_state = await page.query_selector(".knowledge-state-vector")
    assert knowledge_state is not None
    root_cause = await page.query_selector(".root-cause-card")
    assert root_cause is not None

async def test_flow_4_counterfactual_and_feedback(page):
    """流程4: 反事实预测→教师修正→参数更新"""
    await page.goto("/diagnosis/1")
    counterfactual = await page.query_selector(".counterfactual-panel")
    assert counterfactual is not None
    await page.click("text=修正")
    await page.select_option("#corrected-root-cause", "kp02")
    await page.fill("#reason", "根因应为降水特征辨析")
    await page.click("text=提交修正")
    await page.wait_for_selector("text=参数已更新")

async def test_flow_5_class_aggregation(page):
    """流程5: 班级聚合→学生分组→教学建议"""
    await page.goto("/homework/1/class-diagnosis")
    await page.wait_for_selector(".root-cause-ranking")
    await page.wait_for_selector(".student-group-card")
    await page.click("text=生成教学建议")
    await page.wait_for_selector(".teaching-suggestion")
    suggestion_text = await page.text_content(".teaching-suggestion")
    assert "掌握率" in suggestion_text
    assert "课件" in suggestion_text
```

---

## 3. 第2层: API集成测试 (pytest + httpx)

### 课件管理API

```python
# tests/integration/test_courseware_api.py

def test_upload_courseware(client):
    with open("test_fixtures/地理大气环流.pptx", "rb") as f:
        resp = client.post("/api/courseware/", files={"file": f})
    assert resp.status_code == 200
    assert resp.json()["id"] is not None
    assert resp.json()["status"] == "uploaded"

def test_parse_courseware(client, courseware_id):
    resp = client.post(f"/api/courseware/{courseware_id}/parse")
    assert resp.status_code == 200
    kps = resp.json()["knowledge_points"]
    assert len(kps) > 0
    assert all("name" in kp for kp in kps)
    assert all("cognitive_level" in kp for kp in kps)
    assert all("page" in kp for kp in kps)
```

### 课程标准+图谱API

```python
# tests/integration/test_curriculum_api.py

def test_import_curriculum(client):
    with open("test_fixtures/地理课标.json", "r") as f:
        resp = client.post("/api/curriculum/import", json=json.load(f))
    assert resp.status_code == 200
    assert resp.json()["node_count"] > 0
    assert resp.json()["edge_count"] > 0

def test_align_courseware(client, courseware_id, curriculum_id):
    resp = client.post("/api/curriculum/align", json={
        "courseware_id": courseware_id
    })
    assert resp.status_code == 200
    aligned = resp.json()["aligned_count"]
    custom = resp.json()["custom_count"]
    assert aligned + custom > 0

def test_get_knowledge_graph(client):
    resp = client.get("/api/knowledge/graph")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["nodes"]) > 0
    assert len(data["edges"]) > 0
    node_types = set(n["entity_type"] for n in data["nodes"])
    assert len(node_types) >= 3

def test_trace_prerequisite(client):
    resp = client.get("/api/knowledge/kp04/trace")
    assert resp.status_code == 200
    path = resp.json()["path"]
    assert len(path) > 0
    for node in path:
        assert "id" in node
        assert "name" in node
        assert "mastery_rate" in node
```

### 作业数据API

```python
# tests/integration/test_homework_api.py

def test_import_homework(client, homework_id):
    with open("test_fixtures/期中测试成绩.xlsx", "rb") as f:
        resp = client.post(f"/api/homework/{homework_id}/import", files={"file": f})
    assert resp.status_code == 200
    assert resp.json()["imported_students"] > 0
    assert resp.json()["imported_items"] > 0

def test_homework_results(client, homework_id):
    resp = client.get(f"/api/homework/{homework_id}/results")
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) > 0
    for r in results:
        assert "student_id" in r
        assert "answers" in r
        for a in r["answers"]:
            assert "score" in a
            assert "is_correct" in a
```

### Q矩阵API

```python
# tests/integration/test_qmatrix_api.py

def test_generate_q_matrix(client, homework_id):
    resp = client.post(f"/api/homework/{homework_id}/q-matrix/generate")
    assert resp.status_code == 200
    q_matrix = resp.json()["q_matrix"]
    assert len(q_matrix) > 0
    for item in q_matrix:
        assert "question_id" in item
        assert "knowledge_mappings" in item
        for km in item["knowledge_mappings"]:
            assert "knowledge_id" in km
            assert "weight" in km

def test_update_q_matrix(client, homework_id):
    resp = client.put(f"/api/homework/{homework_id}/q-matrix", json={
        "updates": [
            {
                "question_id": "q1",
                "knowledge_mappings": [
                    {"knowledge_id": "kp01", "weight": 0.7},
                    {"knowledge_id": "kp02", "weight": 0.3}
                ]
            }
        ]
    })
    assert resp.status_code == 200

def test_validate_q_matrix(client, homework_id):
    resp = client.post(f"/api/homework/{homework_id}/q-matrix/validate")
    assert resp.status_code == 200
    anomalies = resp.json()["anomalies"]
    for a in anomalies:
        assert "question_id" in a
        assert "reason" in a
```

### CDM诊断API

```python
# tests/integration/test_cdm_api.py

def test_estimate_cdm(client, homework_id):
    resp = client.post("/api/cdm/estimate", json={
        "homework_id": homework_id
    })
    assert resp.status_code == 200
    task_id = resp.json()["task_id"]
    import time
    for _ in range(30):
        status = client.get(f"/api/cdm/status?task_id={task_id}").json()
        if status["status"] == "completed":
            break
        time.sleep(1)
    assert status["status"] == "completed"

def test_get_cdm_params(client, homework_id):
    resp = client.get(f"/api/cdm/params?homework_id={homework_id}")
    assert resp.status_code == 200
    params = resp.json()
    assert "slip_params" in params
    assert "guess_params" in params
    assert "knowledge_state_probs" in params
    for s in params["slip_params"].values():
        assert 0 <= s <= 1
    for g in params["guess_params"].values():
        assert 0 <= g <= 1

def test_get_diagnosis(client, homework_id, student_id):
    resp = client.get(f"/api/diagnosis/student/{student_id}?homework_id={homework_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "knowledge_state" in data
    assert "root_causes" in data
    for rc in data["root_causes"]:
        assert "root_cause_kp_id" in rc
        assert "trace_path" in rc
        assert "confidence" in rc
```

### 反事实+参数更新API

```python
# tests/integration/test_counterfactual_api.py

def test_get_counterfactual(client, knowledge_id):
    resp = client.get(f"/api/knowledge/{knowledge_id}/counterfactual")
    assert resp.status_code == 200
    data = resp.json()
    assert "predictions" in data
    for p in data["predictions"]:
        assert "current_rate" in p
        assert "improvement" in p
        assert "reliable" in p

def test_confirm_diagnosis_and_update_params(client, diagnosis_id):
    old_params = client.get("/api/cdm/params").json()
    resp = client.post("/api/diagnosis/confirm", json={
        "diagnosis_id": diagnosis_id,
        "confirmed": False,
        "correction": {
            "root_cause_kp_id": "kp02",
            "knowledge_id": "kp02",
            "mastered": True,
            "reason": "该学生实际掌握了等值线判读"
        }
    })
    assert resp.status_code == 200
    new_params = client.get("/api/cdm/params").json()
    assert new_params != old_params
```

---

## 4. 第3层: CDM模型质量测试 ← 核心

### 4.1 DINA模型收敛测试

```python
# tests/cdm_quality/test_dina_convergence.py

import numpy as np
from app.services.dina_model import DINAModel

def test_em_convergence_with_synthetic_data():
    """EM算法在合成数据上必须收敛"""
    np.random.seed(42)
    N, J, K = 100, 20, 5
    true_slip = np.random.uniform(0.05, 0.2, J)
    true_guess = np.random.uniform(0.05, 0.2, J)
    true_alpha = np.random.binomial(1, 0.5, (N, K))
    Q = np.random.binomial(1, 0.3, (J, K))
    for j in range(J):
        if Q[j].sum() == 0:
            Q[j, np.random.randint(K)] = 1

    eta = np.ones((N, J))
    for i in range(N):
        for j in range(J):
            for k in range(K):
                if Q[j, k] == 1 and true_alpha[i, k] == 0:
                    eta[i, j] = 0

    P_correct = (1 - true_slip) * eta + true_guess * (1 - eta)
    X = np.random.binomial(1, P_correct)

    model = DINAModel()
    result = model.fit(X, Q, max_iter=500, tol=1e-6)

    assert result["converged"] is True
    assert result["iterations"] < 500
    assert result["log_likelihood"] is not None

def test_em_convergence_small_sample():
    """小样本(10人)也能收敛"""
    np.random.seed(42)
    N, J, K = 10, 10, 3
    true_slip = np.full(J, 0.1)
    true_guess = np.full(J, 0.15)
    true_alpha = np.random.binomial(1, 0.5, (N, K))
    Q = np.random.binomial(1, 0.4, (J, K))
    for j in range(J):
        if Q[j].sum() == 0:
            Q[j, np.random.randint(K)] = 1

    eta = np.ones((N, J))
    for i in range(N):
        for j in range(J):
            for k in range(K):
                if Q[j, k] == 1 and true_alpha[i, k] == 0:
                    eta[i, j] = 0

    P_correct = (1 - true_slip) * eta + true_guess * (1 - eta)
    X = np.random.binomial(1, P_correct)

    model = DINAModel()
    result = model.fit(X, Q, max_iter=500, tol=1e-6)
    assert result["converged"] is True

def test_em_non_convergence_fallback():
    """不收敛时降级到IRT"""
    np.random.seed(42)
    N, J, K = 50, 20, 8
    X = np.random.binomial(1, 0.5, (N, J))
    Q = np.random.binomial(1, 0.5, (J, K))

    model = DINAModel()
    result = model.fit(X, Q, max_iter=500, tol=1e-6)
    if not result["converged"]:
        assert result["fallback"] == "IRT"
        assert result["warning"] == "诊断精度降低"
```

### 4.2 参数恢复测试

```python
# tests/cdm_quality/test_parameter_recovery.py

import numpy as np
from app.services.dina_model import DINAModel

def test_slip_guess_recovery():
    """从合成数据恢复slip/guess参数，偏差<0.1"""
    np.random.seed(42)
    N, J, K = 200, 20, 5
    true_slip = np.random.uniform(0.05, 0.2, J)
    true_guess = np.random.uniform(0.05, 0.2, J)
    true_alpha = np.random.binomial(1, 0.5, (N, K))
    Q = np.random.binomial(1, 0.3, (J, K))
    for j in range(J):
        if Q[j].sum() == 0:
            Q[j, np.random.randint(K)] = 1

    eta = np.ones((N, J))
    for i in range(N):
        for j in range(J):
            for k in range(K):
                if Q[j, k] == 1 and true_alpha[i, k] == 0:
                    eta[i, j] = 0

    P_correct = (1 - true_slip) * eta + true_guess * (1 - eta)
    X = np.random.binomial(1, P_correct)

    model = DINAModel()
    result = model.fit(X, Q, max_iter=500, tol=1e-6)

    est_slip = np.array(list(result["slip_params"].values()))
    est_guess = np.array(list(result["guess_params"].values()))

    slip_error = np.mean(np.abs(est_slip - true_slip))
    guess_error = np.mean(np.abs(est_guess - true_guess))

    assert slip_error < 0.1, f"slip恢复误差{slip_error:.3f}，超过0.1"
    assert guess_error < 0.1, f"guess恢复误差{guess_error:.3f}，超过0.1"

def test_knowledge_state_recovery():
    """从合成数据恢复知识掌握状态，准确率≥80%"""
    np.random.seed(42)
    N, J, K = 200, 20, 5
    true_slip = np.full(J, 0.1)
    true_guess = np.full(J, 0.15)
    true_alpha = np.random.binomial(1, 0.5, (N, K))
    Q = np.random.binomial(1, 0.3, (J, K))
    for j in range(J):
        if Q[j].sum() == 0:
            Q[j, np.random.randint(K)] = 1

    eta = np.ones((N, J))
    for i in range(N):
        for j in range(J):
            for k in range(K):
                if Q[j, k] == 1 and true_alpha[i, k] == 0:
                    eta[i, j] = 0

    P_correct = (1 - true_slip) * eta + true_guess * (1 - eta)
    X = np.random.binomial(1, P_correct)

    model = DINAModel()
    result = model.fit(X, Q, max_iter=500, tol=1e-6)

    est_alpha_probs = np.array(result["knowledge_state_probs"])
    est_alpha = (est_alpha_probs >= 0.5).astype(int)

    accuracy = np.mean(est_alpha == true_alpha)
    assert accuracy >= 0.8, f"知识状态恢复准确率{accuracy:.2%}，未达80%"
```

### 4.3 Q矩阵准确率测试

```python
# tests/cdm_quality/test_qmatrix_accuracy.py

TEACHER_ANNOTATED_Q = {
    "q1": {"等值线判读": 1, "地形类型特征": 1, "空间推理": 0},
    "q2": {"等值线判读": 0, "气温降水读图": 1, "气候类型判断": 1},
    "q3": {"热力环流原理": 1, "大气运动": 1, "气温降水读图": 0},
    "q4": {"降水特征辨析": 1, "气候类型判断": 1, "等值线判读": 0},
    "q5": {"大气运动": 1, "气压带风带": 1, "热力环流原理": 1},
}

def test_q_matrix_nlp_accuracy():
    """NLP初始化Q矩阵与教师标注一致率≥90%"""
    from app.services.qmatrix_service import QMatrixService
    service = QMatrixService()
    correct = 0
    total = 0
    for q_id, teacher_mapping in TEACHER_ANNOTATED_Q.items():
        question = get_test_question(q_id)
        knowledge_points = get_test_knowledge_points()
        result = service.generate_nlp_init(question, knowledge_points)
        nlp_mapping = result["q_matrix_row"]
        for kp_name, expected in teacher_mapping.items():
            actual = nlp_mapping.get(kp_name, 0)
            if actual == expected:
                correct += 1
            total += 1
    accuracy = correct / total
    assert accuracy >= 0.9, f"Q矩阵NLP准确率{accuracy:.0%}，未达90%"

def test_q_matrix_data_validation():
    """数据验证能发现Q矩阵异常"""
    np.random.seed(42)
    N, J, K = 50, 10, 5
    X = np.random.binomial(1, 0.5, (N, J))
    Q_wrong = np.zeros((J, K), dtype=int)
    for j in range(J):
        Q_wrong[j, j % K] = 1

    model = DINAModel()
    result = model.fit(X, Q_wrong, max_iter=500, tol=1e-6)

    anomalies = []
    for j, slip in result["slip_params"].items():
        if slip > 0.4:
            anomalies.append({"question_id": j, "reason": f"slip={slip:.3f}>0.4"})
    for j, guess in result["guess_params"].items():
        if guess > 0.4:
            anomalies.append({"question_id": j, "reason": f"guess={guess:.3f}>0.4"})

    assert len(anomalies) > 0, "数据验证未发现异常Q矩阵"
```

### 4.4 诊断准确率测试

```python
# tests/cdm_quality/test_diagnosis_accuracy.py

GOLDEN_DIAGNOSIS_CASES = [
    {
        "student_id": "s01",
        "homework_id": "h01",
        "knowledge_state": {
            "等值线判读": 0.18,
            "气温降水读图": 0.35,
            "气候类型判断": 0.22,
            "热力环流原理": 0.85,
            "降水特征辨析": 0.72,
        },
        "expected_root_cause_for_气候类型判断": "等值线判读",
        "reason": "等值线判读是气候类型判断的前驱，且P(掌握)=0.18<0.5"
    },
    {
        "student_id": "s02",
        "homework_id": "h01",
        "knowledge_state": {
            "等值线判读": 0.82,
            "气温降水读图": 0.75,
            "气候类型判断": 0.28,
            "热力环流原理": 0.65,
            "降水特征辨析": 0.19,
        },
        "expected_root_cause_for_气候类型判断": "降水特征辨析",
        "reason": "降水特征辨析是气候类型判断的前驱，且P(掌握)=0.19<0.5"
    },
    {
        "student_id": "s03",
        "homework_id": "h01",
        "knowledge_state": {
            "等值线判读": 0.15,
            "气温降水读图": 0.20,
            "气候类型判断": 0.10,
            "热力环流原理": 0.12,
            "降水特征辨析": 0.18,
        },
        "expected_root_cause_for_热力环流原理": "等值线判读",
        "reason": "等值线判读是热力环流的深层前驱，且P(掌握)最低"
    },
]

def test_diagnosis_accuracy_vs_teacher():
    """CDM诊断与教师盲评一致率≥80%"""
    from app.services.root_cause import RootCauseInference
    from app.services.knowledge_graph_store import KnowledgeGraphStore

    graph_store = KnowledgeGraphStore()
    inference = RootCauseInference(graph_store)

    correct = 0
    total = 0
    for case in GOLDEN_DIAGNOSIS_CASES:
        result = inference.infer(
            knowledge_state=case["knowledge_state"],
            unmastered_kps=[k for k, v in case["knowledge_state"].items() if v < 0.5]
        )
        for kp_name, expected_root in case.items():
            if not kp_name.startswith("expected_root_cause_for_"):
                continue
            target_kp = kp_name.replace("expected_root_cause_for_", "")
            actual_root = result[target_kp]["root_cause_kp_name"]
            if actual_root == expected_root:
                correct += 1
            total += 1

    accuracy = correct / total
    assert accuracy >= 0.8, f"诊断准确率{accuracy:.0%}，未达80%"

def test_root_cause_in_prerequisite_chain():
    """根因必须在图谱前驱链上"""
    from app.services.root_cause import RootCauseInference
    from app.services.knowledge_graph_store import KnowledgeGraphStore

    graph_store = KnowledgeGraphStore()
    inference = RootCauseInference(graph_store)

    for case in GOLDEN_DIAGNOSIS_CASES:
        result = inference.infer(
            knowledge_state=case["knowledge_state"],
            unmastered_kps=[k for k, v in case["knowledge_state"].items() if v < 0.5]
        )
        for target_kp, rc in result.items():
            if rc["confidence"] < 0.5:
                continue
            chain = graph_store.traverse_prerequisite_chain(target_kp)
            chain_ids = [n["id"] for n in chain]
            assert rc["root_cause_kp_id"] in chain_ids, \
                f"根因{rc['root_cause_kp_name']}不在{target_kp}的前驱链上"
```

### 4.5 反事实预测测试

```python
# tests/cdm_quality/test_counterfactual.py

import numpy as np

def test_counterfactual_prediction():
    """反事实预测与实际提升数据对比"""
    np.random.seed(42)
    N = 50
    knowledge_states = np.random.binomial(1, 0.5, (N, 5))
    knowledge_states_df = pd.DataFrame(
        knowledge_states,
        columns=["kp01", "kp02", "kp03", "kp04", "kp05"]
    )

    from app.services.counterfactual import CounterfactualEngine
    engine = CounterfactualEngine()

    result = engine.predict(
        root_cause_id="kp01",
        downstream_ids=["kp02", "kp03", "kp04"],
        knowledge_states=knowledge_states_df
    )

    for pred in result:
        assert "current_rate" in pred
        assert "predicted_rate" in pred
        assert "improvement" in pred
        assert pred["predicted_rate"] >= pred["current_rate"]
        if pred["reliable"]:
            assert pred["sample_size"] >= 10

def test_counterfactual_small_sample_warning():
    """样本<10时标记'预测不可靠'"""
    knowledge_states = pd.DataFrame({
        "kp01": [1, 1, 0, 0, 1],
        "kp02": [1, 0, 0, 1, 0],
    })

    from app.services.counterfactual import CounterfactualEngine
    engine = CounterfactualEngine()

    result = engine.predict(
        root_cause_id="kp01",
        downstream_ids=["kp02"],
        knowledge_states=knowledge_states
    )

    assert result[0]["reliable"] is False
    assert result[0]["sample_size"] < 10

def test_counterfactual_mathematical_derivation():
    """反事实预测值可从CDM参数数学推导"""
    np.random.seed(42)
    N = 50
    alpha = np.random.binomial(1, 0.5, (N, 3))
    df = pd.DataFrame(alpha, columns=["kp01", "kp02", "kp03"])

    from app.services.counterfactual import CounterfactualEngine
    engine = CounterfactualEngine()
    result = engine.predict("kp01", ["kp02", "kp03"], df)

    kp01_mastered = df[df["kp01"] == 1]
    kp01_not_mastered = df[df["kp01"] == 0]

    for pred in result:
        kp_id = pred["knowledge_id"]
        manual_p_y_given_x = kp01_mastered[kp_id].mean()
        manual_p_y_given_no_x = kp01_not_mastered[kp_id].mean()
        manual_improvement = manual_p_y_given_x - manual_p_y_given_no_x

        assert abs(pred["improvement"] - manual_improvement) < 0.01, \
            f"反事实预测值不可从CDM参数推导: 预测={pred['improvement']}, 手动={manual_improvement}"
```

### 4.6 模型比较测试

```python
# tests/cdm_quality/test_model_comparison.py

import numpy as np
from app.services.dina_model import DINAModel

def test_dina_vs_irt_model_comparison():
    """DINA模型的AIC/BIC应优于IRT基线"""
    np.random.seed(42)
    N, J, K = 100, 20, 5
    true_slip = np.full(J, 0.1)
    true_guess = np.full(J, 0.15)
    true_alpha = np.random.binomial(1, 0.5, (N, K))
    Q = np.random.binomial(1, 0.3, (J, K))
    for j in range(J):
        if Q[j].sum() == 0:
            Q[j, np.random.randint(K)] = 1

    eta = np.ones((N, J))
    for i in range(N):
        for j in range(J):
            for k in range(K):
                if Q[j, k] == 1 and true_alpha[i, k] == 0:
                    eta[i, j] = 0

    P_correct = (1 - true_slip) * eta + true_guess * (1 - eta)
    X = np.random.binomial(1, P_correct)

    model = DINAModel()
    dina_result = model.fit(X, Q, max_iter=500, tol=1e-6)
    irt_result = model.fit_irt_baseline(X)

    assert dina_result["aic"] < irt_result["aic"], \
        f"DINA AIC={dina_result['aic']:.1f} > IRT AIC={irt_result['aic']:.1f}"
    assert dina_result["bic"] < irt_result["bic"], \
        f"DINA BIC={dina_result['bic']:.1f} > IRT BIC={irt_result['bic']:.1f}"
```

### 4.7 偏相关检验测试

```python
# tests/cdm_quality/test_partial_correlation.py

import numpy as np
from scipy import stats
from app.services.partial_correlation import PartialCorrelationTest

def test_partial_correlation_detects_true_prerequisite():
    """偏相关检验能发现已知前驱关系"""
    np.random.seed(42)
    N = 100
    kp_A = np.random.binomial(1, 0.5, N)
    kp_B = (kp_A * np.random.binomial(1, 0.8, N) +
             (1 - kp_A) * np.random.binomial(1, 0.2, N))
    kp_C = np.random.binomial(1, 0.5, N)
    data = np.column_stack([kp_A, kp_B, kp_C])

    tester = PartialCorrelationTest()
    result = tester.test(data, x_col=0, y_col=1, control_cols=[2])

    assert result["partial_r"] > 0.3, f"偏相关系数过小: {result['partial_r']:.3f}"
    assert result["p_value"] < 0.05, f"偏相关不显著: p={result['p_value']:.4f}"
    assert result["is_significant"] is True

def test_partial_correlation_removes_spurious():
    """偏相关检验能消除简单相关产生的虚假发现"""
    np.random.seed(42)
    N = 200
    confounder = np.random.binomial(1, 0.5, N)
    kp_A = (confounder * np.random.binomial(1, 0.8, N) +
             (1 - confounder) * np.random.binomial(1, 0.2, N))
    kp_B = (confounder * np.random.binomial(1, 0.8, N) +
             (1 - confounder) * np.random.binomial(1, 0.2, N))

    data = np.column_stack([kp_A, kp_B, confounder])

    simple_r = np.corrcoef(kp_A, kp_B)[0, 1]
    assert simple_r > 0.3, f"简单相关应显著: r={simple_r:.3f}"

    tester = PartialCorrelationTest()
    result = tester.test(data, x_col=0, y_col=1, control_cols=[2])

    assert abs(result["partial_r"]) < 0.2, \
        f"偏相关应不显著(虚假关系): r={result['partial_r']:.3f}"
    assert result["p_value"] >= 0.05, \
        f"偏相关p值应>0.05: p={result['p_value']:.4f}"

def test_partial_correlation_sample_size_requirement():
    """样本量<30时偏相关检验不应判定为显著"""
    np.random.seed(42)
    N = 25
    kp_A = np.random.binomial(1, 0.5, N)
    kp_B = (kp_A * np.random.binomial(1, 0.8, N) +
             (1 - kp_A) * np.random.binomial(1, 0.2, N))
    kp_C = np.random.binomial(1, 0.5, N)
    data = np.column_stack([kp_A, kp_B, kp_C])

    tester = PartialCorrelationTest()
    result = tester.test(data, x_col=0, y_col=1, control_cols=[2])

    assert result["is_significant"] is False, \
        "样本量<30时不应判定为显著"
```

### 4.8 Q矩阵课标约束测试

```python
# tests/cdm_quality/test_qmatrix_curriculum_constraint.py

def test_q_matrix_curriculum_constraint_reduces_candidates():
    """课标约束后Q矩阵候选集缩小≥50%"""
    from app.services.qmatrix_service import QMatrixService
    service = QMatrixService()

    all_knowledge_points = get_all_knowledge_points()
    curriculum_scope = get_curriculum_scope(grade="高一", subject="地理")

    constrained = service.apply_curriculum_constraint(
        candidates=all_knowledge_points,
        curriculum_scope=curriculum_scope
    )

    reduction_rate = 1 - len(constrained) / len(all_knowledge_points)
    assert reduction_rate >= 0.5, \
        f"课标约束后候选集仅缩小{reduction_rate:.0%}，未达50%"

def test_constrained_q_matrix_higher_accuracy():
    """课标约束的Q矩阵比无约束准确率更高"""
    from app.services.qmatrix_service import QMatrixService
    service = QMatrixService()

    questions = get_test_questions()
    all_kps = get_all_knowledge_points()
    curriculum_kps = get_curriculum_scope(grade="高一", subject="地理")

    result_unconstrained = service.generate_nlp_init(
        questions=questions,
        knowledge_points=all_kps
    )
    result_constrained = service.generate_nlp_init(
        questions=questions,
        knowledge_points=curriculum_kps
    )

    acc_unconstrained = compute_q_matrix_accuracy(result_unconstrained, TEACHER_ANNOTATED_Q)
    acc_constrained = compute_q_matrix_accuracy(result_constrained, TEACHER_ANNOTATED_Q)

    assert acc_constrained >= acc_unconstrained, \
        f"约束后准确率{acc_constrained:.0%}应≥无约束{acc_unconstrained:.0%}"
```

### 4.9 课件模板模式测试

```python
# tests/cdm_quality/test_courseware_template.py

def test_template_mode_parsing_accuracy():
    """模板模式解析准确率≥95%"""
    from app.services.courseware_service import CoursewareService
    service = CoursewareService()

    template_pptx = "test_fixtures/地理大气环流_模板.pptx"
    result = service.parse(template_pptx, mode="template")

    expected_kps = get_expected_template_knowledge_points()
    correct = 0
    total = len(expected_kps)
    for kp_name, expected_attrs in expected_kps.items():
        actual = result["knowledge_points"].get(kp_name)
        if actual and actual["cognitive_level"] == expected_attrs["cognitive_level"]:
            correct += 1

    accuracy = correct / total
    assert accuracy >= 0.95, \
        f"模板模式解析准确率{accuracy:.0%}，未达95%"

def test_template_mode_better_than_free_mode():
    """模板模式准确率比自由模式高≥15%"""
    from app.services.courseware_service import CoursewareService
    service = CoursewareService()

    template_pptx = "test_fixtures/地理大气环流_模板.pptx"
    free_pptx = "test_fixtures/地理大气环流_自由.pptx"

    template_result = service.parse(template_pptx, mode="template")
    free_result = service.parse(free_pptx, mode="free")

    expected_kps = get_expected_template_knowledge_points()

    template_acc = compute_parse_accuracy(template_result, expected_kps)
    free_acc = compute_parse_accuracy(free_result, expected_kps)

    assert template_acc - free_acc >= 0.15, \
        f"模板模式{template_acc:.0%} - 自由模式{free_acc:.0%} = {template_acc-free_acc:.0%}，差距<15%"
```

---

## 5. 智能体行为测试

```python
# tests/agent/test_agent_behavior.py

import time

def test_exam_import_triggers_cdm_estimation(client, homework_id):
    """新考试数据导入后自动触发CDM估计"""
    with open("test_fixtures/期中测试成绩.xlsx", "rb") as f:
        resp = client.post(f"/api/homework/{homework_id}/import", files={"file": f})
    assert resp.status_code == 200

    notifications = client.get("/api/notifications?type=cdm_update").json()["items"]
    assert len(notifications) > 0, "考试导入后未触发CDM估计通知"

    cdm_status = client.get(f"/api/cdm/status?homework_id={homework_id}").json()
    assert cdm_status["status"] in ["running", "completed"], \
        "考试导入后CDM估计未自动触发"

def test_cdm_param_change_triggers_notification(client, homework_id):
    """CDM参数变化>0.1触发通知"""
    old_params = client.get(f"/api/cdm/params?homework_id={homework_id}").json()

    resp = client.post("/api/diagnosis/confirm", json={
        "diagnosis_id": "test_diagnosis",
        "confirmed": False,
        "correction": {
            "root_cause_kp_id": "kp02",
            "knowledge_id": "kp02",
            "mastered": True,
            "reason": "测试参数变化通知"
        }
    })
    assert resp.status_code == 200

    new_params = client.get(f"/api/cdm/params?homework_id={homework_id}").json()

    slip_changed = any(
        abs(new_params["slip_params"][k] - old_params["slip_params"][k]) > 0.1
        for k in old_params["slip_params"]
    )
    guess_changed = any(
        abs(new_params["guess_params"][k] - old_params["guess_params"][k]) > 0.1
        for k in old_params["guess_params"]
    )

    if slip_changed or guess_changed:
        notifications = client.get("/api/notifications?type=cdm_update").json()["items"]
        assert len(notifications) > 0, "CDM参数显著变化后未触发通知"

def test_partial_correlation_candidate_triggers_notification(client):
    """偏相关检验发现前驱关系候选时触发通知"""
    resp = client.post("/api/knowledge/partial-correlation", json={
        "homework_id": "h01"
    })
    assert resp.status_code == 200

    candidates = client.get("/api/knowledge/prereq-candidates").json()["candidates"]
    if len(candidates) > 0:
        notifications = client.get("/api/notifications?type=prereq_candidate").json()["items"]
        assert len(notifications) > 0, "发现前驱关系候选后未触发通知"

def test_consecutive_low_mastery_triggers_courseware_suggestion(client):
    """连续低掌握率触发课件优化建议"""
    notifications = client.get("/api/notifications?type=low_mastery").json()["items"]

    for n in notifications:
        assert "掌握率" in n["content"] or "课件" in n["content"], \
            "低掌握率通知应包含掌握率或课件相关内容"

    courseware_notifications = client.get("/api/notifications?type=courseware_optimize").json()["items"]
    if len(courseware_notifications) > 0:
        for n in courseware_notifications:
            assert "课件" in n["content"] or "优化" in n["content"], \
                "课件优化通知应包含课件或优化相关内容"

def test_notification_deduplication(client):
    """同一事件24小时内仅1条通知(去重)"""
    resp1 = client.post("/api/agent/event", json={
        "event_type": "low_mastery_detected",
        "entity_id": "kp01",
        "data": {"mastery": 0.15}
    })
    assert resp1.status_code == 200

    resp2 = client.post("/api/agent/event", json={
        "event_type": "low_mastery_detected",
        "entity_id": "kp01",
        "data": {"mastery": 0.12}
    })
    assert resp2.status_code == 200

    notifications = client.get("/api/notifications?type=low_mastery").json()["items"]
    kp01_notifications = [n for n in notifications if "kp01" in n.get("entity_id", "")]
    recent = [n for n in kp01_notifications if is_within_24h(n["createdAt"])]
    assert len(recent) <= 1, f"同一事件24h内产生{len(recent)}条通知，应去重为1条"
```

---

## 6. 第4层: 单元测试 (pytest)

### 核心函数100%覆盖

```python
# tests/unit/test_dina_model.py

import numpy as np
from app.services.dina_model import DINAModel

def test_eta_calculation():
    """η_ij计算: 所有相关知识点都掌握→1, 否则→0"""
    model = DINAModel()
    alpha = np.array([[1, 1, 0], [1, 0, 1], [0, 1, 1]])
    q_row = np.array([1, 0, 1])
    eta = model.compute_eta(alpha, q_row)
    np.testing.assert_array_equal(eta, [0, 1, 0])

def test_dina_probability():
    """DINA概率: P(X=1|α) = (1-s)*η + g*(1-η)"""
    model = DINAModel()
    eta = np.array([1, 0])
    slip = 0.1
    guess = 0.2
    prob = model.compute_probability(eta, slip, guess)
    np.testing.assert_allclose(prob, [0.9, 0.2])

def test_slip_guess_constraint():
    """约束: 0 < g < 1-s < 1"""
    model = DINAModel()
    assert model.validate_params(slip=0.1, guess=0.2) is True
    assert model.validate_params(slip=0.5, guess=0.6) is False
    assert model.validate_params(slip=-0.1, guess=0.1) is False

def test_em_e_step():
    """E步: 计算后验概率"""
    model = DINAModel()
    X = np.array([[1, 0, 1], [0, 1, 1], [1, 1, 0]])
    Q = np.array([[1, 0], [0, 1], [1, 1]])
    slip = np.array([0.1, 0.1, 0.1])
    guess = np.array([0.2, 0.2, 0.2])
    pk = np.array([0.5, 0.5])
    posterior = model.e_step(X, Q, slip, guess, pk)
    assert posterior.shape[0] == X.shape[0]
    for i in range(posterior.shape[0]):
        total = sum(posterior[i].values())
        assert abs(total - 1.0) < 1e-6

def test_em_m_step():
    """M步: 更新slip/guess/pk"""
    model = DINAModel()
    posterior = {
        0: {(0,0): 0.3, (0,1): 0.2, (1,0): 0.2, (1,1): 0.3},
        1: {(0,0): 0.1, (0,1): 0.4, (1,0): 0.1, (1,1): 0.4},
    }
    X = np.array([[1, 0], [0, 1]])
    Q = np.array([[1, 0], [0, 1]])
    new_slip, new_guess, new_pk = model.m_step(posterior, X, Q)
    assert all(0 <= s <= 1 for s in new_slip)
    assert all(0 <= g <= 1 for g in new_guess)
    assert all(0 <= p <= 1 for p in new_pk)
```

```python
# tests/unit/test_root_cause.py

from app.services.root_cause import RootCauseInference

def test_root_cause_basic():
    """基本根因推断: 未掌握知识点的前驱中P最低的"""
    inference = RootCauseInference(mock_graph_store)
    knowledge_state = {"kp01": 0.2, "kp02": 0.4, "kp03": 0.7}
    result = inference.infer_single("kp02", knowledge_state)
    assert result["root_cause_kp_id"] == "kp01"
    assert result["confidence"] > 0

def test_root_cause_no_prerequisite():
    """无前驱时根因是自身"""
    inference = RootCauseInference(mock_graph_store_no_prereq)
    knowledge_state = {"kp01": 0.3}
    result = inference.infer_single("kp01", knowledge_state)
    assert result["root_cause_kp_id"] == "kp01"
    assert result["is_basic_knowledge"] is True

def test_root_cause_all_prerequisites_mastered():
    """前驱都掌握时根因是自身"""
    inference = RootCauseInference(mock_graph_store)
    knowledge_state = {"kp01": 0.85, "kp02": 0.3}
    result = inference.infer_single("kp02", knowledge_state)
    assert result["root_cause_kp_id"] == "kp02"
```

```python
# tests/unit/test_counterfactual.py

from app.services.counterfactual import CounterfactualEngine

def test_counterfactual_basic():
    """基本反事实推理"""
    engine = CounterfactualEngine()
    result = engine.predict_single(
        root_cause_mastery=np.array([1,1,1,0,0,0,1,0,1,0]),
        downstream_mastery=np.array([1,1,0,0,0,1,1,0,0,0]),
        sample_size=10
    )
    assert result["p_y_given_x"] > result["p_y_given_no_x"]
    assert result["improvement"] > 0

def test_counterfactual_reliability():
    """可靠性判断"""
    engine = CounterfactualEngine()
    assert engine.is_reliable(sample_size=15) is True
    assert engine.is_reliable(sample_size=8) is False
```

---

## 6. 每Phase验证脚本

### Phase 1a: 课件上传+解析

```python
# tests/phase_verification/test_phase_1a.py

def test_courseware_upload_and_parse(client):
    with open("test_fixtures/地理大气环流.pptx", "rb") as f:
        resp = client.post("/api/courseware/", files={"file": f})
    assert resp.status_code == 200
    cw_id = resp.json()["id"]

    resp = client.post(f"/api/courseware/{cw_id}/parse")
    assert resp.status_code == 200

    resp = client.get(f"/api/courseware/{cw_id}/knowledge-points")
    kps = resp.json()["knowledge_points"]
    assert len(kps) >= 10
    assert all("name" in kp for kp in kps)
    assert all("cognitive_level" in kp for kp in kps)
    assert all("page" in kp for kp in kps)
    pages = [kp["page"] for kp in kps]
    assert pages == sorted(pages)
```

### Phase 1b: 课程标准+知识图谱

```python
# tests/phase_verification/test_phase_1b.py

def test_curriculum_import_and_graph(client):
    with open("test_fixtures/地理课标.json", "r") as f:
        resp = client.post("/api/curriculum/import", json=json.load(f))
    assert resp.status_code == 200

    resp = client.get("/api/knowledge/graph")
    data = resp.json()
    node_types = set(n["entity_type"] for n in data["nodes"])
    assert len(node_types) >= 4
    edge_types = set(e["relation_type"] for e in data["edges"])
    assert len(edge_types) >= 5

    resp = client.get("/api/knowledge/kp04/trace")
    assert resp.status_code == 200
    path = resp.json()["path"]
    assert len(path) >= 1
```

### Phase 3a: DINA模型（合成数据）

```python
# tests/phase_verification/test_phase_3a.py

import numpy as np
from app.services.dina_model import DINAModel

def test_dina_with_synthetic_data():
    np.random.seed(42)
    N, J, K = 50, 20, 5
    true_slip = np.full(J, 0.1)
    true_guess = np.full(J, 0.15)
    true_alpha = np.random.binomial(1, 0.5, (N, K))
    Q = np.random.binomial(1, 0.3, (J, K))
    for j in range(J):
        if Q[j].sum() == 0:
            Q[j, np.random.randint(K)] = 1

    eta = np.ones((N, J))
    for i in range(N):
        for j in range(J):
            for k in range(K):
                if Q[j, k] == 1 and true_alpha[i, k] == 0:
                    eta[i, j] = 0

    P_correct = (1 - true_slip) * eta + true_guess * (1 - eta)
    X = np.random.binomial(1, P_correct)

    model = DINAModel()
    result = model.fit(X, Q, max_iter=500, tol=1e-6)

    assert result["converged"] is True
    assert result["aic"] is not None
    assert result["bic"] is not None

    est_slip = np.array(list(result["slip_params"].values()))
    est_guess = np.array(list(result["guess_params"].values()))
    assert np.mean(np.abs(est_slip - true_slip)) < 0.1
    assert np.mean(np.abs(est_guess - true_guess)) < 0.1

    import time
    start = time.time()
    model.fit(X, Q, max_iter=500, tol=1e-6)
    elapsed = time.time() - start
    assert elapsed <= 10, f"50学生×20题估计耗时{elapsed:.1f}s，超过10s"
```

### Phase 3b: 根因推断

```python
# tests/phase_verification/test_phase_3b.py

def test_root_cause_inference():
    from app.services.root_cause import RootCauseInference
    from app.services.knowledge_graph_store import KnowledgeGraphStore

    graph_store = KnowledgeGraphStore()
    inference = RootCauseInference(graph_store)

    knowledge_state = {
        "kp01": 0.18,
        "kp02": 0.35,
        "kp03": 0.72,
        "kp04": 0.22,
    }
    result = inference.infer(
        knowledge_state=knowledge_state,
        unmastered_kps=["kp01", "kp02", "kp04"]
    )

    for target_kp, rc in result.items():
        assert "root_cause_kp_id" in rc
        assert "trace_path" in rc
        assert "confidence" in rc
        assert 0 <= rc["confidence"] <= 1

    assert result["kp04"]["root_cause_kp_id"] == "kp01"
```

### Phase 3c: 反事实推理+参数更新

```python
# tests/phase_verification/test_phase_3c.py

def test_counterfactual_and_param_update(client, homework_id, diagnosis_id):
    resp = client.get("/api/knowledge/kp01/counterfactual")
    assert resp.status_code == 200
    predictions = resp.json()["predictions"]
    assert len(predictions) > 0
    for p in predictions:
        assert p["improvement"] >= 0

    old_params = client.get("/api/cdm/params").json()

    resp = client.post("/api/diagnosis/confirm", json={
        "diagnosis_id": diagnosis_id,
        "confirmed": False,
        "correction": {
            "root_cause_kp_id": "kp02",
            "knowledge_id": "kp02",
            "mastered": True,
            "reason": "测试参数更新"
        }
    })
    assert resp.status_code == 200

    new_params = client.get("/api/cdm/params").json()
    slip_changed = (
        old_params["slip_params"] != new_params["slip_params"] or
        old_params["guess_params"] != new_params["guess_params"]
    )
    assert slip_changed, "教师修正后CDM参数未更新"
```

---

## 7. 性能基线

| 操作 | 目标 | 测量方法 | 测试脚本 |
|------|------|---------|---------|
| 页面首次加载 | ≤3秒 | Lighthouse | `e2e/test_performance.py` |
| API查询响应 | ≤500ms | `time.time()`计时 | `tests/performance/test_api_perf.py` |
| CDM估计(50学生×20题) | ≤10秒 | `time.time()`计时 | `tests/cdm_quality/test_dina_convergence.py` |
| 图谱渲染(100节点) | ≤2秒 | `performance.now()` | `e2e/test_performance.py` |
| 单个学生诊断 | ≤5秒 | `time.time()`计时 | `tests/phase_verification/test_phase_3b.py` |
| 智能体事件处理延迟 | ≤500ms | `time.time()`计时 | `tests/agent/test_agent_perf.py` |
| 通知送达延迟 | ≤1s | `time.time()`计时 | `tests/agent/test_agent_perf.py` |

```python
# tests/performance/test_api_perf.py

import time

def test_api_query_performance(client, homework_id):
    endpoints = [
        f"/api/homework/{homework_id}/results",
        f"/api/homework/{homework_id}/q-matrix",
        f"/api/knowledge/graph",
    ]
    for endpoint in endpoints:
        start = time.time()
        resp = client.get(endpoint)
        elapsed = (time.time() - start) * 1000
        assert resp.status_code == 200
        assert elapsed <= 500, f"{endpoint} 响应{elapsed:.0f}ms，超过500ms"
```

---

## 8. 持续验证规则

**每个Phase完成后的必检清单**：

```bash
# 1. 单元测试
cd backend && pytest tests/unit/ -v

# 2. CDM模型质量测试（Phase 3后必跑）
cd backend && pytest tests/cdm_quality/ -v

# 3. API集成测试
cd backend && pytest tests/integration/ -v

# 4. 前端构建
cd frontend && npm run build

# 5. Docker启动
docker-compose down && docker-compose up -d

# 6. 冒烟测试
curl http://localhost:8000/health
curl http://localhost:3000

# 7. Phase验证脚本
cd backend && pytest tests/phase_verification/test_phase_{phase}/ -v
```

**不通过则不进入下一个Phase。**

**CDM模型质量测试是Phase 3的硬性门槛**：
- DINA收敛测试不通过 → 不进入Phase 3b
- 参数恢复误差>0.1 → 检查EM实现
- 诊断准确率<80% → 检查根因推断算法
- 反事实预测不可数学推导 → 检查计算逻辑
