import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.db_models import AgentExecutionLog, AgentConfig

logger = logging.getLogger(__name__)


# --- AgentExecutionLog ---

def create_execution_log(
    db: Session,
    agent_name: str,
    task_type: str,
    context_type: Optional[str] = None,
    context_id: Optional[str] = None,
    input_summary: Optional[dict] = None,
) -> AgentExecutionLog:
    log = AgentExecutionLog(
        agent_name=agent_name,
        task_type=task_type,
        status="running",
        context_type=context_type,
        context_id=context_id,
        input_summary=input_summary,
        steps=[],
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def finish_execution_log(
    db: Session,
    log_id: str,
    status: str = "completed",
    output_summary: Optional[dict] = None,
    steps: Optional[list] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> Optional[AgentExecutionLog]:
    from datetime import datetime

    log = db.query(AgentExecutionLog).filter(AgentExecutionLog.id == log_id).first()
    if not log:
        return None

    log.status = status
    log.output_summary = output_summary
    log.steps = steps
    log.error_message = error_message
    log.duration_ms = duration_ms
    log.finished_at = datetime.now()
    db.commit()
    db.refresh(log)
    return log


def get_execution_logs(
    db: Session,
    agent_name: Optional[str] = None,
    context_type: Optional[str] = None,
    context_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    query = db.query(AgentExecutionLog)
    if agent_name:
        query = query.filter(AgentExecutionLog.agent_name == agent_name)
    if context_type:
        query = query.filter(AgentExecutionLog.context_type == context_type)
    if context_id:
        query = query.filter(AgentExecutionLog.context_id == context_id)

    logs = query.order_by(AgentExecutionLog.started_at.desc()).limit(limit).all()
    return [_serialize_log(l) for l in logs]


def _serialize_log(log: AgentExecutionLog) -> dict:
    return {
        "id": str(log.id),
        "agent_name": log.agent_name,
        "task_type": log.task_type,
        "status": log.status,
        "input_summary": log.input_summary,
        "output_summary": log.output_summary,
        "steps": log.steps,
        "error_message": log.error_message,
        "duration_ms": log.duration_ms,
        "context_type": log.context_type,
        "context_id": log.context_id,
        "started_at": log.started_at.isoformat() if log.started_at else None,
        "finished_at": log.finished_at.isoformat() if log.finished_at else None,
    }


# --- AgentConfig ---

def get_agent_configs(db: Session, agent_name: Optional[str] = None) -> list[dict]:
    query = db.query(AgentConfig)
    if agent_name:
        query = query.filter(AgentConfig.agent_name == agent_name)
    configs = query.all()
    return [_serialize_config(c) for c in configs]


def get_agent_config(db: Session, agent_name: str, config_key: str) -> Optional[dict]:
    cfg = db.query(AgentConfig).filter(
        AgentConfig.agent_name == agent_name,
        AgentConfig.config_key == config_key,
    ).first()
    return _serialize_config(cfg) if cfg else None


def upsert_agent_config(
    db: Session,
    agent_name: str,
    config_key: str,
    config_value: str,
    value_type: str = "string",
    description: Optional[str] = None,
) -> dict:
    cfg = db.query(AgentConfig).filter(
        AgentConfig.agent_name == agent_name,
        AgentConfig.config_key == config_key,
    ).first()

    if cfg:
        cfg.config_value = config_value
        cfg.value_type = value_type
        if description:
            cfg.description = description
    else:
        cfg = AgentConfig(
            agent_name=agent_name,
            config_key=config_key,
            config_value=config_value,
            value_type=value_type,
            description=description,
        )
        db.add(cfg)

    db.commit()
    db.refresh(cfg)
    return _serialize_config(cfg)


def delete_agent_config(db: Session, agent_name: str, config_key: str) -> bool:
    cfg = db.query(AgentConfig).filter(
        AgentConfig.agent_name == agent_name,
        AgentConfig.config_key == config_key,
    ).first()
    if not cfg:
        return False
    db.delete(cfg)
    db.commit()
    return True


def get_config_value(db: Session, agent_name: str, config_key: str, default: str = "") -> str:
    result = get_agent_config(db, agent_name, config_key)
    return result["config_value"] if result else default


def _serialize_config(cfg: AgentConfig) -> dict:
    return {
        "id": str(cfg.id),
        "agent_name": cfg.agent_name,
        "config_key": cfg.config_key,
        "config_value": cfg.config_value,
        "value_type": cfg.value_type,
        "description": cfg.description,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }
