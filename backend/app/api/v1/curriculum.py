from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.curriculum_service import (
    import_default_curriculum,
    get_curriculum_tree,
)

router = APIRouter(prefix="/api/curriculum", tags=["curriculum"])


@router.post("/import")
async def import_curriculum(db: Session = Depends(get_db)):
    result = import_default_curriculum(db)
    from app.services.agent_bus import AgentBus
    AgentBus.update_agent_state(db, "knowledge", "curriculum_imported", {
        "entity_count": result.get("entity_count", 0),
        "relation_count": result.get("relation_count", 0),
    })
    AgentBus.send(db, "knowledge", "diagnosis", "graph_updated", {
        "source": "curriculum",
        "entity_count": result.get("entity_count", 0),
    })
    return result


@router.get("/tree")
async def get_tree():
    tree = get_curriculum_tree()
    return tree


@router.post("/align")
async def align_courseware():
    return {"message": "课件对齐需要课件ID参数，请通过知识图谱同步接口触发"}
