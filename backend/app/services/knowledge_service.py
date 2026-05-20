from typing import Optional
from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db_models import KnowledgePoint, Courseware, GraphEntity, GraphRelation
import json
import threading
import logging

ENTITY_TYPES = [
    "KnowledgePoint", "ExamPoint", "ExamMethod", "Question", "TeachingMaterial",
    "LearningActivity", "CoreCompetency", "ExternalData",
]

RELATION_TYPES = {
    "PREREQUISITE_OF": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "前置依赖"},
    "CONTAINS": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "包含"},
    "DEPENDS_ON": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "依赖"},
    "SIMILAR_TO": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "相似"},
    "HAS_EXAM_POINT": {"source": "KnowledgePoint", "target": "ExamPoint", "description": "包含考点"},
    "EXAM_POINT_OF": {"source": "ExamPoint", "target": "KnowledgePoint", "description": "属于知识点"},
    "TESTED_BY_METHOD": {"source": "ExamPoint", "target": "ExamMethod", "description": "考法"},
    "METHOD_FOR_EXAM": {"source": "ExamMethod", "target": "ExamPoint", "description": "用于考点"},
    "EXAMINES": {"source": "Question", "target": "ExamPoint", "description": "考查考点"},
    "EXAMINED_BY": {"source": "ExamPoint", "target": "Question", "description": "被考查"},
    "ASSESSED_BY": {"source": "KnowledgePoint", "target": "Question", "description": "被评估"},
    "ASSOCIATED_WITH": {"source": "KnowledgePoint", "target": "TeachingMaterial", "description": "关联资料"},
    "INVOLVES": {"source": "LearningActivity", "target": "KnowledgePoint", "description": "涉及"},
    "SUPPORTS": {"source": "CoreCompetency", "target": "KnowledgePoint", "description": "支撑"},
    "DERIVED_FROM": {"source": "KnowledgePoint", "target": "ExternalData", "description": "来源于"},
    "EVOLVES_FROM": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "演化"},
    "PART_OF": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "属于"},
    "APPLIES": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "应用"},
    "CONTRASTS_WITH": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "对比"},
    "REQUIRES": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "需要"},
    "ENABLES": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "使能"},
    "INHIBITS": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "抑制"},
    "RELATES_TO": {"source": "KnowledgePoint", "target": "KnowledgePoint", "description": "关联"},
    "TAUGHT_IN": {"source": "KnowledgePoint", "target": "LearningActivity", "description": "教学归属"},
    "LEADS_TO": {"source": "LearningActivity", "target": "LearningActivity", "description": "导向"},
}

_graph_store = {
    "entities": {et: {} for et in ENTITY_TYPES},
    "relations": [],
    "subjects": {},
    "themes": {},
    "modules": {},
    "ontology": {
        "entity_types": ENTITY_TYPES,
        "relation_types": {k: v["description"] for k, v in RELATION_TYPES.items()},
    },
}

_store_lock = threading.RLock()
_store_initialized = False


def init_knowledge_store(db: Session):
    global _store_initialized
    if _store_initialized:
        return
    with _store_lock:
        if _store_initialized:
            return
        load_from_db(db)
        _store_initialized = True
    logger = logging.getLogger(__name__)
    logger.info("Knowledge store initialized from database")


def _get_store():
    return _graph_store


def add_entity(entity_type: str, code: str, properties: dict):
    with _store_lock:
        store = _get_store()
        if entity_type not in store["entities"]:
            store["entities"][entity_type] = {}
        store["entities"][entity_type][code] = {
            "type": entity_type,
            "code": code,
            **properties,
        }


