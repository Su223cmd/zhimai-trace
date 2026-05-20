from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.config import settings
import os

router = APIRouter(prefix="/api/settings", tags=["settings"])


class LLMConfigUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None


@router.get("/llm")
async def get_llm_config():
    provider = os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER)
    if provider == "zhipu":
        api_key = os.getenv("ZHIPU_API_KEY", settings.ZHIPU_API_KEY)
        base_url = os.getenv("ZHIPU_BASE_URL", settings.ZHIPU_BASE_URL)
    else:
        api_key = os.getenv("DEEPSEEK_API_KEY", settings.DEEPSEEK_API_KEY)
        base_url = os.getenv("DEEPSEEK_BASE_URL", settings.DEEPSEEK_BASE_URL)

    return {
        "provider": provider,
        "api_key": api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***" if api_key else "",
        "base_url": base_url,
        "configured": bool(api_key),
    }


@router.put("/llm")
async def update_llm_config(config: LLMConfigUpdate):
    if config.provider:
        os.environ["LLM_PROVIDER"] = config.provider
    if config.api_key:
        provider = config.provider or os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER)
        if provider == "zhipu":
            os.environ["ZHIPU_API_KEY"] = config.api_key
        else:
            os.environ["DEEPSEEK_API_KEY"] = config.api_key
    if config.base_url:
        provider = config.provider or os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER)
        if provider == "zhipu":
            os.environ["ZHIPU_BASE_URL"] = config.base_url
        else:
            os.environ["DEEPSEEK_BASE_URL"] = config.base_url

    return {"status": "updated"}


@router.post("/llm/test")
async def test_llm_connection():
    provider = os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER)
    if provider == "zhipu":
        api_key = os.getenv("ZHIPU_API_KEY", settings.ZHIPU_API_KEY)
        base_url = os.getenv("ZHIPU_BASE_URL", settings.ZHIPU_BASE_URL)
    else:
        api_key = os.getenv("DEEPSEEK_API_KEY", settings.DEEPSEEK_API_KEY)
        base_url = os.getenv("DEEPSEEK_BASE_URL", settings.DEEPSEEK_BASE_URL)

    if not api_key:
        return {"status": "error", "message": "API Key 未配置"}

    try:
        import httpx
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "glm-4-flash" if provider == "zhipu" else "deepseek-chat",
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{base_url}/chat/completions", json=payload, headers=headers)
            if resp.status_code == 200:
                return {"status": "success", "message": f"连接成功 ({provider})"}
            else:
                return {"status": "error", "message": f"API返回 {resp.status_code}: {resp.text[:100]}"}
    except Exception as e:
        return {"status": "error", "message": f"连接失败: {str(e)}"}
