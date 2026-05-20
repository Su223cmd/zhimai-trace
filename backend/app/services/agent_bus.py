import logging
import uuid
from datetime import datetime
from typing import Optional, Callable
from sqlalchemy.orm import Session
from app.models.db_models import AgentMessage, AgentEvent, AgentNotification, AgentState

logger = logging.getLogger(__name__)

AGENT_NAMES = ["diagnosis", "knowledge", "tracing", "teaching", "evolution"]


class AgentBus:
    _handlers: dict[str, dict[str, Callable]] = {}
    _initialized = False

    @classmethod
    def register(cls, agent_name: str, event_type: str, handler: Callable):
        if agent_name not in cls._handlers:
            cls._handlers[agent_name] = {}
        cls._handlers[agent_name][event_type] = handler
        logger.info("AgentBus: registered %s ← %s", agent_name, event_type)

    @classmethod
    def send(cls, db: Session, sender: str, receiver: str, event_type: str, payload: dict, parent_id: Optional[str] = None) -> AgentMessage:
        if sender not in AGENT_NAMES:
            raise ValueError(f"Unknown agent: {sender}")
        if receiver not in AGENT_NAMES:
            raise ValueError(f"Unknown agent: {receiver}")

        msg = AgentMessage(
            id=str(uuid.uuid4()),
            sender_agent=sender,
            receiver_agent=receiver,
            message_type=event_type,
            payload=payload,
            parent_message_id=parent_id,
        )
        db.add(msg)

        event = AgentEvent(
            event_type=f"{sender}_to_{receiver}:{event_type}",
            source_type="agent_bus",
            source_id=0,
            payload={"message_id": msg.id, **payload},
        )
        db.add(event)
        db.commit()
        db.refresh(msg)

        cls._dispatch(db, msg)
        return msg

    @classmethod
    def broadcast(cls, db: Session, sender: str, event_type: str, payload: dict, exclude: Optional[list[str]] = None) -> list[AgentMessage]:
        exclude = exclude or [sender]
        targets = [a for a in AGENT_NAMES if a not in exclude]
        messages = []
        for target in targets:
            msg = cls.send(db, sender, target, event_type, payload)
            messages.append(msg)
        return messages

    @classmethod
    def _dispatch(cls, db: Session, msg: AgentMessage):
        agent_handlers = cls._handlers.get(msg.receiver_agent, {})
        handler = agent_handlers.get(msg.message_type)
        if handler:
            try:
                handler(db, msg)
                msg.status = "processed"
                msg.processed_at = datetime.now()
            except Exception as e:
                logger.error("AgentBus dispatch error: %s → %s [%s]: %s", msg.sender_agent, msg.receiver_agent, msg.message_type, str(e))
                msg.status = "failed"
                msg.processed_at = datetime.now()
        else:
            msg.status = "no_handler"
            msg.processed_at = datetime.now()
        db.commit()

    @classmethod
    def get_agent_state(cls, db: Session, agent_name: str) -> Optional[AgentState]:
        return db.query(AgentState).filter(AgentState.agent_name == agent_name).first()

    @classmethod
    def update_agent_state(cls, db: Session, agent_name: str, event_type: str, state_data: Optional[dict] = None):
        state = cls.get_agent_state(db, agent_name)
        if state:
            state.last_event_type = event_type
            state.last_event_time = datetime.now()
            if state_data:
                existing = state.state_data or {}
                existing.update(state_data)
                state.state_data = existing
            state.updated_at = datetime.now()
        else:
            state = AgentState(
                agent_name=agent_name,
                status="active",
                last_event_type=event_type,
                last_event_time=datetime.now(),
                state_data=state_data or {},
            )
            db.add(state)
        db.commit()

    @classmethod
    def initialize_all_agents(cls, db: Session):
        for name in AGENT_NAMES:
            state = cls.get_agent_state(db, name)
            if not state:
                state = AgentState(
                    agent_name=name,
                    status="active",
                    state_data={},
                )
                db.add(state)
        db.commit()
        cls._initialized = True
        logger.info("AgentBus: initialized %d agents", len(AGENT_NAMES))

    @classmethod
    def get_all_states(cls, db: Session) -> list[dict]:
        results = []
        for name in AGENT_NAMES:
            state = cls.get_agent_state(db, name)
            results.append({
                "name": name,
                "status": state.status if state else "unknown",
                "last_event_type": state.last_event_type if state else None,
                "last_event_time": state.last_event_time.isoformat() if state and state.last_event_time else None,
                "state_data": state.state_data if state else {},
            })
        return results

    @classmethod
    def get_messages(cls, db: Session, agent_name: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> list[dict]:
        query = db.query(AgentMessage)
        if agent_name:
            query = query.filter(
                (AgentMessage.sender_agent == agent_name) | (AgentMessage.receiver_agent == agent_name)
            )
        if status:
            query = query.filter(AgentMessage.status == status)
        messages = query.order_by(AgentMessage.created_at.desc()).limit(limit).all()
        return [
            {
                "id": str(m.id),
                "sender": m.sender_agent,
                "receiver": m.receiver_agent,
                "type": m.message_type,
                "payload": m.payload,
                "status": m.status,
                "parent_id": str(m.parent_message_id) if m.parent_message_id else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "processed_at": m.processed_at.isoformat() if m.processed_at else None,
            }
            for m in messages
        ]

    @classmethod
    def notify_teacher(cls, db: Session, teacher_id: int, notification_type: str, title: str, content: str):
        notification = AgentNotification(
            teacher_id=teacher_id,
            notification_type=notification_type,
            title=title,
            content=content,
        )
        db.add(notification)
        db.commit()