def add_relation(source_code: str, target_code: str, relation_type: str,
                 weight: float = 1.0, confidence: float = 0.5,
                 discovered_by: str = "manual", evidence: dict = None):
    with _store_lock:
        store = _get_store()
        for r in store["relations"]:
            if r["source"] == source_code and r["target"] == target_code and r["type"] == relation_type:
                r["weight"] = weight
                r["confidence"] = confidence
                r["discovered_by"] = discovered_by
                if evidence:
                    r["evidence"] = evidence
                return
        store["relations"].append({
            "source": source_code,
            "target": target_code,
            "type": relation_type,
            "weight": weight,
            "confidence": confidence,
            "discovered_by": discovered_by,
            "evidence": evidence or {},
        })


def update_entity(entity_type: str, code: str, properties: dict):
    with _store_lock:
        store = _get_store()
        if entity_type not in store["entities"]:
            return
        entities = store["entities"][entity_type]
        if code not in entities:
            add_entity(entity_type, code, properties)
            return
        for k, v in properties.items():
            entities[code][k] = v


def remove_entity(code: str):
    with _store_lock:
        store = _get_store()
        for entity_type in ENTITY_TYPES:
            if code in store["entities"][entity_type]:
                del store["entities"][entity_type][code]
                break
        store["relations"] = [
            r for r in store["relations"]
            if r["source"] != code and r["target"] != code
        ]


def find_entity(code: str) -> Optional[dict]:
    with _store_lock:
        store = _get_store()
        for et in ENTITY_TYPES:
            if code in store["entities"][et]:
                return store["entities"][et][code].copy()
    return None


def sync_from_db(db: Session):
    with _store_lock:
        load_from_db(db)
        store = _get_store()
        kps = db.query(KnowledgePoint).all()
        for kp in kps:
            existing = store["entities"]["KnowledgePoint"].get(kp.code)
            if existing:
                existing["id"] = str(kp.id)
                existing["mastery_rate"] = kp.mastery_rate
                existing["source_type"] = kp.source_type
                existing["courseware_id"] = str(kp.courseware_id) if kp.courseware_id else None
                existing["is_key_point"] = kp.is_key_point
                existing["curriculum_code"] = kp.curriculum_code
            else:
                add_entity("KnowledgePoint", kp.code, {
                    "id": str(kp.id),
                    "name": kp.name,
                    "cognitive_level": kp.cognitive_level,
                    "chapter": kp.chapter,
                    "section": kp.section,
                    "mastery_rate": kp.mastery_rate,
                    "source_type": kp.source_type,
                    "courseware_id": str(kp.courseware_id) if kp.courseware_id else None,
                    "is_key_point": kp.is_key_point,
                    "curriculum_code": kp.curriculum_code,
                })


def persist_to_db(db: Session):
    with _store_lock:
        store = _get_store()
        for entity_type, entities in store["entities"].items():
            for code, entity in entities.items():
                existing = db.query(GraphEntity).filter(GraphEntity.code == code).first()
                props = {k: v for k, v in entity.items() if k not in ("type", "code")}
                if existing:
                    existing.name = entity.get("name", "")
                    existing.properties = json.dumps(props, ensure_ascii=False)
                    existing.updated_at = datetime.now()
                else:
                    db.add(GraphEntity(
                        id=code,
                        entity_type=entity_type,
                        code=code,
                        name=entity.get("name", ""),
                        properties=json.dumps(props, ensure_ascii=False),
                    ))

        existing_relations = {(r.source_code, r.target_code, r.relation_type) for r in db.query(GraphRelation).all()}
        for rel in store["relations"]:
            key = (rel["source"], rel["target"], rel["type"])
            if key not in existing_relations:
                db.add(GraphRelation(
                    source_code=rel["source"],
                    target_code=rel["target"],
                    relation_type=rel["type"],
                    weight=rel["weight"],
                    confidence=rel["confidence"],
                    discovered_by=rel["discovered_by"],
                    evidence=json.dumps(rel.get("evidence", {}), ensure_ascii=False),
                ))
        db.commit()


