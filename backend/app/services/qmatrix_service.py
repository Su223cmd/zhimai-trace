import numpy as np
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.db_models import Homework, Question, StudentAnswer, KnowledgePoint, GraphEntity
from app.services.knowledge_service import _get_store
import json

logger = logging.getLogger(__name__)


def generate_q_matrix(db: Session, homework_id: str, method: str = "nlp") -> dict:
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        return {"status": "error", "message": "作业不存在"}

    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    if not questions:
        return {"status": "error", "message": "作业没有题目"}

    project_id = hw.project_id
    kps = _get_knowledge_points(db, project_id)
    if not kps:
        return {"status": "error", "message": "项目中没有知识点，请先导入课标或解析课件"}

    kp_codes = [kp["code"] for kp in kps]
    kp_names = [kp["name"] for kp in kps]
    n_questions = len(questions)
    n_kps = len(kp_codes)

    q_matrix = np.zeros((n_questions, n_kps), dtype=int)

    if method == "nlp":
        for i, q in enumerate(questions):
            matched = _nlp_match(q.content, kp_names, kp_codes)
            for kp_idx in matched:
                q_matrix[i][kp_idx] = 1
    elif method == "manual":
        for i, q in enumerate(questions):
            if q.q_matrix:
                for kp_code, val in q.q_matrix.items():
                    if kp_code in kp_codes:
                        q_matrix[i][kp_codes.index(kp_code)] = int(val)
    elif method == "llm":
        import httpx
        from app.config import settings
        if not settings.deepseek_api_key:
            for i, q in enumerate(questions):
                matched = _nlp_match(q.content, kp_names, kp_codes)
                for kp_idx in matched:
                    q_matrix[i][kp_idx] = 1
        else:
            for i, q in enumerate(questions):
                matched = _llm_match_sync(httpx, settings, q.content, kp_names, kp_codes)
                for kp_idx in matched:
                    q_matrix[i][kp_idx] = 1

    unmatched_count = 0
    for i, q in enumerate(questions):
        row = q_matrix[i]
        if np.sum(row) == 0:
            unmatched_count += 1
            logger.warning("Question %d (seq=%d) matched no knowledge points, left as all-zeros for manual review", i, q.seq)

        q_matrix_dict = {kp_codes[j]: int(q_matrix[i][j]) for j in range(n_kps) if q_matrix[i][j] > 0}
        q.q_matrix = q_matrix_dict
        q.q_matrix_source = method
        q.q_matrix_confirmed = False

    db.commit()

    if unmatched_count > 0:
        logger.warning("Q-matrix: %d/%d questions had no KP match, please review manually", unmatched_count, n_questions)

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "method": method,
        "n_questions": n_questions,
        "n_knowledge_points": n_kps,
        "q_matrix": q_matrix.tolist(),
        "kp_codes": kp_codes,
        "kp_names": kp_names,
    }


def get_q_matrix(db: Session, homework_id: str) -> dict:
    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    if not questions:
        return {"status": "error", "message": "没有题目"}

    has_q_matrix = any(q.q_matrix for q in questions)
    if not has_q_matrix:
        return {"status": "pending", "message": "Q矩阵尚未生成，请先调用generate"}

    project_id = db.query(Homework).filter(Homework.id == homework_id).first().project_id
    kps = _get_knowledge_points(db, project_id)
    kp_codes = [kp["code"] for kp in kps]
    kp_names = [kp["name"] for kp in kps]

    q_matrix = []
    for q in questions:
        row = []
        for kp_code in kp_codes:
            row.append(q.q_matrix.get(kp_code, 0) if q.q_matrix else 0)
        q_matrix.append({
            "question_id": str(q.id),
            "seq": q.seq,
            "content": q.content,
            "q_vector": row,
            "confirmed": q.q_matrix_confirmed,
        })

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "kp_codes": kp_codes,
        "kp_names": kp_names,
        "questions": q_matrix,
    }


def confirm_q_matrix(db: Session, homework_id: str, adjustments: Optional[dict] = None) -> dict:
    questions = db.query(Question).filter(Question.homework_id == homework_id).all()

    if adjustments:
        for q_id, kp_mapping in adjustments.items():
            q = db.query(Question).filter(Question.id == q_id).first()
            if q:
                q.q_matrix = kp_mapping

    for q in questions:
        q.q_matrix_confirmed = True

    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if hw:
        hw.status = "q_matrix_confirmed"

    db.commit()
    return {"status": "success", "message": "Q矩阵已确认", "homework_id": str(homework_id)}


