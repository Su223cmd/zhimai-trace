import json
import logging
import asyncio
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0


async def call_llm(api_key: str, prompt: str, model: str = "deepseek-chat", temperature: float = 0.1) -> str | None:
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.deepseek_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": temperature,
                    },
                )
                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
                if response.status_code in (429, 502, 503) and attempt < _MAX_RETRIES - 1:
                    delay = _RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning("LLM API returned %d, retrying in %.1fs (attempt %d/%d)", response.status_code, delay, attempt + 1, _MAX_RETRIES)
                    await asyncio.sleep(delay)
                    continue
                logger.warning("LLM API returned status %d", response.status_code)
                return None
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            if attempt < _MAX_RETRIES - 1:
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning("LLM network error: %s, retrying in %.1fs (attempt %d/%d)", str(e), delay, attempt + 1, _MAX_RETRIES)
                await asyncio.sleep(delay)
                continue
            logger.error("LLM API call failed after %d retries: %s", _MAX_RETRIES, str(e))
        except Exception as e:
            logger.error("LLM API call failed: %s", str(e))
            return None
    return None


def parse_json_response(content: str | None) -> list | dict | None:
    if not content:
        return None
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
    if content.startswith("json"):
        content = content[4:].strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


async def call_llm_for_extraction(slide_text: str) -> list[dict]:
    api_key = settings.deepseek_api_key
    if not api_key:
        return _fallback_extraction(slide_text)

    prompt = f"""从以下课件内容中提取知识点。每个知识点包含：
- name: 知识点名称（简洁，5-10字）
- cognitive_level: 认知层级（remember/understand/apply/analyze/evaluate/create）
- is_key_point: 是否重点（true/false）

课件内容：
{slide_text}

请以JSON数组格式输出，例如：
[{{"name": "大气受热过程", "cognitive_level": "understand", "is_key_point": true}}]

只输出JSON，不要其他内容。"""

    content = await call_llm(api_key, prompt)
    if content:
        kps = parse_json_response(content)
        if isinstance(kps, list) and len(kps) > 0:
            return kps
    return _fallback_extraction(slide_text)


async def call_llm_for_relation_extraction(slide_text: str, entity_names: list[str]) -> list[dict]:
    api_key = settings.deepseek_api_key
    if not api_key:
        return []

    entity_list = "、".join(entity_names[:30])

    prompt = f"""从以下课件内容中，识别知识点之间的关系。

知识点列表：{entity_list}

关系类型（只能使用以下类型）：
- PREREQUISITE_OF: 前置依赖（A是B的前置知识）
- CONTAINS: 包含（A包含B）
- APPLIES: 应用（A应用于B）
- REQUIRES: 需要（A需要B）
- SIMILAR_TO: 相似（A与B相似）
- CONTRASTS_WITH: 对比（A与B对比）
- PART_OF: 属于（A属于B）

课件内容：
{slide_text}

请以JSON数组格式输出关系三元组，例如：
[{{"source": "大气受热过程", "target": "大气逆辐射", "relation": "PREREQUISITE_OF", "confidence": 0.8}}]

只输出JSON，不要其他内容。如果没有发现关系，输出空数组 []。"""

    content = await call_llm(api_key, prompt, temperature=0.2)
    if content:
        relations = parse_json_response(content)
        if isinstance(relations, list):
            valid_types = {"PREREQUISITE_OF", "CONTAINS", "APPLIES", "REQUIRES", "SIMILAR_TO", "CONTRASTS_WITH", "PART_OF"}
            return [r for r in relations if isinstance(r, dict) and r.get("relation") in valid_types]
    return []


async def call_llm_for_semantic_align(source_name: str, candidate_names: list[dict]) -> dict | None:
    api_key = settings.deepseek_api_key
    if not api_key:
        return None

    candidates_str = "\n".join([f"- {c['name']} (编码: {c['code']})" for c in candidate_names[:20]])

    prompt = f"""判断以下课件知识点与哪个课标知识点是同一概念。

课件知识点：{source_name}

课标候选知识点：
{candidates_str}

如果没有匹配的，返回 {{"matched": false}}。
如果有匹配的，返回 {{"matched": true, "code": "匹配的编码", "name": "匹配的名称", "confidence": 0.9}}。

只输出JSON，不要其他内容。"""

    content = await call_llm(api_key, prompt, temperature=0.0)
    if content:
        result = parse_json_response(content)
        if isinstance(result, dict) and result.get("matched"):
            return result
    return None


def _fallback_extraction(slide_text: str) -> list[dict]:
    lines = slide_text.split("\n")
    kps = []
    for line in lines:
        line = line.strip()
        if len(line) >= 2 and len(line) <= 20 and not line.startswith("第") and not line.startswith("章"):
            kps.append({
                "name": line,
                "cognitive_level": "understand",
                "is_key_point": False,
            })
    return kps[:15]