def load_from_db(db: Session):
    with _store_lock:
        store = _get_store()
        for entity in db.query(GraphEntity).all():
            props = json.loads(entity.properties) if entity.properties else {}
            add_entity(entity.entity_type, entity.code, props)

        for rel in db.query(GraphRelation).all():
            evidence = json.loads(rel.evidence) if rel.evidence else {}
            add_relation(
                rel.source_code, rel.target_code, rel.relation_type,
                rel.weight, rel.confidence, rel.discovered_by, evidence,
            )


def init_from_curriculum(curriculum_data: dict, project_id: str = None):
    with _store_lock:
        store = _get_store()

        subject_code = curriculum_data["subject_code"]
        store["subjects"][subject_code] = {
            "code": subject_code,
            "name": curriculum_data["subject_name"],
            "version": curriculum_data.get("version", ""),
        }
        if project_id:
            store["subjects"][subject_code]["project_id"] = project_id

        for theme in curriculum_data.get("themes", []):
            theme_code = theme["code"]
            store["themes"][theme_code] = {
                "code": theme_code,
                "name": theme["name"],
                "description": theme.get("description", ""),
                "subject_code": subject_code,
            }
            if project_id:
                store["themes"][theme_code]["project_id"] = project_id

            for module in theme.get("modules", []):
                module_code = module["code"]
                store["modules"][module_code] = {
                    "code": module_code,
                    "name": module["name"],
                    "semester": module.get("semester", ""),
                    "textbook_ref": module.get("textbook_ref", ""),
                    "theme_code": theme_code,
                }
                if project_id:
                    store["modules"][module_code]["project_id"] = project_id

                for seq, kp in enumerate(module.get("knowledge_points", [])):
                    kp_code = kp["code"]
                    kp_props = {
                        "name": kp["name"],
                        "cognitive_level": kp.get("cognitive_level", ""),
                        "description": kp.get("description", ""),
                        "curriculum_alignment": kp.get("curriculum_alignment", ""),
                        "module_code": module_code,
                        "mastery_rate": 0.0,
                        "source_type": "curriculum",
                        "sequence": seq,
                    }
                    if project_id:
                        kp_props["project_id"] = project_id
                    add_entity("KnowledgePoint", kp_code, kp_props)

                    for ep_seq, ep in enumerate(kp.get("exam_points", [])):
                        ep_code = ep.get("code", f"{kp_code}-EP{ep_seq+1:02d}")
                        ep_props = {
                            "name": ep.get("name", ep) if isinstance(ep, dict) else ep,
                            "description": ep.get("description", "") if isinstance(ep, dict) else "",
                            "knowledge_point_code": kp_code,
                            "frequency": ep.get("frequency", 0) if isinstance(ep, dict) else 0,
                            "difficulty": ep.get("difficulty", 0.5) if isinstance(ep, dict) else 0.5,
                        }
                        if project_id:
                            ep_props["project_id"] = project_id
                        add_entity("ExamPoint", ep_code, ep_props)
                        add_relation(kp_code, ep_code, "HAS_EXAM_POINT",
                                     weight=1.0, confidence=1.0, discovered_by="curriculum")
                        add_relation(ep_code, kp_code, "EXAM_POINT_OF",
                                     weight=1.0, confidence=1.0, discovered_by="curriculum")

                        if isinstance(ep, dict):
                            for em_seq, em in enumerate(ep.get("exam_methods", [])):
                                em_code = em.get("code", f"{ep_code}-EM{em_seq+1:02d}") if isinstance(em, dict) else f"{ep_code}-EM{em_seq+1:02d}"
                                em_props = {
                                    "name": em.get("name", em) if isinstance(em, dict) else em,
                                    "question_type": em.get("question_type", "") if isinstance(em, dict) else "",
                                    "description": em.get("description", "") if isinstance(em, dict) else "",
                                    "exam_point_code": ep_code,
                                }
                                if project_id:
                                    em_props["project_id"] = project_id
                                add_entity("ExamMethod", em_code, em_props)
                                add_relation(ep_code, em_code, "TESTED_BY_METHOD",
                                             weight=1.0, confidence=1.0, discovered_by="curriculum")
                                add_relation(em_code, ep_code, "METHOD_FOR_EXAM",
                                             weight=1.0, confidence=1.0, discovered_by="curriculum")

                for comp in module.get("core_competencies", []):
                    comp_code = comp["code"]
                    comp_props = {
                        "name": comp["name"],
                        "description": comp.get("description", ""),
                        "module_code": module_code,
                    }
                    if project_id:
                        comp_props["project_id"] = project_id
                    add_entity("CoreCompetency", comp_code, comp_props)
                    for kp_code in comp.get("knowledge_points", []):
                        add_relation(comp_code, kp_code, "SUPPORTS",
                                     weight=1.0, confidence=1.0, discovered_by="curriculum")

        for rel in curriculum_data.get("relations", []):
            rel_type = rel.get("type", "PREREQUISITE_OF")
            add_relation(
                rel["from"], rel["to"], rel_type,
                weight=rel.get("weight", 1.0),
                confidence=rel.get("confidence", 0.5),
                discovered_by=rel.get("discovered_by", "curriculum"),
                evidence=rel.get("evidence"),
            )

        for rel in curriculum_data.get("prerequisites", []):
            add_relation(
                rel["from"], rel["to"], "PREREQUISITE_OF",
                weight=rel.get("weight", 1.0),
                confidence=rel.get("confidence", 0.5),
                discovered_by=rel.get("discovered_by", "curriculum"),
            )

        for contain in curriculum_data.get("contains", []):
            add_relation(
                contain["parent"], contain["child"], "CONTAINS",
                weight=1.0, confidence=1.0, discovered_by="curriculum",
            )


