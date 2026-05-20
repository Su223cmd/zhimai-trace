import numpy as np
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import CDMParameter, Diagnosis, KnowledgePoint, Homework
from app.services.knowledge_service import find_entity, _get_store

logger = logging.getLogger(__name__)


def compute_remediation_priority(
    db: Session,
    homework_id: str,
) -> dict:
    cdm_params = db.query(CDMParameter).filter(
        CDMParameter.homework_id == homework_id
    ).order_by(CDMParameter.estimated_at.desc()).first()

    if not cdm_params:
        return {"status": "error", "message": "请先运行CDM参数估计"}

    alpha_data = cdm_params.alpha or {}
    kp_codes = alpha_data.get("kp_codes", [])
    student_ids = alpha_data.get("student_ids", [])
    alpha_estimates = alpha_data.get("alpha_estimates", [])

    n_students = max(len(student_ids), 1)
    n_kp = len(kp_codes)

    kp_weak_counts = np.zeros(n_kp)
    kp_mastery_sum = np.zeros(n_kp)
    for i in range(len(student_ids)):
        for j in range(n_kp):
            mastery = alpha_estimates[i][j] if i < len(alpha_estimates) and j < len(alpha_estimates[i]) else 0.0
            kp_mastery_sum[j] += mastery
            if mastery < 0.5:
                kp_weak_counts[j] += 1

    kp_avg_mastery = kp_mastery_sum / n_students
    prerequisite_depth = _get_prerequisite_depth_map()

    priorities = []
    for j in range(n_kp):
        gap = max(0, 0.7 - kp_avg_mastery[j])
        weak_rate = kp_weak_counts[j] / n_students
        depth = prerequisite_depth.get(kp_codes[j], 1)

        urgency = weak_rate * 0.4 + gap * 0.35 + min(depth / 5.0, 1.0) * 0.25

        priorities.append({
            "kp_code": kp_codes[j],
            "kp_name": _resolve_kp_name(kp_codes[j]),
            "avg_mastery": round(float(kp_avg_mastery[j]), 4),
            "weak_count": int(kp_weak_counts[j]),
            "weak_rate": round(float(weak_rate), 4),
            "prerequisite_depth": depth,
            "urgency_score": round(float(urgency), 4),
        })

    priorities.sort(key=lambda x: x["urgency_score"], reverse=True)

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "n_students": n_students,
        "n_kp": n_kp,
        "priorities": priorities,
        "top_priority": priorities[0] if priorities else None,
    }


def cluster_students(
    db: Session,
    homework_id: str,
    n_clusters: int = 3,
) -> dict:
    cdm_params = db.query(CDMParameter).filter(
        CDMParameter.homework_id == homework_id
    ).order_by(CDMParameter.estimated_at.desc()).first()

    if not cdm_params:
        return {"status": "error", "message": "请先运行CDM参数估计"}

    alpha_data = cdm_params.alpha or {}
    kp_codes = alpha_data.get("kp_codes", [])
    student_ids = alpha_data.get("student_ids", [])
    alpha_estimates = alpha_data.get("alpha_estimates", [])

    n_students = len(student_ids)
    n_kp = len(kp_codes)

    if n_students < n_clusters:
        n_clusters = max(1, n_students)

    X = np.array(alpha_estimates)
    centroids, labels = _simple_kmeans(X, n_clusters)

    clusters = []
    for c in range(n_clusters):
        members = [student_ids[i] for i in range(n_students) if labels[i] == c]
        cluster_alpha = X[labels == c]
        cluster_profile = {}
        for j in range(n_kp):
            cluster_profile[kp_codes[j]] = {
                "name": _resolve_kp_name(kp_codes[j]),
                "avg_mastery": round(float(np.mean(cluster_alpha[:, j])), 4) if len(cluster_alpha) > 0 else 0.0,
            }

        weak_kps_in_cluster = []
        for j in range(n_kp):
            avg_m = cluster_profile[kp_codes[j]]["avg_mastery"]
            if avg_m < 0.5:
                weak_kps_in_cluster.append({
                    "kp_code": kp_codes[j],
                    "kp_name": cluster_profile[kp_codes[j]]["name"],
                    "avg_mastery": avg_m,
                })
        weak_kps_in_cluster.sort(key=lambda x: x["avg_mastery"])

        clusters.append({
            "cluster_id": c,
            "size": len(members),
            "student_ids": members,
            "avg_overall_mastery": round(float(np.mean(cluster_alpha)), 4) if len(cluster_alpha) > 0 else 0.0,
            "weak_kps": weak_kps_in_cluster,
            "cluster_profile": cluster_profile,
            "label": _describe_cluster(cluster_alpha, weak_kps_in_cluster),
        })

    clusters.sort(key=lambda x: x["avg_overall_mastery"])

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "n_students": n_students,
        "n_clusters": n_clusters,
        "clusters": clusters,
    }


