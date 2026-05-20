from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.agent_service import (
    send_agent_message, get_agent_messages, get_agent_statuses,
    register_all_agents,
)
from app.services.agent_bus import AgentBus, AGENT_NAMES
from app.models.db_models import AgentEvent, AgentMessage, AgentNotification

router = APIRouter(prefix="/api/agent", tags=["agent"])

AGENT_DESCRIPTIONS = {
    "diagnosis": "CDM参数估计与知识状态推断，根因追溯",
    "knowledge": "知识图谱管理，EDC关系提取，语义对齐",
    "tracing": "BKT知识追踪，遗忘曲线，掌握率预测",
    "teaching": "学习路径生成，教学建议，练习推荐",
    "evolution": "在线EM参数更新，漂移检测，模型演化",
}


class AgentMessageCreate(BaseModel):
    sender: str
    receiver: str
    message_type: str
    payload: dict
    parent_message_id: Optional[str] = None


@router.get("/agents")
async def list_agents(db: Session = Depends(get_db)):
    states = get_agent_statuses(db)
    agents = []
    for state in states:
        name = state["name"]
        agents.append({
            "name": name,
            "description": AGENT_DESCRIPTIONS.get(name, ""),
            "status": state["status"],
            "last_event_type": state["last_event_type"],
            "last_event_time": state["last_event_time"],
        })
    return {"agents": agents, "total": len(agents)}


@router.get("/agents/{agent_name}")
async def get_agent_detail(
    agent_name: str,
    db: Session = Depends(get_db),
):
    if agent_name not in AGENT_NAMES:
        raise HTTPException(status_code=404, detail=f"未知Agent: {agent_name}")
    state = AgentBus.get_agent_state(db, agent_name)
    messages_sent = db.query(AgentMessage).filter(AgentMessage.sender_agent == agent_name).count()
    messages_received = db.query(AgentMessage).filter(AgentMessage.receiver_agent == agent_name).count()
    return {
        "name": agent_name,
        "description": AGENT_DESCRIPTIONS.get(agent_name, ""),
        "status": state.status if state else "unknown",
        "last_event_type": state.last_event_type if state else None,
        "last_event_time": state.last_event_time.isoformat() if state and state.last_event_time else None,
        "state_data": state.state_data if state else {},
        "messages_sent": messages_sent,
        "messages_received": messages_received,
    }


@router.get("/events")
async def get_events(
    event_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(AgentEvent)
    if event_type:
        query = query.filter(AgentEvent.event_type == event_type)
    events = query.order_by(AgentEvent.created_at.desc()).limit(limit).all()
    return {
        "total": len(events),
        "items": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "source_type": e.source_type,
                "payload": e.payload,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


@router.get("/notifications")
async def get_notifications(
    teacher_id: int = 1,
    is_read: Optional[bool] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(AgentNotification).filter(AgentNotification.teacher_id == teacher_id)
    if is_read is not None:
        query = query.filter(AgentNotification.is_read == is_read)
    notifications = query.order_by(AgentNotification.created_at.desc()).limit(limit).all()
    return {
        "total": len(notifications),
        "items": [
            {
                "id": n.id,
                "notification_type": n.notification_type,
                "title": n.title,
                "content": n.content,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
    }


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
):
    notification = db.query(AgentNotification).filter(AgentNotification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    notification.is_read = True
    db.commit()
    return {"status": "read", "id": notification_id}


@router.get("/messages")
async def get_messages(
    agent_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    items = get_agent_messages(db, agent_name, status, limit)
    return {"total": len(items), "items": items}


@router.post("/messages")
async def create_agent_message(
    msg: AgentMessageCreate,
    db: Session = Depends(get_db),
):
    if msg.sender not in AGENT_NAMES:
        raise HTTPException(status_code=400, detail=f"未知Agent类型: {msg.sender}")
    if msg.receiver not in AGENT_NAMES:
        raise HTTPException(status_code=400, detail=f"未知Agent类型: {msg.receiver}")

    result = send_agent_message(db, msg.sender, msg.receiver, msg.message_type, msg.payload)
    return result


@router.post("/initialize")
async def initialize_agents(db: Session = Depends(get_db)):
    register_all_agents()
    AgentBus.initialize_all_agents(db)
    return {"status": "initialized", "agents": AGENT_NAMES}