def sync_courseware_knowledge(parsed_courseware: dict, db: Session):
    with _store_lock:
        store = _get_store()
        cw_id = parsed_courseware["courseware_id"]

        cw_entity_code = f"CW-{cw_id[:8]}"
        add_entity("TeachingMaterial", cw_entity_code, {
            "name": parsed_courseware.get("name", ""),
            "courseware_id": cw_id,
            "parse_mode": parsed_courseware.get("parse_mode", "free"),
            "source_type": "courseware",
        })

        for slide in parsed_courseware.get("parsed_slides", []):
            for kp_data in slide.get("knowledge_points", []):
                kp_name = kp_data if isinstance(kp_data, str) else kp_data.get("name", "")
                kp_code = kp_data.get("id", kp_data.get("code", "")) if isinstance(kp_data, dict) else ""

                matched_code = None
                if kp_code and kp_code in store["entities"]["KnowledgePoint"]:
                    matched_code = kp_code
                elif kp_name:
                    for code, node in store["entities"]["KnowledgePoint"].items():
                        if node.get("name") == kp_name:
                            matched_code = code
                            break
                        if kp_name in node.get("name", "") or node.get("name", "") in kp_name:
                            matched_code = code

                if matched_code:
                    store["entities"]["KnowledgePoint"][matched_code]["courseware_id"] = cw_id
                    store["entities"]["KnowledgePoint"][matched_code]["source_type"] = parsed_courseware.get("parse_mode", "free")
                    add_relation(matched_code, cw_entity_code, "ASSOCIATED_WITH",
                                 weight=1.0, confidence=0.9, discovered_by="courseware_parse")