def generate_teaching_suggestions(
    db: Session,
    homework_id: str,
) -> dict:
    priority_result = compute_remediation_priority(db, homework_id)
    if priority_result.get("status") == "error":
        return priority_result

    cluster_result = cluster_students(db, homework_id)
    if cluster_result.get("status") == "error":
        return cluster_result

    priorities = priority_result.get("priorities", [])
    clusters = cluster_result.get("clusters", [])

    suggestions = []
    used_kps = set()

    for c in clusters:
        cluster_weak = c.get("weak_kps", [])
        group_suggestion = {
            "target_group": f"第{c['cluster_id'] + 1}组",
            "student_count": c["size"],
            "group_label": c.get("label", ""),
            "focus_kps": [],
            "strategy": [],
            "estimated_sessions": 0,
        }

        for wk in cluster_weak[:5]:
            kp_code = wk["kp_code"]
            if kp_code in used_kps:
                continue
            used_kps.add(kp_code)

            priority_match = next((p for p in priorities if p["kp_code"] == kp_code), None)
            urgency = priority_match["urgency_score"] if priority_match else 0.5
            depth = priority_match["prerequisite_depth"] if priority_match else 1

            exercises = "3-5轮练习" if wk["avg_mastery"] < 0.3 else "2-3轮练习"

            group_suggestion["focus_kps"].append({
                "kp_code": kp_code,
                "kp_name": wk["kp_name"],
                "current_mastery": wk["avg_mastery"],
                "urgency": round(urgency, 2),
            })

            group_suggestion["strategy"].append({
                "kp_code": kp_code,
                "kp_name": wk["kp_name"],
                "approach": _recommend_approach(wk["avg_mastery"], depth),
                "exercises": exercises,
                "expected_improvement": f"{round(min(0.3, 0.8 - wk['avg_mastery']) * 100)}%",
            })

            group_suggestion["estimated_sessions"] += depth

        group_suggestion["estimated_sessions"] = max(1, group_suggestion["estimated_sessions"])
        suggestions.append(group_suggestion)

    overall_priority = [p for p in priorities[:3] if p["kp_code"] not in used_kps]
    if overall_priority:
        suggestions.append({
            "target_group": "全班",
            "student_count": cluster_result.get("n_students", 0),
            "group_label": "通用知识点巩固",
            "focus_kps": overall_priority,
            "strategy": [
                {
                    "kp_code": p["kp_code"],
                    "kp_name": p["kp_name"],
                    "approach": _recommend_approach(p["avg_mastery"], p["prerequisite_depth"]),
                    "exercises": "全班练习+重点讲解",
                    "expected_improvement": f"{round(min(0.3, 0.7 - p['avg_mastery']) * 100)}%",
                }
                for p in overall_priority
            ],
            "estimated_sessions": len(overall_priority),
        })

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "generated_at": datetime.now().isoformat(),
        "suggestions": suggestions,
        "total_suggestions": len(suggestions),
    }


def _simple_kmeans(X: np.ndarray, k: int, max_iters: int = 50) -> tuple:
    n = X.shape[0]
    if n <= k:
        return X.copy(), np.arange(n)

    rng = np.random.RandomState(42)
    indices = rng.choice(n, k, replace=False)
    centroids = X[indices].copy()

    for _ in range(max_iters):
        distances = np.zeros((n, k))
        for c in range(k):
            distances[:, c] = np.sum((X - centroids[c]) ** 2, axis=1)
        labels = np.argmin(distances, axis=1)

        new_centroids = np.zeros_like(centroids)
        for c in range(k):
            members = X[labels == c]
            if len(members) > 0:
                new_centroids[c] = members.mean(axis=0)
            else:
                new_centroids[c] = centroids[c]

        if np.allclose(centroids, new_centroids):
            break
        centroids = new_centroids

    return centroids, labels


def _describe_cluster(alpha: np.ndarray, weak_kps: list[dict]) -> str:
    if len(alpha) == 0:
        return "未知"
    avg = np.mean(alpha)
    weak_count = len(weak_kps)

    if avg >= 0.7:
        return "掌握良好组——重点拓展提升"
    elif avg >= 0.5:
        if weak_count <= 2:
            return "基础稳固组——针对性查漏补缺"
        return "部分薄弱组——系统化巩固基础"
    elif avg >= 0.3:
        return "基础薄弱组——需要系统重建前置知识"
    else:
        return "严重落后组——需从最基础概念开始补习"


def _recommend_approach(mastery: float, depth: int) -> str:
    if mastery < 0.2:
        base = "从基础概念入手，配合实物演示和形象化教学"
    elif mastery < 0.35:
        base = "讲解核心概念后，安排基础练习巩固"
    elif mastery < 0.5:
        base = "讲解薄弱环节，配合针对性例题训练"
    else:
        base = "梳理知识框架，查漏补缺"

    if depth > 2:
        base += "，注意补充前置知识点"
    return base


def _resolve_kp_name(kp_code: str) -> str:
    entity = find_entity(kp_code)
    if entity:
        return entity.get("name", kp_code)
    return kp_code


def _get_prerequisite_depth_map() -> dict[str, int]:
    from app.services.knowledge_service import get_prerequisite_chain
    store = _get_store()
    kps = store["entities"].get("KnowledgePoint", {})
    depth_map = {}
    for kp_code in kps:
        chains = get_prerequisite_chain(kp_code, max_depth=10)
        if chains:
            depth_map[kp_code] = max(c.get("depth", 0) for c in chains)
        else:
            depth_map[kp_code] = 0
    return depth_map