def validate_q_matrix(db: Session, homework_id: str) -> dict:
    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    if not questions:
        return {"status": "error", "message": "没有题目"}

    project_id = db.query(Homework).filter(Homework.id == homework_id).first().project_id
    kps = _get_knowledge_points(db, project_id)
    kp_codes = [kp["code"] for kp in kps]

    warnings = []
    q_matrix = []
    for q in questions:
        row = []
        for kp_code in kp_codes:
            row.append(q.q_matrix.get(kp_code, 0) if q.q_matrix else 0)
        q_matrix.append(row)

        if not q.q_matrix:
            warnings.append(f"第{q.seq}题未关联任何知识点")
        elif sum(q.q_matrix.values()) == 0:
            warnings.append(f"第{q.seq}题Q矩阵全为0")
        if sum(q.q_matrix.values()) > 3 if q.q_matrix else False:
            warnings.append(f"第{q.seq}题关联了{sum(q.q_matrix.values())}个知识点，可能过多")

    q_np = np.array(q_matrix)
    kp_coverage = np.sum(q_np, axis=0)
    for i, count in enumerate(kp_coverage):
        if count == 0:
            warnings.append(f"知识点 {kp_codes[i]} 未被任何题目考查")

    covered_kps = int(np.sum(kp_coverage > 0))
    total_kps = len(kp_codes)

    return {
        "status": "success",
        "warnings": warnings,
        "kp_coverage": covered_kps,
        "total_kps": total_kps,
        "coverage_rate": round(covered_kps / max(total_kps, 1), 2),
        "n_questions": len(questions),
    }


def _get_knowledge_points(db: Session, project_id: str) -> list[dict]:
    result = []
    if project_id:
        entities = db.query(GraphEntity).filter(
            GraphEntity.project_id == project_id,
            GraphEntity.entity_type == "KnowledgePoint",
        ).all()
        for e in entities:
            result.append({"code": e.code, "name": e.name or e.code})
    if not result:
        db_kps = db.query(KnowledgePoint).filter(
            KnowledgePoint.source_type == "curriculum"
        ).all()
        for kp in db_kps:
            result.append({"code": kp.code, "name": kp.name})
    
    if not result:
        store = _get_store()
        kps = store["entities"].get("KnowledgePoint", {})
        for code, entity in kps.items():
            result.append({"code": code, "name": entity.get("name", code)})

    return result


def _nlp_match(question_content: str, kp_names: list[str], kp_codes: list[str]) -> list[int]:
    matched = []
    content_lower = question_content.lower()
    for i, name in enumerate(kp_names):
        if name and len(name) >= 2 and name in content_lower:
            matched.append(i)
        else:
            name_chars = set(name) if name else set()
            content_chars = set(content_lower)
            if len(name_chars) > 0:
                overlap = len(name_chars & content_chars) / len(name_chars)
                if overlap > 0.6:
                    matched.append(i)
    return matched


def _llm_match_sync(httpx_module, settings_module, question_content: str, kp_names: list[str], kp_codes: list[str]) -> list[int]:
    kp_list = "\n".join([f"{i+1}. {name} ({code})" for i, (name, code) in enumerate(zip(kp_names, kp_codes))])
    prompt = f"""判断以下题目考查了哪些知识点，返回知识点编号。

题目：{question_content}

知识点列表：
{kp_list}

只返回编号，用逗号分隔，例如：1,3,5"""

    for attempt in range(3):
        try:
            resp = httpx_module.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings_module.deepseek_api_key}"},
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 100,
                },
                timeout=30,
            )

            if resp.status_code == 200:
                text = resp.json()["choices"][0]["message"]["content"].strip()
                indices = []
                for part in text.split(","):
                    part = part.strip()
                    if part.isdigit():
                        idx = int(part) - 1
                        if 0 <= idx < len(kp_codes):
                            indices.append(idx)
                return indices
            if resp.status_code in (429, 502, 503) and attempt < 2:
                import time
                time.sleep(1.0 * (2 ** attempt))
                continue
            logger.warning("LLM Q-matrix sync returned %d", resp.status_code)
            break
        except Exception as e:
            if attempt < 2:
                import time
                time.sleep(1.0 * (2 ** attempt))
                continue
            logger.error("LLM Q-matrix matching failed for question '%s': %s", question_content[:50], str(e))

    return _nlp_match(question_content, kp_names, kp_codes)