def edc_extract(text: str, entity_types: list[str] = None) -> list[dict]:
    triplets = []
    sentences = []
    for s in text.replace("。", "\n").replace("；", "\n").replace("！", "\n").replace("\t", "\n").split("\n"):
        s = s.strip()
        if s:
            sentences.append(s)

    prereq_patterns = [
        (["需要先", "前提是", "先决条件是", "前提条件", "必须先", "依赖于", "建立在"], "PREREQUISITE_OF"),
        (["因此", "所以", "从而", "才能", "就可以"], "PREREQUISITE_OF"),
        (["包括", "包含", "分为", "组成"], "CONTAINS"),
        (["应用于", "用于", "适用于"], "APPLIES"),
        (["需要掌握", "需要", "要求"], "REQUIRES"),
        (["相似于", "类似于", "相当于"], "SIMILAR_TO"),
        (["对比", "区别于", "不同于"], "CONTRASTS_WITH"),
    ]

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence or len(sentence) < 4:
            continue

        matched = False
        for markers, rel_type in prereq_patterns:
            if matched:
                break
            for marker in markers:
                if marker not in sentence:
                    continue
                parts = sentence.split(marker, 1)
                if len(parts) != 2:
                    continue
                source_text = parts[0].strip()
                target_text = parts[1].strip()

                for prefix in ["掌握", "理解", "学习", "学会", "了解", "知道", "先"]:
                    if target_text.startswith(prefix):
                        target_text = target_text[len(prefix):]

                for suffix in ["才能", "就可以", "之后", "以后", "是"]:
                    if source_text.endswith(suffix):
                        source_text = source_text[:-len(suffix)]

                source_text = source_text.strip()
                target_text = target_text.strip()

                if source_text and target_text and len(source_text) >= 2 and len(target_text) >= 2:
                    triplets.append({
                        "source_text": source_text,
                        "target_text": target_text,
                        "relation": rel_type,
                        "confidence": 0.6 if rel_type == "PREREQUISITE_OF" else 0.5,
                        "method": "pattern",
                    })
                    matched = True
                    break

    return triplets


def edc_define(triplets: list[dict]) -> list[dict]:
    defined = []
    for t in triplets:
        rel_type = t.get("relation", "PREREQUISITE_OF")
        if rel_type in RELATION_TYPES:
            schema = RELATION_TYPES[rel_type]
            defined.append({
                **t,
                "source_type": schema["source"],
                "target_type": schema["target"],
                "defined": True,
            })
        else:
            defined.append({
                **t,
                "source_type": "KnowledgePoint",
                "target_type": "KnowledgePoint",
                "defined": False,
                "warning": f"关系类型 {rel_type} 不在JY/T本体中",
            })
    return defined


def edc_canonicalize(triplets: list[dict], existing_entities: dict) -> list[dict]:
    canonicalized = []
    for t in triplets:
        source_code = None
        target_code = None

        source_text = t.get("source_text", "")
        target_text = t.get("target_text", "")

        for code, entity in existing_entities.items():
            name = entity.get("name", "")
            if source_text == name:
                source_code = code
            elif source_text in name or name in source_text:
                if not source_code:
                    source_code = code
            if target_text == name:
                target_code = code
            elif target_text in name or name in target_text:
                if not target_code:
                    target_code = code

        canonicalized.append({
            **t,
            "source_code": source_code,
            "target_code": target_code,
            "canonicalized": source_code is not None and target_code is not None,
        })
    return canonicalized


def edc_pipeline(text: str) -> dict:
    raw_triplets = edc_extract(text)
    defined_triplets = edc_define(raw_triplets)
    with _store_lock:
        kp_entities = dict(_get_store()["entities"].get("KnowledgePoint", {}))
    canonicalized = edc_canonicalize(defined_triplets, kp_entities)

    confirmed = [t for t in canonicalized if t.get("canonicalized")]
    pending = [t for t in canonicalized if not t.get("canonicalized")]

    for t in confirmed:
        add_relation(
            t["source_code"], t["target_code"], t["relation"],
            weight=t.get("confidence", 0.5),
            confidence=t.get("confidence", 0.5),
            discovered_by="edc_pipeline",
            evidence={"method": t.get("method", "pattern"), "source_text": t.get("source_text", "")},
        )

    return {
        "total_extracted": len(raw_triplets),
        "defined": len(defined_triplets),
        "canonicalized": len(confirmed),
        "pending_review": len(pending),
        "confirmed_relations": confirmed,
        "pending_relations": pending,
    }


