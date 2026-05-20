from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.agent_config_service import (
    get_agent_configs,
    get_agent_config,
    upsert_agent_config,
    delete_agent_config,
    get_execution_logs,
)

router = APIRouter(prefix="/api/agent", tags=["agent"])


class UpsertConfigRequest(BaseModel):
    agent_name: str
    config_key: str
    config_value: str
    value_type: str = "string"
    description: Optional[str] = None


# --- Config APIs ---

@router.get("/configs")
async def api_list_configs(agent_name: Optional[str] = None, db: Session = Depends(get_db)):
    return {"status": "success", "configs": get_agent_configs(db, agent_name)}


@router.get("/config/{agent_name}/{config_key}")
async def api_get_config(agent_name: str, config_key: str, db: Session = Depends(get_db)):
    result = get_agent_config(db, agent_name, config_key)
    if not result:
        raise HTTPException(status_code=404, detail="配置项不存在")
    return {"status": "success", "config": result}


@router.put("/config")
async def api_upsert_config(req: UpsertConfigRequest, db: Session = Depends(get_db)):
    result = upsert_agent_config(db, req.agent_name, req.config_key, req.config_value, req.value_type, req.description)
    return {"status": "success", "config": result}


@router.delete("/config/{agent_name}/{config_key}")
async def api_delete_config(agent_name: str, config_key: str, db: Session = Depends(get_db)):
    deleted = delete_agent_config(db, agent_name, config_key)
    if not deleted:
        raise HTTPException(status_code=404, detail="配置项不存在")
    return {"status": "success"}


# --- Execution Log APIs ---

@router.get("/logs")
async def api_list_logs(
    agent_name: Optional[str] = None,
    context_type: Optional[str] = None,
    context_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    return {"status": "success", "logs": get_execution_logs(db, agent_name, context_type, context_id, limit)}
