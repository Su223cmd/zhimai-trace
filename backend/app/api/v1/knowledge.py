from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.knowledge_service import (
    sync_from_db,
    persist_to_db,
    get_graph,
    get_prerequisite_chain,
    get_downstream,
    add_relation,
    add_entity,
    update_entity,
    remove_entity,
    find_entity,
    get_related_entities,
    edc_pipeline,
    fuse_courseware_curriculum,
    ENTITY_TYPES,
    RELATION_TYPES,
)
from app.services.curriculum_service import import_default_curriculum
from app.models.db_models import KnowledgePoint

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class RelationCreate(BaseModel):
    source: str
    target: str
    type: str
    weight: float = 1.0
    confidence: float = 0.5
    discovered_by: str = "manual"


class EntityCreate(BaseModel):
    entity_type: str
    code: str
    properties: dict = {}


class EDCExtractRequest(BaseModel):
    text: str


class KPUpdateRequest(BaseModel):
    name: Optional[str] = None
    cognitive_level: Optional[str] = None
    is_key_point: Optional[bool] = None
    curriculum_code: Optional[str] = None


class KPAlignRequest(BaseModel):
    curriculum_code: str


@router.get("/graph")
async def get_knowledge_graph_api(
    subject: Optional[str] = None,
    entity_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    import_default_curriculum(db)
    sync_from_db(db)
    return get_graph(subject, entity_type)


@router.get("/ontology")
async def get_ontology():
    return {
        "entity_types": ENTITY_TYPES,
        "relation_types": {k: v for k, v in RELATION_TYPES.items()},
    }


@router.post("/sync")
async def sync_knowledge(db: Session = Depends(get_db)):
    import_default_curriculum(db)
    sync_from_db(db)
    persist_to_db(db)
    return {"status": "synced", "message": "知识图谱已同步"}


@router.get("/{kp_code}/prerequisite")
async def get_prerequisite(
    kp_code: str,
    max_depth: int = 5,
    db: Session = Depends(get_db),
):
    import_default_curriculum(db)
    chains = get_prerequisite_chain(kp_code, max_depth)
    if not chains:
        raise HTTPException(status_code=404, detail=f"知识点 {kp_code} 不存在或无前驱链")
    return {"kp_code": kp_code, "chains": chains}


@router.get("/{kp_code}/trace")
async def get_trace(
    kp_code: str,
    db: Session = Depends(get_db),
):
    import_default_curriculum(db)
    chains = get_prerequisite_chain(kp_code, max_depth=5)
    downstream = get_downstream(kp_code)
    related = get_related_entities(kp_code)
    return {
        "kp_code": kp_code,
        "prerequisite_chains": chains,
        "downstream": downstream,
        "downstream_count": len(downstream),
        "related_entities": related,
    }


@router.get("/{kp_code}/downstream")
async def get_downstream_api(
    kp_code: str,
    db: Session = Depends(get_db),
):
    import_default_curriculum(db)
    downstream = get_downstream(kp_code)
    return {"kp_code": kp_code, "downstream": downstream, "count": len(downstream)}


@router.get("/{kp_code}/related")
async def get_related_api(
    kp_code: str,
    relation_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    import_default_curriculum(db)
    related = get_related_entities(kp_code, relation_type)
    return {"kp_code": kp_code, "related": related, "count": len(related)}


@router.post("/entity")
async def create_entity(entity: EntityCreate, db: Session = Depends(get_db)):
    if entity.entity_type not in ENTITY_TYPES:
        raise HTTPException(status_code=400, detail=f"实体类型 {entity.entity_type} 不在JY/T本体中")
    add_entity(entity.entity_type, entity.code, entity.properties)
    return {"status": "created", "entity_type": entity.entity_type, "code": entity.code}


@router.post("/relation")
async def create_relation(relation: RelationCreate, db: Session = Depends(get_db)):
    if relation.type not in RELATION_TYPES:
        raise HTTPException(status_code=400, detail=f"关系类型 {relation.type} 不在JY/T本体中")
    add_relation(
        relation.source, relation.target, relation.type,
        relation.weight, relation.confidence, relation.discovered_by,
    )
    return {"status": "created", "relation_type": relation.type}


@router.post("/edc/extract")
async def edc_extract_api(request: EDCExtractRequest, db: Session = Depends(get_db)):
    import_default_curriculum(db)
    sync_from_db(db)
    result = edc_pipeline(request.text)
    return result


class FusionAlignRequest(BaseModel):
    courseware_id: str


@router.post("/fusion/align")
async def fusion_align_api(request: FusionAlignRequest, db: Session = Depends(get_db)):
    import_default_curriculum(db)
    sync_from_db(db)

    kps = db.query(KnowledgePoint).filter(
        KnowledgePoint.courseware_id == request.courseware_id
    ).all()

    if not kps:
        raise HTTPException(status_code=404, detail="该课件无知识点数据")

    courseware_kps = [
        {"code": kp.code, "name": kp.name, "cognitive_level": kp.cognitive_level}
        for kp in kps
    ]

    result = await fuse_courseware_curriculum(courseware_kps)
    persist_to_db(db)

    aligned_count = sum(1 for r in result if r["aligned"])
    custom_count = sum(1 for r in result if r["is_custom"])

    return {
        "total": len(result),
        "aligned": aligned_count,
        "custom": custom_count,
        "details": result,
    }


@router.put("/kp/{kp_id}")
async def update_knowledge_point(
    kp_id: str,
    request: KPUpdateRequest,
    db: Session = Depends(get_db),
):
    kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
    if not kp:
        raise HTTPException(status_code=404, detail=f"知识点 {kp_id} 不存在")

    if request.name is not None:
        kp.name = request.name
    if request.cognitive_level is not None:
        kp.cognitive_level = request.cognitive_level
    if request.is_key_point is not None:
        kp.is_key_point = request.is_key_point
    if request.curriculum_code is not None:
        kp.curriculum_code = request.curriculum_code

    db.commit()
    db.refresh(kp)

    update_entity("KnowledgePoint", kp.code, {
        "name": kp.name,
        "cognitive_level": kp.cognitive_level,
        "is_key_point": kp.is_key_point,
        "curriculum_code": kp.curriculum_code,
    })
    persist_to_db(db)

    return {
        "id": str(kp.id),
        "code": kp.code,
        "name": kp.name,
        "cognitive_level": kp.cognitive_level,
        "is_key_point": kp.is_key_point,
        "curriculum_code": kp.curriculum_code,
    }


@router.delete("/kp/{kp_id}")
async def delete_knowledge_point(
    kp_id: str,
    db: Session = Depends(get_db),
):
    kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
    if not kp:
        raise HTTPException(status_code=404, detail=f"知识点 {kp_id} 不存在")

    kp_code = kp.code
    db.delete(kp)
    db.commit()

    remove_entity(kp_code)
    persist_to_db(db)

    return {"status": "deleted", "id": kp_id, "code": kp_code}


@router.put("/kp/{kp_id}/align")
async def align_knowledge_point(
    kp_id: str,
    request: KPAlignRequest,
    db: Session = Depends(get_db),
):
    kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
    if not kp:
        raise HTTPException(status_code=404, detail=f"知识点 {kp_id} 不存在")

    target = find_entity(request.curriculum_code)
    if not target:
        raise HTTPException(status_code=404, detail=f"课标节点 {request.curriculum_code} 不存在")

    kp.curriculum_code = request.curriculum_code
    db.commit()
    db.refresh(kp)

    add_relation(
        kp.code, request.curriculum_code, "PART_OF",
        weight=1.0, confidence=1.0, discovered_by="manual_align",
        evidence={"method": "manual", "aligned_by": "teacher"},
    )
    update_entity("KnowledgePoint", kp.code, {
        "curriculum_code": request.curriculum_code,
        "curriculum_alignment": request.curriculum_code,
    })
    persist_to_db(db)

    return {
        "id": str(kp.id),
        "code": kp.code,
        "name": kp.name,
        "curriculum_code": kp.curriculum_code,
        "aligned_to": target,
    }