def edc_extract_from_courseware(parsed_slides: list[dict]) -> dict:
    all_text = ""
    for slide in parsed_slides:
        texts = slide.get("knowledge_points", [])
        if isinstance(texts, list):
            all_text += "。".join([t if isinstance(t, str) else t.get("name", "") for t in texts]) + "。"
        title = slide.get("title", "")
        if title:
            all_text += title + "。"

    if not all_text.strip():
        return {"total_extracted": 0, "defined": 0, "canonicalized": 0, "pending_review": 0, "confirmed_relations": [], "pending_relations": []}

    return edc_pipeline(all_text)


def semantic_align_kp(source_name: str, target_entities: dict, threshold: float = 0.6) -> Optional[dict]:
    best_match = None
    best_score = 0.0

    for code, entity in target_entities.items():
        target_name = entity.get("name", "")
        if source_name == target_name:
            return {"code": code, "name": target_name, "score": 1.0, "method": "exact"}

        if source_name in target_name or target_name in source_name:
            score = min(len(source_name), len(target_name)) / max(len(source_name), len(target_name))
            if score > best_score:
                best_score = score
                best_match = {"code": code, "name": target_name, "score": score, "method": "substring"}

        common_chars = set(source_name) & set(target_name)
        if len(common_chars) > 0:
            score = len(common_chars) / max(len(set(source_name)), len(set(target_name)))
            if score > best_score and score >= threshold:
                best_score = score
                best_match = {"code": code, "name": target_name, "score": score, "method": "jaccard"}

    if best_match and best_match["score"] >= threshold:
        return best_match
    return None


async def semantic_align_kp_with_llm(source_name: str, target_entities: dict) -> Optional[dict]:
    rule_match = semantic_align_kp(source_name, target_entities)
    if rule_match and rule_match.get("score", 0) >= 0.8:
        return rule_match

    from app.services.llm_client import call_llm_for_semantic_align
    candidates = [
        {"code": code, "name": entity.get("name", "")}
        for code, entity in target_entities.items()
    ]

    if not candidates:
        return rule_match

    llm_match = await call_llm_for_semantic_align(source_name, candidates)
    if llm_match and llm_match.get("code"):
        code = llm_match["code"]
        if code in target_entities:
            return {
                "code": code,
                "name": target_entities[code].get("name", llm_match.get("name", "")),
                "score": llm_match.get("confidence", 0.7),
                "method": "llm",
            }

    return rule_match


async def fuse_courseware_curriculum(courseware_kps: list[dict]) -> list[dict]:
    with _store_lock:
        store = _get_store()
        curriculum_kps = store["entities"].get("KnowledgePoint", {})

    results = []
    for cw_kp in courseware_kps:
        cw_name = cw_kp.get("name", "")
        cw_code = cw_kp.get("code", "")

        match = await semantic_align_kp_with_llm(cw_name, curriculum_kps)

        if match:
            add_relation(
                cw_code, match["code"], "SIMILAR_TO",
                weight=match["score"], confidence=match["score"],
                discovered_by="fusion",
                evidence={"method": match.get("method", "semantic_align"), "source_name": cw_name, "target_name": match["name"]},
            )
        else:
            add_entity("KnowledgePoint", cw_code, {
                "name": cw_name,
                "cognitive_level": cw_kp.get("cognitive_level", ""),
                "source_type": "courseware_custom",
                "mastery_rate": 0.0,
                "custom": True,
                "aligned": False,
            })

        results.append({
            "courseware_kp": cw_kp,
            "curriculum_match": match,
            "aligned": match is not None,
            "alignment_score": match["score"] if match else 0.0,
            "alignment_method": match.get("method", "none") if match else "none",
            "is_custom": match is None,
        })
    return results


