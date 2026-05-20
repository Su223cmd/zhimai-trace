import pytest
import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestHealthCheck:
    def test_health_endpoint(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_docs_available(self):
        response = client.get("/docs")
        assert response.status_code == 200


class TestCoursewareAPI:
    def test_list_coursewares(self):
        response = client.get("/api/courseware/?skip=0&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_list_coursewares_pagination(self):
        response = client.get("/api/courseware/?skip=1&limit=1")
        assert response.status_code == 200
        data = response.json()
        assert data["skip"] == 1
        assert data["limit"] == 1

    def test_get_courseware_not_found(self):
        response = client.get("/api/courseware/nonexistent-id")
        assert response.status_code == 404


class TestKnowledgeAPI:
    def test_get_graph(self):
        response = client.get("/api/knowledge/graph")
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data or "entities" in data or "contains" in data

    def test_search_entity_not_found(self):
        response = client.get("/api/knowledge/graph?project_id=nonexistent_xyz")
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data or "entities" in data or "contains" in data

    def test_get_prerequisite_chain(self):
        response = client.get("/api/knowledge/CH-GEO-01/prerequisite")
        assert response.status_code in (200, 404)

    def test_create_entity(self):
        response = client.post("/api/knowledge/entity", json={
            "entity_type": "KnowledgePoint",
            "code": "TEST-KP-INTEGRATION",
            "properties": {"name": "Test Knowledge Point"},
        })
        assert response.status_code in (200, 409)


class TestCurriculumAPI:
    def test_get_curriculum_tree(self):
        response = client.get("/api/curriculum/tree")
        assert response.status_code == 200
        data = response.json()
        assert data.get("subject_code") or data.get("subject_name") or "contains" in data

    def test_import_curriculum(self):
        response = client.post("/api/curriculum/import", json={"subject_code": "GEO"})
        assert response.status_code == 200


class TestHomeworkAPI:
    def test_list_homework(self):
        response = client.get("/api/homework/?skip=0&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_create_homework(self):
        response = client.post("/api/homework/", json={
            "project_id": "test-project-id",
            "title": "Integration Test Homework",
            "class_id": "test-class",
        })
        assert response.status_code == 200

    def test_get_homework_not_found(self):
        response = client.get("/api/homework/nonexistent-id")
        assert response.status_code == 404


class TestDiagnosisAPI:
    def test_diagnose_no_data(self):
        response = client.post("/api/diagnosis/diagnose", json={
            "student_id": "test-student",
            "homework_id": "nonexistent-homework",
        })
        assert response.status_code in (200, 400, 404)

    def test_counterfactual_no_data(self):
        response = client.post("/api/diagnosis/counterfactual", json={
            "homework_id": "nonexistent-homework",
            "student_id": "test-student",
        })
        assert response.status_code in (400, 200)

    def test_remediation_priority_no_data(self):
        response = client.get("/api/diagnosis/remediation-priority?homework_id=nonexistent")
        assert response.status_code in (400, 200)

    def test_student_clusters_no_data(self):
        response = client.get("/api/diagnosis/student-clusters?homework_id=nonexistent")
        assert response.status_code in (400, 200)

    def test_teaching_suggestions_no_data(self):
        response = client.get("/api/diagnosis/teaching-suggestions?homework_id=nonexistent")
        assert response.status_code in (400, 200)

    def test_cdm_status(self):
        response = client.get("/api/diagnosis/cdm/status?homework_id=nonexistent")
        assert response.status_code in (200, 400, 404)

    def test_learning_path(self):
        response = client.get("/api/diagnosis/learning-path/test-student")
        assert response.status_code in (200, 400, 404)


class TestAgentAPI:
    def test_list_agents(self):
        response = client.get("/api/agent/agents")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert data["total"] >= 4

    def test_agent_messages(self):
        response = client.get("/api/agent/messages?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data or "items" in data

    def test_agent_events(self):
        response = client.get("/api/agent/events?limit=10")
        assert response.status_code == 200


class TestClassAPI:
    def test_list_classes(self):
        response = client.get("/api/class/list")
        assert response.status_code == 200
        data = response.json()
        assert "classes" in data

    def test_create_class(self):
        response = client.post("/api/class/create", json={
            "name": "Test Class Integration",
            "project_id": "test-project-id",
            "grade": "高三",
        })
        assert response.status_code in (200, 400, 409)
        data = response.json()
        assert data.get("status") == "success" or data.get("detail") or "message" in data


class TestProjectAPI:
    def test_list_projects(self):
        response = client.get("/api/project/")
        assert response.status_code == 200


class TestErrorHandling:
    def test_404_unknown_route(self):
        response = client.get("/api/nonexistent/route/xyz")
        assert response.status_code == 404

    def test_invalid_json_body(self):
        response = client.post(
            "/api/diagnosis/counterfactual",
            content="invalid json {{{",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in (400, 422)

    def test_error_response_has_detail_field(self):
        response = client.get("/api/homework/nonexistent-id")
        assert response.status_code == 404
        data = response.json()
        assert "status" in data or "detail" in data


class TestCoreBusinessFlow:
    def test_complete_diagnosis_flow_without_data(self):
        homework_resp = client.post("/api/homework/", json={
            "project_id": "flow-test-project",
            "title": "Flow Test Homework",
            "class_id": "flow-test-class",
        })
        assert homework_resp.status_code == 200
        hw_data = homework_resp.json()
        homework_id = hw_data.get("homework_id", "")

        if homework_id:
            diag_resp = client.post("/api/diagnosis/diagnose", json={
                "student_id": "flow-test-student",
                "homework_id": homework_id,
            })
            assert diag_resp.status_code in (200, 400)

            counter_resp = client.post("/api/diagnosis/counterfactual", json={
                "homework_id": homework_id,
                "student_id": "flow-test-student",
            })
            assert counter_resp.status_code in (200, 400)

            teaching_resp = client.get(
                f"/api/diagnosis/teaching-suggestions?homework_id={homework_id}"
            )
            assert teaching_resp.status_code in (200, 400)


class TestPerformance:
    MAX_MS = 500

    def test_health_response_time(self):
        start = time.time()
        response = client.get("/health")
        elapsed = (time.time() - start) * 1000
        assert response.status_code == 200
        assert elapsed < self.MAX_MS, f"Health endpoint too slow: {elapsed:.0f}ms"

    def test_agent_list_response_time(self):
        start = time.time()
        response = client.get("/api/agent/agents")
        elapsed = (time.time() - start) * 1000
        assert response.status_code == 200
        assert elapsed < self.MAX_MS, f"Agent list too slow: {elapsed:.0f}ms"

    def test_courseware_list_response_time(self):
        start = time.time()
        response = client.get("/api/courseware/?skip=0&limit=5")
        elapsed = (time.time() - start) * 1000
        assert response.status_code == 200
        assert elapsed < self.MAX_MS, f"Courseware list too slow: {elapsed:.0f}ms"

    def test_homework_list_response_time(self):
        start = time.time()
        response = client.get("/api/homework/?skip=0&limit=5")
        elapsed = (time.time() - start) * 1000
        assert response.status_code == 200
        assert elapsed < self.MAX_MS, f"Homework list too slow: {elapsed:.0f}ms"

    def test_curriculum_tree_response_time(self):
        start = time.time()
        response = client.get("/api/curriculum/tree")
        elapsed = (time.time() - start) * 1000
        assert response.status_code == 200
        assert elapsed < self.MAX_MS, f"Curriculum tree too slow: {elapsed:.0f}ms"

    def test_knowledge_graph_response_time(self):
        start = time.time()
        response = client.get("/api/knowledge/graph")
        elapsed = (time.time() - start) * 1000
        assert response.status_code == 200
        assert elapsed < self.MAX_MS * 2, f"Knowledge graph too slow: {elapsed:.0f}ms"

    def test_class_list_response_time(self):
        start = time.time()
        response = client.get("/api/class/list")
        elapsed = (time.time() - start) * 1000
        assert response.status_code == 200
        assert elapsed < self.MAX_MS, f"Class list too slow: {elapsed:.0f}ms"