async def _llm_match_async(question_content: str, kp_names: list[str], kp_codes: list[str]) -> list[int]:
    from app.config import settings
    import httpx
    import asyncio

    if not settings.deepseek_api_key:
        return _nlp_match(question_content, kp_names, kp_codes)

    kp_list = "\n".join([f"{i+1}. {name} ({code})" for i, (name, code) in enumerate(zip(kp_names, kp_codes))])
    prompt = f"""判断以下题目考查了哪些知识点，返回知识点编号。

题目：{question_content}

知识点列表：
{kp_list}

只返回编号，用逗号分隔，例如：1,3,5"""

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
                    json={
                        "model": "deepseek-chat",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "max_tokens": 100,
                    },
                )

            if resp.status_code == 200:
                text = resp.json()["choices"][0]["message"]["content"].strip()
                indices = []
                for part in text.split(","):
                    part = part.strip()
                    if part.isdigit():
                        idx = int(part) - 1
                        if 0 <= idx < len(kp_codes):
                            indices.append(idx)
                return indices
            if resp.status_code in (429, 502, 503) and attempt < 2:
                await asyncio.sleep(1.0 * (2 ** attempt))
                continue
            logger.warning("LLM Q-matrix async returned %d", resp.status_code)
            break
        except Exception as e:
            if attempt < 2:
                await asyncio.sleep(1.0 * (2 ** attempt))
                continue
            logger.error("LLM Q-matrix matching failed for question '%s': %s", question_content[:50], str(e))

    return _nlp_match(question_content, kp_names, kp_codes)


async def generate_q_matrix_async(db: Session, homework_id: str, method: str = "nlp") -> dict:
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        return {"status": "error", "message": "作业不存在"}

    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    if not questions:
        return {"status": "error", "message": "作业没有题目"}

    project_id = hw.project_id
    kps = _get_knowledge_points(db, project_id)
    if not kps:
        return {"status": "error", "message": "项目中没有知识点，请先导入课标或解析课件"}

    kp_codes = [kp["code"] for kp in kps]
    kp_names = [kp["name"] for kp in kps]
    n_questions = len(questions)
    n_kps = len(kp_codes)

    q_matrix = np.zeros((n_questions, n_kps), dtype=int)

    if method == "nlp":
        for i, q in enumerate(questions):
            matched = _nlp_match(q.content, kp_names, kp_codes)
            for kp_idx in matched:
                q_matrix[i][kp_idx] = 1
    elif method == "manual":
        for i, q in enumerate(questions):
            if q.q_matrix:
                for kp_code, val in q.q_matrix.items():
                    if kp_code in kp_codes:
                        q_matrix[i][kp_codes.index(kp_code)] = int(val)
    elif method == "llm":
        for i, q in enumerate(questions):
            matched = await _llm_match_async(q.content, kp_names, kp_codes)
            for kp_idx in matched:
                q_matrix[i][kp_idx] = 1

    unmatched_count = 0
    for i, q in enumerate(questions):
        row = q_matrix[i]
        if np.sum(row) == 0:
            unmatched_count += 1
            logger.warning("Question %d (seq=%d) matched no knowledge points, left as all-zeros for manual review", i, q.seq)

        q_matrix_dict = {kp_codes[j]: int(q_matrix[i][j]) for j in range(n_kps) if q_matrix[i][j] > 0}
        q.q_matrix = q_matrix_dict
        q.q_matrix_source = method
        q.q_matrix_confirmed = False

    db.commit()

    if unmatched_count > 0:
        logger.warning("Q-matrix: %d/%d questions had no KP match, please review manually", unmatched_count, n_questions)

    return {
        "status": "success",
        "homework_id": str(homework_id),
        "method": method,
        "n_questions": n_questions,
        "n_knowledge_points": n_kps,
        "q_matrix": q_matrix.tolist(),
        "kp_codes": kp_codes,
        "kp_names": kp_names,
    }