def get_graph(subject: Optional[str] = None, entity_type: Optional[str] = None) -> dict:
    with _store_lock:
        store = _get_store()

        all_nodes = []
        for et in ENTITY_TYPES:
            if entity_type and et != entity_type:
                continue
            for code, entity in store["entities"][et].items():
                n = {**entity}
                if subject and n.get("module_code"):
                    module = store["modules"].get(n["module_code"], {})
                    theme = store["themes"].get(module.get("theme_code", ""), {})
                    subj = store["subjects"].get(theme.get("subject_code", ""), {})
                    if subj.get("code") != subject:
                        continue
                all_nodes.append(n)

        node_codes = {n["code"] for n in all_nodes}
        edges = [
            e for e in store["relations"]
            if e["source"] in node_codes and e["target"] in node_codes
        ]

        entity_counts = {}
        for et in ENTITY_TYPES:
            entity_counts[et] = len(store["entities"][et])

        relation_counts = defaultdict(int)
        for e in edges:
            relation_counts[e["type"]] += 1

    return {
        "nodes": all_nodes,
        "edges": edges,
        "subjects": list(store["subjects"].values()),
        "themes": list(store["themes"].values()),
        "modules": list(store["modules"].values()),
        "ontology": store["ontology"],
        "stats": {
            "total_nodes": len(all_nodes),
            "total_edges": len(edges),
            "entity_counts": entity_counts,
            "relation_counts": dict(relation_counts),
        }
    }


def get_prerequisite_chain(kp_code: str, max_depth: int = 5) -> list[dict]:
    with _store_lock:
        store = _get_store()
        prereq_edges = [e for e in store["relations"] if e["type"] == "PREREQUISITE_OF"]

        adjacency = defaultdict(list)
        for e in prereq_edges:
            adjacency[e["target"]].append((e["source"], e["weight"], e["confidence"]))

        chains = []
        max_chains = 5

        stack = [(kp_code, [kp_code], 0, 0.0)]
        while stack and len(chains) < max_chains:
            current_code, path, depth, total_weight = stack.pop()
            if depth > max_depth:
                continue
            prereqs = adjacency.get(current_code, [])
            if not prereqs:
                if len(path) > 1:
                    chains.append({
                        "chain": [find_entity(c) or {"code": c, "name": c} for c in path],
                        "depth": len(path) - 1,
                        "total_weight": total_weight,
                    })
                continue
            sorted_prereqs = sorted(prereqs, key=lambda x: x[1] * x[2], reverse=True)
            for prereq_code, weight, confidence in sorted_prereqs:
                if prereq_code in path:
                    continue
                if len(chains) >= max_chains:
                    break
                stack.append((prereq_code, path + [prereq_code], depth + 1, total_weight + weight))

        if not chains:
            entity = find_entity(kp_code)
            if entity:
                chains.append({"chain": [entity], "depth": 0, "total_weight": 0.0})
        return chains


def get_downstream(kp_code: str) -> list[str]:
    with _store_lock:
        store = _get_store()
        prereq_edges = [e for e in store["relations"] if e["type"] == "PREREQUISITE_OF"]

        adjacency = defaultdict(list)
        for e in prereq_edges:
            adjacency[e["source"]].append(e["target"])

        visited = set()
        queue = [kp_code]
        while queue:
            current = queue.pop(0)
            for downstream_code in adjacency.get(current, []):
                if downstream_code not in visited:
                    visited.add(downstream_code)
                    queue.append(downstream_code)
        return list(visited)


def get_related_entities(code: str, relation_type: Optional[str] = None) -> list[dict]:
    with _store_lock:
        store = _get_store()
        related = []
        for r in store["relations"]:
            if relation_type and r["type"] != relation_type:
                continue
            if r["source"] == code:
                target_entity = find_entity(r["target"])
                related.append({**r, "direction": "outgoing", "target_entity": target_entity})
            elif r["target"] == code:
                source_entity = find_entity(r["source"])
                related.append({**r, "direction": "incoming", "source_entity": source_entity})
        return related