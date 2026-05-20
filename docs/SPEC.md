# SPEC.md — AI认知诊断引擎 核心功能技术规格

> 核心引擎为CDM（DINA模型），LLM仅作为工具调用，不作为推理引擎。
> Q矩阵由数据联合估计，知识图谱遵循国标JY/T 2025，课件(PPT)为知识源。

---

## 1. 课件解析管线

### 输入

PPT文件（.pptx）

### 处理流程

```
PPT文件 → python-pptx提取文本/表格/图片 → 模板检测
  ├─ 模板PPT: 模板模式(确定性提取) → 准确率≥95%
  │     每页固定区域提取 → 确定性解析 → LLM校验(辅助)
  └─ 普通PPT: 自由模式(LLM提取+校验) → 准确率≥80%
        LLM逐页解析 → 标记"需教师确认"
→ 提取知识点 → 对齐课程标准
```

### 模板PPT结构定义

模板PPT每页包含固定区域，解析时确定性提取：

```python
from pydantic import BaseModel
from typing import Optional

class TemplateSlideRegion(BaseModel):
    title_area: str
    knowledge_points_area: list[str]
    key_points_area: list[str]
    cognitive_level: Optional[str] = None

TEMPLATE_REGION_MARKERS = {
    "title": ["【标题】", "[标题]", "■ 标题"],
    "knowledge_points": ["【知识点】", "[知识点]", "■ 知识点"],
    "key_points": ["【重点】", "[重点]", "■ 重点"],
    "cognitive_level": ["【认知层级】", "[认知层级]", "■ 认知层级"],
}
```

### 模板检测

```python
def detect_template_mode(slides: list[dict]) -> bool:
    required_markers = {"knowledge_points", "key_points"}
    matched_count = 0
    for slide in slides:
        all_text = " ".join(slide.get("texts", []))
        found = set()
        for region_name, markers in TEMPLATE_REGION_MARKERS.items():
            for marker in markers:
                if marker in all_text:
                    found.add(region_name)
                    break
        if required_markers.issubset(found):
            matched_count += 1
    return matched_count / len(slides) >= 0.8 if slides else False
```

### 模板模式解析（确定性提取）

```python
def parse_template_slide(slide_data: dict) -> dict:
    all_text = " ".join(slide_data.get("texts", []))
    lines = slide_data.get("texts", [])

    title = ""
    knowledge_points = []
    key_points = []
    cognitive_level = None

    current_region = None
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        detected_region = None
        for region_name, markers in TEMPLATE_REGION_MARKERS.items():
            for marker in markers:
                if stripped.startswith(marker):
                    detected_region = region_name
                    stripped = stripped[len(marker):].strip()
                    break
            if detected_region:
                break

        if detected_region:
            current_region = detected_region

        if current_region == "title":
            title = stripped
        elif current_region == "knowledge_points":
            for item in stripped.split("；"):
                item = item.strip()
                if item:
                    knowledge_points.append(item)
        elif current_region == "key_points":
            for item in stripped.split("；"):
                item = item.strip()
                if item:
                    key_points.append(item)
        elif current_region == "cognitive_level":
            valid_levels = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
            if stripped.lower() in valid_levels:
                cognitive_level = stripped.lower()

    return {
        "slide_index": slide_data["slide_index"],
        "title": title,
        "knowledge_points": knowledge_points,
        "key_points": key_points,
        "cognitive_level": cognitive_level,
        "parse_mode": "template",
        "needs_teacher_confirm": False
    }
```

### 自由模式解析（LLM提取+校验）

自由模式使用LLM逐页解析，解析结果标记"需教师确认"：

```python
def parse_free_slide(slide_data: dict, llm_client) -> dict:
    prompt = build_free_mode_prompt(slide_data)
    response = llm_client.generate(prompt)
    parsed = json.loads(response)
    parsed["slide_index"] = slide_data["slide_index"]
    parsed["parse_mode"] = "free"
    parsed["needs_teacher_confirm"] = True
    return parsed
```

### python-pptx 提取

```python
from pptx import Presentation
from pptx.util import Inches, Pt
import json
import base64

def extract_ppt_content(ppt_path: str) -> list[dict]:
    prs = Presentation(ppt_path)
    slides = []
    for idx, slide in enumerate(prs.slides):
        slide_data = {
            "slide_index": idx + 1,
            "texts": [],
            "tables": [],
            "images": [],
            "notes": ""
        }
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        slide_data["texts"].append(text)
            if shape.has_table:
                table_data = []
                for row in shape.table.rows:
                    row_data = [cell.text.strip() for cell in row.cells]
                    table_data.append(row_data)
                slide_data["tables"].append(table_data)
            if shape.shape_type == 13:
                image = shape.image
                image_bytes = image.blob
                slide_data["images"].append({
                    "content_type": image.content_type,
                    "base64": base64.b64encode(image_bytes).decode("utf-8")
                })
        if slide.has_notes_slide:
            notes_text = slide.notes_slide.notes_text_frame.text.strip()
            slide_data["notes"] = notes_text
        slides.append(slide_data)
    return slides
```

### LLM Prompt（自由模式逐页解析）

自由模式下LLM从普通PPT中提取知识点，结果需教师确认：

```
你是一位课程标准对齐专家。分析以下课件页面内容，提取知识点并对齐课程标准。

## 课件页面内容
{slide.texts}
{slide.tables格式化}

## 课程标准知识点库
{curriculum_knowledge_points格式化列表}

## 输出格式（严格JSON）
{
  "title": "本页标题",
  "knowledge_points": [
    {
      "id": "kp_xxx",
      "name": "知识点名称",
      "description": "知识点描述",
      "curriculum_alignment": "课程标准对应条目ID",
      "cognitive_level": "remember|understand|apply|analyze|evaluate|create"
    }
  ],
  "key_points": [
    "要点1",
    "要点2"
  ],
  "cognitive_level": "本页最高认知层级",
  "teaching_sequence": 1
}

## 约束
1. knowledge_points必须从课程标准知识点库中选择或对齐
2. cognitive_level遵循布鲁姆分类法
3. teaching_sequence表示本页在教学顺序中的位置
4. 每个知识点必须有curriculum_alignment字段
5. 若本页内容无法对齐课程标准，curriculum_alignment填null并标注原因
6. 本解析为自由模式，结果需教师确认
```

### LLM Prompt（模板模式校验）

模板模式下LLM仅做辅助校验，不主导提取：

```
你是一位课件校验专家。以下是从模板PPT确定性提取的知识点，请校验其合理性。

## 模板提取结果
{template_parsed_result}

## 课程标准知识点库
{curriculum_knowledge_points格式化列表}

## 输出格式（严格JSON）
{
  "validation_result": "pass|warning",
  "warnings": ["警告1", "警告2"],
  "suggested_corrections": []
}

## 约束
1. 仅校验，不重新提取
2. 若知识点名称与课程标准明显不匹配，标记warning
3. 若认知层级明显不合理，标记warning
4. 不修改确定性提取的结果，仅提供警告
```

### 输出

```json
{
  "courseware_id": "cw_001",
  "source_file": "地理必修一-第二章.pptx",
  "total_slides": 28,
  "parsed_slides": [
    {
      "slide_index": 1,
      "title": "大气的受热过程",
      "knowledge_points": [
        {
          "id": "kp_0201",
          "name": "大气受热过程",
          "description": "太阳辐射→地面吸收→地面辐射→大气吸收→大气逆辐射",
          "curriculum_alignment": "JY2025-GEO-B1-02-01",
          "cognitive_level": "understand"
        },
        {
          "id": "kp_0202",
          "name": "大气逆辐射",
          "description": "大气将吸收的热量以辐射形式返还地面",
          "curriculum_alignment": "JY2025-GEO-B1-02-02",
          "cognitive_level": "apply"
        }
      ],
      "key_points": [
        "太阳辐射是大气受热的根本能源",
        "地面是大气的主要直接热源",
        "大气逆辐射对地面起保温作用"
      ],
      "cognitive_level": "apply",
      "teaching_sequence": 1
    }
  ]
}
```

---

## 2. 知识图谱构建（国标JY/T 2025）

### 本体定义

#### 6种实体类型

| 实体类型 | 标签 | 属性 | 说明 |
|---------|------|------|------|
| 学科 | Subject | code, name, version | 顶层学科，如"地理" |
| 主题 | Theme | code, name, description | 学科下主题，如"自然地理" |
| 模块 | Module | code, name, semester, textbook_ref | 教学模块，如"必修一第二章" |
| 知识点 | KnowledgePoint | code, name, cognitive_level, description, curriculum_alignment | 核心实体，CDM诊断目标 |
| 技能 | Skill | code, name, type(cognitive/procedural/strategic), difficulty | 解题所需技能 |
| 课件页 | CoursewarePage | courseware_id, slide_index, title, content_hash | 关联课件来源 |

#### 15+种关系类型

| 关系类型 | 起点→终点 | 定义 | 属性 |
|---------|----------|------|------|
| CONTAINS_SUBJECT | 学科→主题 | 学科包含主题 | - |
| CONTAINS_THEME | 主题→模块 | 主题包含模块 | - |
| CONTAINS_MODULE | 模块→知识点 | 模块包含知识点 | sequence: int |
| PREREQUISITE | 知识点→知识点 | 前置依赖 | weight: float, confidence: float |
| COREQUISITE | 知识点→知识点 | 并行依赖 | weight: float |
| PART_OF | 知识点→知识点 | 组成关系 | - |
| SIMILAR_TO | 知识点→知识点 | 相似关系 | similarity: float |
| REQUIRES_SKILL | 知识点→技能 | 知识点需要技能 | weight: float |
| SUPPORTS_SKILL | 技能→知识点 | 技能支撑知识点 | - |
| DERIVED_FROM | CoursewarePage→知识点 | 课件页提取出知识点 | extraction_confidence: float |
| APPEARS_IN | 知识点→CoursewarePage | 知识点出现在课件页 | - |
| HIERARCHICAL_PARENT | 知识点→知识点 | 层级父节点 | - |
| HIERARCHICAL_CHILD | 知识点→知识点 | 层级子节点 | - |
| ASSESSED_BY | 知识点→题目 | 知识点被题目考察 | q_weight: float |
| COUNTERFACTUAL_LINK | 知识点→知识点 | 反事实关联 | effect_size: float, sample_size: int |

### 4层结构规范

```
第1层: 学科 (Subject)
  └─ 第2层: 主题 (Theme)
       └─ 第3层: 模块 (Module)
            └─ 第4层: 知识点 (KnowledgePoint)
                 ├─ 技能 (Skill) [横向关联]
                 └─ 课件页 (CoursewarePage) [溯源关联]
```

### Neo4j Cypher 初始化

```cypher
CREATE CONSTRAINT subject_code IF NOT EXISTS
FOR (s:Subject) REQUIRE s.code IS UNIQUE;

CREATE CONSTRAINT theme_code IF NOT EXISTS
FOR (t:Theme) REQUIRE t.code IS UNIQUE;

CREATE CONSTRAINT module_code IF NOT EXISTS
FOR (m:Module) REQUIRE m.code IS UNIQUE;

CREATE CONSTRAINT kp_code IF NOT EXISTS
FOR (k:KnowledgePoint) REQUIRE k.code IS UNIQUE;

CREATE CONSTRAINT skill_code IF NOT EXISTS
FOR (sk:Skill) REQUIRE sk.code IS UNIQUE;

CREATE CONSTRAINT cwpage_id IF NOT EXISTS
FOR (c:CoursewarePage) REQUIRE c.content_hash IS UNIQUE;
```

### 从课程标准+课件初始化图谱

```python
from neo4j import GraphDatabase

class KnowledgeGraphStore:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def init_from_curriculum(self, curriculum_data: dict):
        with self.driver.session() as session:
            session.run(
                "MERGE (s:Subject {code: $code}) "
                "SET s.name = $name, s.version = $version",
                code=curriculum_data["subject_code"],
                name=curriculum_data["subject_name"],
                version=curriculum_data["version"]
            )
            for theme in curriculum_data["themes"]:
                session.run(
                    "MATCH (s:Subject {code: $subject_code}) "
                    "MERGE (t:Theme {code: $code}) "
                    "SET t.name = $name, t.description = $description "
                    "MERGE (s)-[:CONTAINS_SUBJECT]->(t)",
                    subject_code=curriculum_data["subject_code"],
                    code=theme["code"],
                    name=theme["name"],
                    description=theme.get("description", "")
                )
                for module in theme["modules"]:
                    session.run(
                        "MATCH (t:Theme {code: $theme_code}) "
                        "MERGE (m:Module {code: $code}) "
                        "SET m.name = $name, m.semester = $semester, "
                        "    m.textbook_ref = $textbook_ref "
                        "MERGE (t)-[:CONTAINS_THEME]->(m)",
                        theme_code=theme["code"],
                        code=module["code"],
                        name=module["name"],
                        semester=module.get("semester", ""),
                        textbook_ref=module.get("textbook_ref", "")
                    )
                    for seq, kp in enumerate(module["knowledge_points"]):
                        session.run(
                            "MATCH (m:Module {code: $module_code}) "
                            "MERGE (k:KnowledgePoint {code: $code}) "
                            "SET k.name = $name, "
                            "    k.cognitive_level = $cognitive_level, "
                            "    k.description = $description, "
                            "    k.curriculum_alignment = $curriculum_alignment "
                            "MERGE (m)-[:CONTAINS_MODULE {sequence: $seq}]->(k)",
                            module_code=module["code"],
                            code=kp["code"],
                            name=kp["name"],
                            cognitive_level=kp.get("cognitive_level", ""),
                            description=kp.get("description", ""),
                            curriculum_alignment=kp.get("curriculum_alignment", ""),
                            seq=seq
                        )
            for rel in curriculum_data.get("prerequisites", []):
                session.run(
                    "MATCH (a:KnowledgePoint {code: $from_code}) "
                    "MATCH (b:KnowledgePoint {code: $to_code}) "
                    "MERGE (a)-[:PREREQUISITE {weight: $weight, confidence: $confidence}]->(b)",
                    from_code=rel["from"],
                    to_code=rel["to"],
                    weight=rel.get("weight", 1.0),
                    confidence=rel.get("confidence", 0.5)
                )

    def sync_courseware_knowledge(self, parsed_courseware: dict):
        with self.driver.session() as session:
            cw_id = parsed_courseware["courseware_id"]
            for slide in parsed_courseware["parsed_slides"]:
                content_hash = f"{cw_id}_s{slide['slide_index']}"
                session.run(
                    "MERGE (c:CoursewarePage {content_hash: $hash}) "
                    "SET c.courseware_id = $cw_id, "
                    "    c.slide_index = $idx, "
                    "    c.title = $title",
                    hash=content_hash,
                    cw_id=cw_id,
                    idx=slide["slide_index"],
                    title=slide["title"]
                )
                for kp in slide["knowledge_points"]:
                    session.run(
                        "MATCH (c:CoursewarePage {content_hash: $hash}) "
                        "MATCH (k:KnowledgePoint {code: $kp_code}) "
                        "MERGE (c)-[:DERIVED_FROM {extraction_confidence: $conf}]->(k) "
                        "MERGE (k)-[:APPEARS_IN]->(c)",
                        hash=content_hash,
                        kp_code=kp["id"],
                        conf=kp.get("extraction_confidence", 0.8)
                    )

    def get_prerequisite_chain(self, kp_code: str, max_depth: int = 5) -> list[dict]:
        with self.driver.session() as session:
            result = session.run(
                "MATCH path = (k:KnowledgePoint)-[:PREREQUISITE*1..%d]->(target:KnowledgePoint {code: $code}) "
                "RETURN [n in nodes(path) | {code: n.code, name: n.name}] AS chain, "
                "       length(path) AS depth "
                "ORDER BY depth ASC" % max_depth,
                code=kp_code
            )
            chains = []
            for record in result:
                chains.append({
                    "chain": record["chain"],
                    "depth": record["depth"]
                })
            return chains

    def get_downstream(self, kp_code: str) -> list[str]:
        with self.driver.session() as session:
            result = session.run(
                "MATCH (k:KnowledgePoint {code: $code})-[:PREREQUISITE*1..]->(downstream:KnowledgePoint) "
                "RETURN DISTINCT downstream.code AS code",
                code=kp_code
            )
            return [r["code"] for r in result]

    def update_edge_weight(self, from_code: str, to_code: str, weight: float,
                           confidence: float, discovered_by: str):
        with self.driver.session() as session:
            session.run(
                "MATCH (a:KnowledgePoint {code: $from_code}) "
                "MATCH (b:KnowledgePoint {code: $to_code}) "
                "MERGE (a)-[r:PREREQUISITE]->(b) "
                "SET r.weight = $weight, r.confidence = $confidence, "
                "    r.discovered_by = $discovered_by",
                from_code=from_code,
                to_code=to_code,
                weight=weight,
                confidence=confidence,
                discovered_by=discovered_by
            )

    def get_all_edges(self) -> list[dict]:
        with self.driver.session() as session:
            result = session.run(
                "MATCH (a:KnowledgePoint)-[r:PREREQUISITE]->(b:KnowledgePoint) "
                "RETURN a.code AS from_id, a.name AS from_name, "
                "       b.code AS to_id, b.name AS to_name, "
                "       r.weight AS weight, r.confidence AS confidence"
            )
            return [dict(r) for r in result]
```

---

## 3. Q矩阵生成与联合估计

### Step 0: 课程标准约束（确定性，不依赖LLM）

```python
def constrain_q_matrix_candidates(exam_scope: list[str], curriculum_tree: dict) -> list[str]:
    candidate_kps = []
    for chapter_code in exam_scope:
        if chapter_code in curriculum_tree:
            candidate_kps.extend(curriculum_tree[chapter_code]["knowledge_points"])
    return candidate_kps

def curriculum_constrained_q_matrix_init(
    exam_scope: list[str],
    curriculum_tree: dict,
    questions: list[dict],
    llm_client
) -> tuple[np.ndarray, list[str]]:
    candidate_kps = constrain_q_matrix_candidates(exam_scope, curriculum_tree)
    if not candidate_kps:
        raise ValueError(f"考试范围{exam_scope}在课程标准中未找到候选知识点")

    kp_ids = [kp["id"] if isinstance(kp, dict) else kp for kp in candidate_kps]
    kp_names = [kp["name"] if isinstance(kp, dict) else kp for kp in candidate_kps]
    kp_list_text = "\n".join([f"  {kid}: {kname}" for kid, kname in zip(kp_ids, kp_names)])

    n_questions = len(questions)
    n_kps = len(kp_ids)
    Q = np.zeros((n_questions, n_kps), dtype=int)
    kp_index = {kid: i for i, kid in enumerate(kp_ids)}

    for qi, q in enumerate(questions):
        prompt = f"""你是一位教育测量专家。分析以下试题，判断其考察了哪些知识点。

## 试题文本
{q['text']}

## 可选知识点列表（来自课程标准约束）
{kp_list_text}

你必须且只能从以上候选列表中选择。

## 输出格式（严格JSON）
{{
  "question_id": "{q['id']}",
  "q_vector": {{
{chr(10).join([f'    "{kid}": 0' for kid in kp_ids[:5]])}
  }},
  "reasoning": "..."
}}

## 约束
1. q_vector中值为1表示该知识点被考察，0表示未被考察
2. 必须且只能从候选列表中选择
3. 至少有一个知识点值为1
4. reasoning必须说明每个1和0的理由"""
        response = llm_client.generate(prompt)
        parsed = json.loads(response)
        for kid, val in parsed["q_vector"].items():
            if kid in kp_index and val == 1:
                Q[qi, kp_index[kid]] = 1

    return Q, kp_ids
```

### Step 1: NLP在候选集内选择 — LLM在课标约束的候选集内选择题目对应的知识点

#### LLM Prompt

```
你是一位教育测量专家。分析以下试题，判断其考察了哪些知识点。

## 试题文本
{question_text}

## 可选知识点列表
{knowledge_point_list格式化}

候选知识点列表（来自课程标准约束）: {candidate_kps}。你必须且只能从以上候选列表中选择。

## 输出格式（严格JSON）
{
  "question_id": "{question_id}",
  "q_vector": {
    "kp_0201": 1,
    "kp_0202": 0,
    "kp_0203": 1
  },
  "reasoning": "本题考察了大气受热过程(kp_0201)和大气逆辐射(kp_0203)，不涉及热力环流(kp_0202)"
}

## 约束
1. q_vector中值为1表示该知识点被考察，0表示未被考察
2. 必须覆盖所有可选知识点
3. 至少有一个知识点值为1
4. reasoning必须说明每个1和0的理由
```

#### 语义初始化代码

```python
import json
import numpy as np

def initialize_q_matrix_llm(questions: list[dict], knowledge_points: list[dict],
                            llm_client) -> np.ndarray:
    kp_ids = [kp["id"] for kp in knowledge_points]
    kp_list_text = "\n".join([f"  {kp['id']}: {kp['name']}" for kp in knowledge_points])
    n_questions = len(questions)
    n_kps = len(kp_ids)
    Q = np.zeros((n_questions, n_kps), dtype=int)
    kp_index = {kid: i for i, kid in enumerate(kp_ids)}

    for qi, q in enumerate(questions):
        prompt = f"""你是一位教育测量专家。分析以下试题，判断其考察了哪些知识点。

## 试题文本
{q['text']}

## 可选知识点列表
{kp_list_text}

候选知识点列表（来自课程标准约束）: {candidate_kps}。你必须且只能从以上候选列表中选择。

## 输出格式（严格JSON）
{{
  "question_id": "{q['id']}",
  "q_vector": {{
{chr(10).join([f'    "{kid}": 0' for kid in kp_ids[:3]])}
  }},
  "reasoning": "..."
}}

## 约束
1. q_vector中值为1表示该知识点被考察，0表示未被考察
2. 必须覆盖所有可选知识点
3. 至少有一个知识点值为1
4. reasoning必须说明每个1和0的理由"""
        response = llm_client.generate(prompt)
        parsed = json.loads(response)
        for kid, val in parsed["q_vector"].items():
            if kid in kp_index and val == 1:
                Q[qi, kp_index[kid]] = 1

    return Q
```

### Step 2: 数据驱动验证（≥30学生时启用）

```python
def validate_q_matrix_with_cdm(Q: np.ndarray, X: np.ndarray,
                                knowledge_points: list[dict],
                                threshold: float = 0.01) -> np.ndarray:
    n_students, n_questions = X.shape
    n_kps = Q.shape[1]
    Q_validated = Q.copy()

    if n_students < 30:
        return Q_validated

    model_full = DINAModel(n_students=n_students, n_questions=n_questions, n_kps=n_kps)
    model_full.fit(X, Q_validated)
    ll_full = model_full.log_likelihood(X, Q_validated)

    for j in range(n_questions):
        for k in range(n_kps):
            if Q_validated[j, k] == 1:
                Q_test = Q_validated.copy()
                Q_test[j, k] = 0
                model_test = DINAModel(n_students=n_students, n_questions=n_questions, n_kps=n_kps)
                model_test.fit(X, Q_test)
                ll_test = model_test.log_likelihood(X, Q_test)
                delta = ll_full - ll_test
                if delta < threshold:
                    Q_validated[j, k] = 0

            elif Q_validated[j, k] == 0:
                Q_test = Q_validated.copy()
                Q_test[j, k] = 1
                model_test = DINAModel(n_students=n_students, n_questions=n_questions, n_kps=n_kps)
                model_test.fit(X, Q_test)
                ll_test = model_test.log_likelihood(X, Q_test)
                delta = ll_test - ll_full
                if delta > threshold:
                    Q_validated[j, k] = 1

    return Q_validated
```

### Step 3: 教师修正作为约束

```python
def apply_teacher_constraints(Q: np.ndarray, constraints: list[dict],
                              kp_index: dict[str, int]) -> np.ndarray:
    Q_constrained = Q.copy()
    for c in constraints:
        j = c["question_index"]
        k = kp_index[c["knowledge_id"]]
        Q_constrained[j, k] = c["value"]
    return Q_constrained
```

---

## 4. CDM认知诊断（核心引擎）

### 4.1 DINA模型实现

```python
import numpy as np
from scipy.special import logsumexp
from itertools import product

class DINAModel:
    def __init__(self, n_students: int, n_questions: int, n_kps: int):
        self.n_students = n_students
        self.n_questions = n_questions
        self.n_kps = n_kps
        self.n_patterns = 2 ** n_kps
        self.slip = None
        self.guess = None
        self.alpha = None
        self.pi = None

    def predict(self, X: np.ndarray, Q: np.ndarray) -> np.ndarray:
        eta = self._compute_eta(Q)
        prob = np.zeros((self.n_students, self.n_questions))
        for i in range(self.n_students):
            for c in range(self.n_patterns):
                alpha_c = self._int_to_pattern(c)
                eta_c = eta @ alpha_c
                p_x_given_alpha = 1.0
                for j in range(self.n_questions):
                    if eta_c[j] == 1:
                        p_x_given_alpha *= (1 - self.slip[j]) ** X[i, j] * self.slip[j] ** (1 - X[i, j])
                    else:
                        p_x_given_alpha *= self.guess[j] ** X[i, j] * (1 - self.guess[j]) ** (1 - X[i, j])
                prob[i] += p_x_given_alpha * self.pi[c]
        return prob

    def log_likelihood(self, X: np.ndarray, Q: np.ndarray) -> float:
        eta = self._compute_eta(Q)
        ll = 0.0
        for i in range(self.n_students):
            log_terms = []
            for c in range(self.n_patterns):
                alpha_c = self._int_to_pattern(c)
                eta_c = eta @ alpha_c
                log_p = np.log(self.pi[c] + 1e-300)
                for j in range(self.n_questions):
                    if eta_c[j] == 1:
                        if X[i, j] == 1:
                            log_p += np.log(1 - self.slip[j] + 1e-300)
                        else:
                            log_p += np.log(self.slip[j] + 1e-300)
                    else:
                        if X[i, j] == 1:
                            log_p += np.log(self.guess[j] + 1e-300)
                        else:
                            log_p += np.log(1 - self.guess[j] + 1e-300)
                log_terms.append(log_p)
            ll += logsumexp(log_terms)
        return ll

    def fit(self, X: np.ndarray, Q: np.ndarray,
            max_iter: int = 500, tol: float = 1e-4,
            constraints: list[dict] = None) -> dict:
        self._initialize_parameters()
        prev_ll = -np.inf
        history = []

        for iteration in range(max_iter):
            alpha_posterior = self._e_step(X, Q)
            self._m_step(X, Q, alpha_posterior, constraints)
            current_ll = self.log_likelihood(X, Q)
            history.append(current_ll)

            if abs(current_ll - prev_ll) < tol:
                break
            prev_ll = current_ll

        self.alpha = self._estimate_alpha(alpha_posterior)
        self.pi = alpha_posterior.mean(axis=0)

        return {
            "iterations": iteration + 1,
            "log_likelihood": current_ll,
            "converged": abs(current_ll - prev_ll) < tol,
            "aic": self._aic(current_ll),
            "bic": self._bic(current_ll),
            "history": history
        }

    def _initialize_parameters(self):
        self.slip = np.full(self.n_questions, 0.2)
        self.guess = np.full(self.n_questions, 0.2)
        self.pi = np.ones(self.n_patterns) / self.n_patterns

    def _e_step(self, X: np.ndarray, Q: np.ndarray) -> np.ndarray:
        eta = self._compute_eta(Q)
        posterior = np.zeros((self.n_students, self.n_patterns))

        for i in range(self.n_students):
            for c in range(self.n_patterns):
                alpha_c = self._int_to_pattern(c)
                eta_c = eta @ alpha_c
                log_p = np.log(self.pi[c] + 1e-300)
                for j in range(self.n_questions):
                    if eta_c[j] == 1:
                        if X[i, j] == 1:
                            log_p += np.log(1 - self.slip[j] + 1e-300)
                        else:
                            log_p += np.log(self.slip[j] + 1e-300)
                    else:
                        if X[i, j] == 1:
                            log_p += np.log(self.guess[j] + 1e-300)
                        else:
                            log_p += np.log(1 - self.guess[j] + 1e-300)
                posterior[i, c] = log_p
            log_norm = logsumexp(posterior[i])
            posterior[i] = np.exp(posterior[i] - log_norm)

        return posterior

    def _m_step(self, X: np.ndarray, Q: np.ndarray,
                alpha_posterior: np.ndarray,
                constraints: list[dict] = None):
        eta = self._compute_eta(Q)
        constrained_slip = set()
        constrained_guess = set()
        if constraints:
            for c in constraints:
                if c["type"] == "slip":
                    constrained_slip.add(c["question_index"])
                elif c["type"] == "guess":
                    constrained_guess.add(c["question_index"])

        for j in range(self.n_questions):
            if j in constrained_slip:
                continue
            numerator_s = 0.0
            denominator_s = 0.0
            for i in range(self.n_students):
                for c in range(self.n_patterns):
                    alpha_c = self._int_to_pattern(c)
                    eta_c = eta @ alpha_c
                    if eta_c[j] == 1:
                        posterior_ij = alpha_posterior[i, c]
                        denominator_s += posterior_ij
                        if X[i, j] == 0:
                            numerator_s += posterior_ij
            self.slip[j] = np.clip(numerator_s / (denominator_s + 1e-300), 0.01, 0.5)

        for j in range(self.n_questions):
            if j in constrained_guess:
                continue
            numerator_g = 0.0
            denominator_g = 0.0
            for i in range(self.n_students):
                for c in range(self.n_patterns):
                    alpha_c = self._int_to_pattern(c)
                    eta_c = eta @ alpha_c
                    if eta_c[j] == 0:
                        posterior_ij = alpha_posterior[i, c]
                        denominator_g += posterior_ij
                        if X[i, j] == 1:
                            numerator_g += posterior_ij
            self.guess[j] = np.clip(numerator_g / (denominator_g + 1e-300), 0.01, 0.5)

        self.pi = alpha_posterior.mean(axis=0)
        self.pi = np.clip(self.pi, 1e-300, None)
        self.pi /= self.pi.sum()

    def _estimate_alpha(self, alpha_posterior: np.ndarray) -> np.ndarray:
        alpha = np.zeros((self.n_students, self.n_kps), dtype=int)
        for i in range(self.n_students):
            best_c = np.argmax(alpha_posterior[i])
            alpha[i] = self._int_to_pattern(best_c)
        return alpha

    def _compute_eta(self, Q: np.ndarray) -> np.ndarray:
        eta = np.zeros((self.n_questions, self.n_patterns), dtype=int)
        for c in range(self.n_patterns):
            alpha_c = self._int_to_pattern(c)
            for j in range(self.n_questions):
                required = Q[j]
                mastered = alpha_c * required
                eta[j, c] = 1 if np.array_equal(mastered, required) and required.sum() > 0 else 0
        return eta

    def _int_to_pattern(self, c: int) -> np.ndarray:
        return np.array([(c >> k) & 1 for k in range(self.n_kps)])

    def _aic(self, ll: float) -> float:
        k = 2 * self.n_questions + self.n_patterns - 1
        return -2 * ll + 2 * k

    def _bic(self, ll: float) -> float:
        n = self.n_students * self.n_questions
        k = 2 * self.n_questions + self.n_patterns - 1
        return -2 * ll + k * np.log(n)
```

### 4.2 参数估计（独立调用接口）

```python
def initialize_parameters(n_questions: int, n_kps: int) -> dict:
    n_patterns = 2 ** n_kps
    return {
        "slip": np.full(n_questions, 0.2),
        "guess": np.full(n_questions, 0.2),
        "pi": np.ones(n_patterns) / n_patterns
    }

def e_step(X: np.ndarray, Q: np.ndarray, slip: np.ndarray,
           guess: np.ndarray, pi: np.ndarray) -> np.ndarray:
    n_students, n_questions = X.shape
    n_kps = Q.shape[1]
    n_patterns = 2 ** n_kps
    posterior = np.zeros((n_students, n_patterns))

    for c in range(n_patterns):
        alpha_c = np.array([(c >> k) & 1 for k in range(n_kps)])
        for j in range(n_questions):
            required = Q[j]
            mastered = alpha_c * required
            eta_jc = 1 if np.array_equal(mastered, required) and required.sum() > 0 else 0
            for i in range(n_students):
                if eta_jc == 1:
                    if X[i, j] == 1:
                        posterior[i, c] += np.log(1 - slip[j] + 1e-300)
                    else:
                        posterior[i, c] += np.log(slip[j] + 1e-300)
                else:
                    if X[i, j] == 1:
                        posterior[i, c] += np.log(guess[j] + 1e-300)
                    else:
                        posterior[i, c] += np.log(1 - guess[j] + 1e-300)
        for i in range(n_students):
            posterior[i, c] += np.log(pi[c] + 1e-300)

    for i in range(n_students):
        log_norm = logsumexp(posterior[i])
        posterior[i] = np.exp(posterior[i] - log_norm)

    return posterior

def m_step(X: np.ndarray, Q: np.ndarray, alpha_posterior: np.ndarray,
           slip: np.ndarray, guess: np.ndarray) -> tuple:
    n_students, n_questions = X.shape
    n_kps = Q.shape[1]
    n_patterns = 2 ** n_kps
    new_slip = slip.copy()
    new_guess = guess.copy()

    for j in range(n_questions):
        num_s = 0.0
        den_s = 0.0
        num_g = 0.0
        den_g = 0.0
        for c in range(n_patterns):
            alpha_c = np.array([(c >> k) & 1 for k in range(n_kps)])
            required = Q[j]
            mastered = alpha_c * required
            eta_jc = 1 if np.array_equal(mastered, required) and required.sum() > 0 else 0
            for i in range(n_students):
                p = alpha_posterior[i, c]
                if eta_jc == 1:
                    den_s += p
                    if X[i, j] == 0:
                        num_s += p
                else:
                    den_g += p
                    if X[i, j] == 1:
                        num_g += p
        new_slip[j] = np.clip(num_s / (den_s + 1e-300), 0.01, 0.5)
        new_guess[j] = np.clip(num_g / (den_g + 1e-300), 0.01, 0.5)

    new_pi = alpha_posterior.mean(axis=0)
    new_pi = np.clip(new_pi, 1e-300, None)
    new_pi /= new_pi.sum()

    return new_slip, new_guess, new_pi

def fit_em(X: np.ndarray, Q: np.ndarray, max_iter: int = 500,
           tol: float = 1e-4) -> dict:
    n_students, n_questions = X.shape
    n_kps = Q.shape[1]
    params = initialize_parameters(n_questions, n_kps)
    slip = params["slip"]
    guess = params["guess"]
    pi = params["pi"]
    prev_ll = -np.inf

    for iteration in range(max_iter):
        alpha_posterior = e_step(X, Q, slip, guess, pi)
        slip, guess, pi = m_step(X, Q, alpha_posterior, slip, guess)
        model = DINAModel(n_students, n_questions, n_kps)
        model.slip = slip
        model.guess = guess
        model.pi = pi
        current_ll = model.log_likelihood(X, Q)
        if abs(current_ll - prev_ll) < tol:
            break
        prev_ll = current_ll

    return {
        "slip": slip,
        "guess": guess,
        "pi": pi,
        "alpha_posterior": alpha_posterior,
        "iterations": iteration + 1,
        "log_likelihood": current_ll,
        "converged": abs(current_ll - prev_ll) < tol
    }
```

### 4.3 知识状态估计

```python
def estimate_mastery(alpha_posterior: np.ndarray, n_kps: int) -> np.ndarray:
    n_students = alpha_posterior.shape[0]
    n_patterns = 2 ** n_kps
    mastery_prob = np.zeros((n_students, n_kps))

    for c in range(n_patterns):
        alpha_c = np.array([(c >> k) & 1 for k in range(n_kps)])
        for k in range(n_kps):
            mastery_prob[:, k] += alpha_posterior[:, c] * alpha_c[k]

    return mastery_prob

def map_estimation(alpha_posterior: np.ndarray, n_kps: int) -> np.ndarray:
    n_students = alpha_posterior.shape[0]
    alpha_map = np.zeros((n_students, n_kps), dtype=int)

    for i in range(n_students):
        best_c = np.argmax(alpha_posterior[i])
        alpha_map[i] = np.array([(best_c >> k) & 1 for k in range(n_kps)])

    return alpha_map
```

---

## 5. 根因推断

### 算法：遍历前驱链 + CDM掌握概率

```python
def trace_root_cause(student_id: str, kp_code: str,
                     mastery_prob: np.ndarray, kp_index: dict[str, int],
                     graph_store: KnowledgeGraphStore,
                     threshold: float = 0.5) -> dict:
    chains = graph_store.get_prerequisite_chain(kp_code, max_depth=5)
    if not chains:
        return {
            "student_id": student_id,
            "target_kp": kp_code,
            "root_cause": None,
            "trace_path": [],
            "confidence": 0.0
        }

    student_idx = None
    if isinstance(student_id, int):
        student_idx = student_id
    else:
        student_idx = int(student_id.split("_")[-1])

    all_prereqs = set()
    for chain_data in chains:
        for node in chain_data["chain"]:
            all_prereqs.add(node["code"])

    deepest_root = None
    deepest_depth = -1
    trace_path = []

    for chain_data in chains:
        current_path = []
        for node in chain_data["chain"]:
            kp = node["code"]
            if kp in kp_index:
                k_idx = kp_index[kp]
                p_mastery = mastery_prob[student_idx, k_idx]
                current_path.append({
                    "knowledge_id": kp,
                    "knowledge_name": node["name"],
                    "mastery_prob": float(p_mastery),
                    "is_weak": p_mastery < threshold
                })
                if p_mastery < threshold and chain_data["depth"] > deepest_depth:
                    deepest_root = kp
                    deepest_depth = chain_data["depth"]

        if current_path:
            has_weak = any(n["is_weak"] for n in current_path)
            if has_weak:
                trace_path = current_path

    if deepest_root is None:
        for chain_data in chains:
            for node in chain_data["chain"]:
                kp = node["code"]
                if kp in kp_index:
                    k_idx = kp_index[kp]
                    p_mastery = mastery_prob[student_idx, k_idx]
                    if p_mastery < threshold:
                        deepest_root = kp
                        break
            if deepest_root:
                break

    confidence = compute_confidence(deepest_root, deepest_depth,
                                    mastery_prob, student_idx, kp_index)

    return {
        "student_id": student_id,
        "target_kp": kp_code,
        "root_cause": deepest_root,
        "trace_path": trace_path,
        "confidence": confidence
    }

def compute_confidence(root_cause_kp: str, depth: int,
                       mastery_prob: np.ndarray, student_idx: int,
                       kp_index: dict[str, int]) -> float:
    if root_cause_kp is None:
        return 0.0

    k_idx = kp_index[root_cause_kp]
    p_mastery = mastery_prob[student_idx, k_idx]
    weakness_signal = 1.0 - p_mastery
    depth_penalty = 0.9 ** depth
    confidence = weakness_signal * depth_penalty
    return round(float(np.clip(confidence, 0.0, 1.0)), 4)
```

---

## 6. 反事实推理

### 基于CDM参数（非LLM）

```python
def compute_counterfactual(kp_x: str, kp_y: str,
                           model: DINAModel, Q: np.ndarray,
                           mastery_prob: np.ndarray,
                           kp_index: dict[str, int],
                           X: np.ndarray,
                           min_sample: int = 10) -> dict:
    n_students = X.shape[0]
    x_idx = kp_index[kp_x]
    y_idx = kp_index[kp_y]

    alpha_map = map_estimation(
        np.zeros((n_students, 2 ** len(kp_index))),
        len(kp_index)
    )

    x_mastered = mastery_prob[:, x_idx] >= 0.5
    x_not_mastered = mastery_prob[:, x_idx] < 0.5

    n_mastered = x_mastered.sum()
    n_not_mastered = x_not_mastered.sum()

    if n_mastered < min_sample or n_not_mastered < min_sample:
        return {
            "cause_kp": kp_x,
            "effect_kp": kp_y,
            "p_y_given_x_mastered": None,
            "p_y_given_x_not_mastered": None,
            "effect_size": None,
            "reliable": False,
            "sample_size": int(n_students),
            "n_mastered": int(n_mastered),
            "n_not_mastered": int(n_not_mastered)
        }

    p_y_given_mastered = mastery_prob[x_mastered, y_idx].mean()
    p_y_given_not_mastered = mastery_prob[x_not_mastered, y_idx].mean()
    effect_size = p_y_given_mastered - p_y_given_not_mastered

    return {
        "cause_kp": kp_x,
        "effect_kp": kp_y,
        "p_y_given_x_mastered": round(float(p_y_given_mastered), 4),
        "p_y_given_x_not_mastered": round(float(p_y_given_not_mastered), 4),
        "effect_size": round(float(effect_size), 4),
        "reliable": True,
        "sample_size": int(n_students),
        "n_mastered": int(n_mastered),
        "n_not_mastered": int(n_not_mastered)
    }
```

---

## 7. CDM参数更新（教师反馈）

```python
class TeacherFeedbackConstraint:
    def __init__(self, student_id: str, kp_code: str, mastery: int,
                 question_index: int = None, param_type: str = None,
                 param_value: float = None):
        self.student_id = student_id
        self.kp_code = kp_code
        self.mastery = mastery
        self.question_index = question_index
        self.param_type = param_type
        self.param_value = param_value

def update_cdm_with_feedback(model: DINAModel, X: np.ndarray, Q: np.ndarray,
                              feedback: list[TeacherFeedbackConstraint],
                              kp_index: dict[str, int],
                              max_iter: int = 200, tol: float = 1e-4) -> dict:
    constraints = []
    for fb in feedback:
        if fb.param_type == "slip" and fb.question_index is not None:
            constraints.append({
                "type": "slip",
                "question_index": fb.question_index,
                "value": fb.param_value
            })
            model.slip[fb.question_index] = fb.param_value
        elif fb.param_type == "guess" and fb.question_index is not None:
            constraints.append({
                "type": "guess",
                "question_index": fb.question_index,
                "value": fb.param_value
            })
            model.guess[fb.question_index] = fb.param_value

    for fb in feedback:
        if fb.kp_code in kp_index:
            k_idx = kp_index[fb.kp_code]
            student_idx = int(fb.student_id.split("_")[-1]) if isinstance(fb.student_id, str) else fb.student_id
            for c in range(model.n_patterns):
                alpha_c = model._int_to_pattern(c)
                if alpha_c[k_idx] != fb.mastery:
                    model.pi[c] *= 0.01
            model.pi /= model.pi.sum()

    prev_ll = model.log_likelihood(X, Q)
    result = model.fit(X, Q, max_iter=max_iter, tol=tol, constraints=constraints)
    new_ll = model.log_likelihood(X, Q)

    return {
        "prev_log_likelihood": prev_ll,
        "new_log_likelihood": new_ll,
        "delta_ll": new_ll - prev_ll,
        "improved": new_ll >= prev_ll,
        "iterations": result["iterations"],
        "converged": result["converged"],
        "constraints_applied": len(constraints)
    }
```

---

## 8. 图谱关系发现

### 偏相关检验（条件独立检验）

```python
import numpy as np
from scipy import stats

def compute_partial_correlation(
    mastery_matrix: np.ndarray,
    kp_a_idx: int,
    kp_b_idx: int,
    control_indices: list[int]
) -> tuple[float, float]:
    """
    计算知识点A和B在控制其他知识点后的偏相关系数。

    Args:
        mastery_matrix: (n_students, n_knowledge_points) 掌握概率矩阵
        kp_a_idx: 知识点A的列索引
        kp_b_idx: 知识点B的列索引
        control_indices: 控制变量的列索引列表

    Returns:
        (partial_r, p_value): 偏相关系数和显著性p值
    """
    data_a = mastery_matrix[:, kp_a_idx]
    data_b = mastery_matrix[:, kp_b_idx]
    n = len(data_a)

    if not control_indices:
        r, p = stats.pearsonr(data_a, data_b)
        return r, p

    control_data = mastery_matrix[:, control_indices]
    combined = np.column_stack([data_a, data_b, control_data])
    corr_matrix = np.corrcoef(combined, rowvar=False)

    try:
        precision = np.linalg.inv(corr_matrix)
    except np.linalg.LinAlgError:
        precision = np.linalg.pinv(corr_matrix)

    partial_r = -precision[0, 1] / np.sqrt(precision[0, 0] * precision[1, 1])
    partial_r = np.clip(partial_r, -0.9999, 0.9999)

    df = n - 2 - len(control_indices)
    if df <= 0:
        return partial_r, 1.0

    z = 0.5 * np.log((1 + partial_r) / (1 - partial_r))
    se = 1.0 / np.sqrt(df - 3) if df > 3 else 1.0
    p_value = 2 * (1 - stats.norm.cdf(abs(z / se)))

    return partial_r, p_value

def suggest_prerequisite_with_partial_corr(
    mastery_matrix: np.ndarray,
    kp_codes: list[str],
    kp_a_idx: int,
    kp_b_idx: int,
    min_samples: int = 30,
    min_control_samples: int = 20,
    simple_corr_threshold: float = 0.3,
    partial_corr_threshold: float = 0.3,
    p_value_threshold: float = 0.05
) -> dict:
    n_students = mastery_matrix.shape[0]
    if n_students < min_samples:
        return {"suggestion": None, "reason": f"样本不足(n={n_students}<{min_samples})"}

    data_a = mastery_matrix[:, kp_a_idx]
    data_b = mastery_matrix[:, kp_b_idx]
    simple_r, _ = stats.pearsonr(data_a, data_b)

    if abs(simple_r) < simple_corr_threshold:
        return {"suggestion": None, "reason": f"简单相关{simple_r:.3f}低于阈值{simple_corr_threshold}"}

    other_indices = [i for i in range(len(kp_codes))
                     if i not in (kp_a_idx, kp_b_idx)]

    if len(other_indices) > 0 and n_students >= min_control_samples:
        partial_r, p_value = compute_partial_correlation(
            mastery_matrix, kp_a_idx, kp_b_idx, other_indices
        )

        if abs(partial_r) < partial_corr_threshold or p_value > p_value_threshold:
            return {
                "suggestion": None,
                "reason": f"偏相关{partial_r:.3f}(p={p_value:.4f})不显著，存在混杂变量",
                "simple_corr": simple_r,
                "partial_corr": partial_r,
                "p_value": p_value
            }
    else:
        partial_r = simple_r
        p_value = 0.0

    return {
        "suggestion": f"{kp_codes[kp_a_idx]}是{kp_codes[kp_b_idx]}的前驱",
        "confidence": abs(partial_r),
        "simple_corr": simple_r,
        "partial_corr": partial_r,
        "p_value": p_value,
        "partial_corr_passed": True,
        "need_teacher_confirm": True
    }

def discover_relations(
    mastery_matrix: np.ndarray,
    kp_codes: list[str],
    min_samples: int = 30,
    min_control_samples: int = 20,
    simple_corr_threshold: float = 0.3,
    partial_corr_threshold: float = 0.3,
    p_value_threshold: float = 0.05
) -> list[dict]:
    suggestions = []
    n_kps = len(kp_codes)
    for i in range(n_kps):
        for j in range(i + 1, n_kps):
            result_ab = suggest_prerequisite_with_partial_corr(
                mastery_matrix, kp_codes, i, j, min_samples,
                min_control_samples, simple_corr_threshold,
                partial_corr_threshold, p_value_threshold
            )
            result_ba = suggest_prerequisite_with_partial_corr(
                mastery_matrix, kp_codes, j, i, min_samples,
                min_control_samples, simple_corr_threshold,
                partial_corr_threshold, p_value_threshold
            )
            if result_ab.get("suggestion"):
                suggestions.append(result_ab)
            if result_ba.get("suggestion"):
                suggestions.append(result_ba)

    suggestions.sort(key=lambda x: abs(x.get("confidence", 0)), reverse=True)
    return suggestions
```

---

## 9. 课件优化反哺

```python
def generate_courseware_feedback(parsed_courseware: dict,
                                 mastery_prob: np.ndarray,
                                 kp_index: dict[str, int],
                                 class_threshold: float = 0.5) -> list[dict]:
    feedbacks = []
    n_students = mastery_prob.shape[0]

    for slide in parsed_courseware["parsed_slides"]:
        slide_kps = slide["knowledge_points"]
        weak_kps = []

        for kp in slide_kps:
            kp_id = kp["id"]
            if kp_id in kp_index:
                k_idx = kp_index[kp_id]
                class_mastery = mastery_prob[:, k_idx].mean()
                if class_mastery < class_threshold:
                    weak_kps.append({
                        "knowledge_id": kp_id,
                        "knowledge_name": kp["name"],
                        "class_mastery_rate": round(float(class_mastery), 4),
                        "cognitive_level": kp.get("cognitive_level", "")
                    })

        if weak_kps:
            suggestions = []
            for wkp in weak_kps:
                if wkp["class_mastery_rate"] < 0.3:
                    suggestions.append(
                        f"知识点'{wkp['knowledge_name']}'班级掌握率仅"
                        f"{wkp['class_mastery_rate']*100:.0f}%，"
                        f"建议增加基础概念讲解和示例"
                    )
                elif wkp["class_mastery_rate"] < 0.5:
                    suggestions.append(
                        f"知识点'{wkp['knowledge_name']}'班级掌握率"
                        f"{wkp['class_mastery_rate']*100:.0f}%，"
                        f"建议补充针对性练习和辨析"
                    )

            feedbacks.append({
                "courseware_id": parsed_courseware["courseware_id"],
                "slide_index": slide["slide_index"],
                "slide_title": slide["title"],
                "weak_knowledge_points": weak_kps,
                "suggestions": suggestions
            })

    return feedbacks
```

---

## 10. 前端图谱规格

### AntV G6 配置（4层结构）

```typescript
import G6 from '@antv/g6';

interface GraphNodeData {
  id: string;
  label: string;
  layer: 'subject' | 'theme' | 'module' | 'knowledgePoint' | 'skill' | 'coursewarePage';
  masteryRate?: number;
  code: string;
}

interface GraphEdgeData {
  source: string;
  target: string;
  relationType: string;
  weight?: number;
  confidence?: number;
}

const LAYER_CONFIG = {
  subject: { color: '#722ed1', size: [160, 50], fontSize: 16, icon: '📚' },
  theme: { color: '#1890ff', size: [140, 44], fontSize: 14, icon: '📖' },
  module: { color: '#13c2c2', size: [130, 40], fontSize: 13, icon: '📋' },
  knowledgePoint: { color: '#52c41a', size: [120, 36], fontSize: 12, icon: '💡' },
  skill: { color: '#fa8c16', size: [100, 32], fontSize: 11, icon: '🔧' },
  coursewarePage: { color: '#eb2f96', size: [100, 32], fontSize: 11, icon: '📄' },
};

const graphConfig = {
  container: 'graph-container',
  width: 1200,
  height: 800,
  layout: {
    type: 'dagre',
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 100,
  },
  modes: {
    default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'],
  },
  defaultNode: {
    type: 'rect',
    size: [120, 36],
    style: {
      radius: 8,
      fill: '#91d5ff',
      stroke: '#69c0ff',
      lineWidth: 1,
      cursor: 'pointer',
    },
    labelCfg: {
      style: {
        fontSize: 12,
        fill: '#000',
      },
      position: 'center',
    },
  },
  defaultEdge: {
    type: 'polyline',
    style: {
      stroke: '#bfbfbf',
      lineWidth: 1,
      endArrow: {
        path: G6.Arrow.triangle(6, 8, 0),
        fill: '#bfbfbf',
      },
    },
  },
  nodeStateStyles: {
    selected: {
      stroke: '#1890ff',
      lineWidth: 3,
      shadowColor: '#1890ff',
      shadowBlur: 10,
    },
    highlight: {
      opacity: 1,
      stroke: '#ff4d4f',
      lineWidth: 3,
    },
    dim: {
      opacity: 0.2,
    },
  },
  edgeStateStyles: {
    highlight: {
      stroke: '#ff4d4f',
      lineWidth: 3,
      opacity: 1,
    },
    dim: {
      stroke: '#bfbfbf',
      lineWidth: 1,
      opacity: 0.15,
    },
  },
};

function getNodeStyle(layer: string, masteryRate?: number): Record<string, unknown> {
  const config = LAYER_CONFIG[layer] || LAYER_CONFIG.knowledgePoint;
  let fill = config.color;

  if (layer === 'knowledgePoint' && masteryRate !== undefined) {
    fill = getNodeColor(masteryRate);
  }

  return {
    type: 'rect',
    size: config.size,
    style: {
      radius: 8,
      fill,
      stroke: fill,
      lineWidth: 1,
      cursor: 'pointer',
    },
    labelCfg: {
      style: {
        fontSize: config.fontSize,
        fill: '#fff',
        fontWeight: 500,
      },
      position: 'center' as const,
    },
  };
}

function getNodeColor(masteryRate: number): string {
  if (masteryRate >= 0.8) return '#52c41a';
  if (masteryRate >= 0.6) return '#73d13d';
  if (masteryRate >= 0.5) return '#faad14';
  if (masteryRate >= 0.3) return '#fa8c16';
  return '#ff4d4f';
}

function highlightTracePath(graph: G6.Graph, pathNodeIds: string[]) {
  const pathSet = new Set(pathNodeIds);

  graph.getNodes().forEach((node) => {
    const nodeId = node.getID();
    const isInPath = pathSet.has(nodeId);
    graph.setItemState(node, 'highlight', isInPath);
    graph.setItemState(node, 'dim', !isInPath);
  });

  graph.getEdges().forEach((edge) => {
    const source = edge.getSource().getID();
    const target = edge.getTarget().getID();
    const isInPath = pathSet.has(source) && pathSet.has(target);
    graph.setItemState(edge, 'highlight', isInPath);
    graph.setItemState(edge, 'dim', !isInPath);
  });

  if (pathNodeIds.length > 0) {
    graph.focusItem(pathNodeIds[0], true, {
      easing: 'easeCubic',
      duration: 500,
    });
  }
}

function buildGraphData(curriculum: unknown, masteryData: Record<string, number>): {
  nodes: Array<{ id: string; data: GraphNodeData } & Record<string, unknown>>;
  edges: Array<{ source: string; target: string; data: GraphEdgeData } & Record<string, unknown>>;
} {
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];

  const subject = (curriculum as Record<string, unknown>).subject as Record<string, unknown>;
  nodes.push({
    id: subject.code as string,
    ...getNodeStyle('subject'),
    label: subject.name as string,
    data: { id: subject.code as string, label: subject.name as string, layer: 'subject', code: subject.code as string },
  });

  const themes = (curriculum as Record<string, unknown>).themes as Array<Record<string, unknown>>;
  for (const theme of themes) {
    nodes.push({
      id: theme.code as string,
      ...getNodeStyle('theme'),
      label: theme.name as string,
      data: { id: theme.code as string, label: theme.name as string, layer: 'theme', code: theme.code as string },
    });
    edges.push({
      source: subject.code as string,
      target: theme.code as string,
      data: { source: subject.code as string, target: theme.code as string, relationType: 'CONTAINS_SUBJECT' },
    });

    const modules = theme.modules as Array<Record<string, unknown>>;
    for (const mod of modules) {
      nodes.push({
        id: mod.code as string,
        ...getNodeStyle('module'),
        label: mod.name as string,
        data: { id: mod.code as string, label: mod.name as string, layer: 'module', code: mod.code as string },
      });
      edges.push({
        source: theme.code as string,
        target: mod.code as string,
        data: { source: theme.code as string, target: mod.code as string, relationType: 'CONTAINS_THEME' },
      });

      const kps = mod.knowledge_points as Array<Record<string, unknown>>;
      for (const kp of kps) {
        const kpCode = kp.code as string;
        const mastery = masteryData[kpCode] ?? 0.5;
        nodes.push({
          id: kpCode,
          ...getNodeStyle('knowledgePoint', mastery),
          label: kp.name as string,
          data: {
            id: kpCode,
            label: kp.name as string,
            layer: 'knowledgePoint',
            code: kpCode,
            masteryRate: mastery,
          },
        });
        edges.push({
          source: mod.code as string,
          target: kpCode,
          data: { source: mod.code as string, target: kpCode, relationType: 'CONTAINS_MODULE' },
        });
      }
    }
  }

  const prerequisites = (curriculum as Record<string, unknown>).prerequisites as Array<Record<string, unknown>>;
  if (prerequisites) {
    for (const rel of prerequisites) {
      edges.push({
        source: rel.from as string,
        target: rel.to as string,
        style: {
          stroke: '#722ed1',
          lineWidth: 1.5,
          lineDash: [4, 4],
          endArrow: {
            path: G6.Arrow.triangle(6, 8, 0),
            fill: '#722ed1',
          },
        },
        data: {
          source: rel.from as string,
          target: rel.to as string,
          relationType: 'PREREQUISITE',
          weight: rel.weight as number,
          confidence: rel.confidence as number,
        },
      });
    }
  }

  return { nodes, edges } as ReturnType<typeof buildGraphData>;
}
```

---

## 11. 智能体行为规格

### 事件总线（EventBus）

```python
import asyncio
from datetime import datetime
from typing import Callable, Any
from dataclasses import dataclass, field
from enum import Enum


class EventType(str, Enum):
    EXAM_IMPORTED = "exam_imported"
    CDM_UPDATED = "cdm_updated"
    PREREQUISITE_CANDIDATE_FOUND = "prerequisite_candidate_found"
    MASTERY_THRESHOLD_BREACHED = "mastery_threshold_breached"


@dataclass
class AgentEvent:
    event_type: EventType
    source_type: str
    source_id: int
    payload: dict = field(default_factory=dict)
    id: int | None = None
    status: str = "pending"
    created_at: datetime = field(default_factory=datetime.now)
    processed_at: datetime | None = None


class EventBus:
    def __init__(self):
        self._handlers: dict[EventType, list[Callable]] = {}
        self._event_store: list[AgentEvent] = []

    def subscribe(self, event_type: EventType, handler: Callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def publish(self, event: AgentEvent):
        self._event_store.append(event)
        handlers = self._handlers.get(event.event_type, [])
        tasks = [self._safe_call(handler, event) for handler in handlers]
        await asyncio.gather(*tasks)

    async def _safe_call(self, handler: Callable, event: AgentEvent):
        try:
            if asyncio.iscoroutinefunction(handler):
                await handler(event)
            else:
                await asyncio.to_thread(handler, event)
        except Exception as e:
            print(f"EventBus handler error: {e}")

    def get_events(self, event_type: EventType | None = None,
                   status: str | None = None) -> list[AgentEvent]:
        events = self._event_store
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if status:
            events = [e for e in events if e.status == status]
        return events
```

### 智能体调度器（AgentScheduler）

```python
class AgentScheduler:
    def __init__(self, event_bus: EventBus, notification_service: "NotificationService"):
        self.event_bus = event_bus
        self.notification_service = notification_service
        self._register_handlers()

    def _register_handlers(self):
        self.event_bus.subscribe(EventType.EXAM_IMPORTED, self.on_exam_imported)
        self.event_bus.subscribe(EventType.CDM_UPDATED, self.on_cdm_updated)
        self.event_bus.subscribe(EventType.PREREQUISITE_CANDIDATE_FOUND, self.on_prerequisite_candidate)
        self.event_bus.subscribe(EventType.MASTERY_THRESHOLD_BREACHED, self.on_mastery_low)

    async def on_exam_imported(self, event: AgentEvent):
        exam_id = event.source_id
        await self.notification_service.create(
            teacher_id=event.payload.get("teacher_id"),
            event=event,
            notification_type="exam_imported",
            title="新考试数据已导入",
            content=f"考试ID={exam_id}的答题数据已导入，可触发CDM参数估计。"
        )

    async def on_cdm_updated(self, event: AgentEvent):
        delta = event.payload.get("param_delta", 0.0)
        if abs(delta) > 0.1:
            exam_id = event.source_id
            await self.notification_service.create(
                teacher_id=event.payload.get("teacher_id"),
                event=event,
                notification_type="cdm_param_change",
                title="CDM参数显著变化",
                content=f"考试ID={exam_id}的CDM参数变化量{delta:.3f}>0.1，请关注。"
            )

    async def on_prerequisite_candidate(self, event: AgentEvent):
        kp_a = event.payload.get("kp_a", "")
        kp_b = event.payload.get("kp_b", "")
        confidence = event.payload.get("confidence", 0.0)
        await self.notification_service.create(
            teacher_id=event.payload.get("teacher_id"),
            event=event,
            notification_type="prerequisite_suggestion",
            title="发现候选前驱关系",
            content=f"知识点'{kp_a}'可能是'{kp_b}'的前驱(置信度={confidence:.2f})，请确认。"
        )

    async def on_mastery_low(self, event: AgentEvent):
        kp_name = event.payload.get("kp_name", "")
        mastery_rate = event.payload.get("mastery_rate", 0.0)
        consecutive_count = event.payload.get("consecutive_count", 0)
        suggestion = "建议优化该知识点的课件内容" if consecutive_count >= 2 else "建议关注"
        await self.notification_service.create(
            teacher_id=event.payload.get("teacher_id"),
            event=event,
            notification_type="mastery_low",
            title="知识点掌握率持续偏低",
            content=f"知识点'{kp_name}'掌握率{mastery_rate:.1%}，连续{consecutive_count}次低于阈值。{suggestion}。"
        )
```

### 通知服务（NotificationService）

```python
from datetime import datetime, timedelta


class NotificationService:
    def __init__(self):
        self._notifications: list[dict] = []
        self._next_id = 1

    async def create(self, teacher_id: int, event: AgentEvent,
                     notification_type: str, title: str, content: str):
        merged = self._try_merge(teacher_id, notification_type, title, content)
        if merged:
            return merged

        notification = {
            "id": self._next_id,
            "teacher_id": teacher_id,
            "event_id": event.id,
            "notification_type": notification_type,
            "title": title,
            "content": content,
            "is_read": False,
            "created_at": datetime.now()
        }
        self._next_id += 1
        self._notifications.append(notification)
        return notification

    def _try_merge(self, teacher_id: int, notification_type: str,
                   title: str, content: str) -> dict | None:
        cutoff = datetime.now() - timedelta(hours=1)
        for n in self._notifications:
            if (n["teacher_id"] == teacher_id
                    and n["notification_type"] == notification_type
                    and n["title"] == title
                    and n["created_at"] >= cutoff):
                n["content"] += f"\n[合并] {content}"
                return n
        return None

    def get_notifications(self, teacher_id: int,
                          unread_only: bool = False) -> list[dict]:
        result = [n for n in self._notifications if n["teacher_id"] == teacher_id]
        if unread_only:
            result = [n for n in result if not n["is_read"]]
        return sorted(result, key=lambda x: x["created_at"], reverse=True)

    def mark_read(self, notification_id: int) -> bool:
        for n in self._notifications:
            if n["id"] == notification_id:
                n["is_read"] = True
                return True
        return False
```

### 事件发布示例

```python
event_bus = EventBus()
notification_service = NotificationService()
scheduler = AgentScheduler(event_bus, notification_service)


async def after_exam_import(exam_id: int, teacher_id: int):
    await event_bus.publish(AgentEvent(
        event_type=EventType.EXAM_IMPORTED,
        source_type="exam",
        source_id=exam_id,
        payload={"teacher_id": teacher_id, "student_count": 45}
    ))


async def after_cdm_estimation(exam_id: int, teacher_id: int, param_delta: float):
    await event_bus.publish(AgentEvent(
        event_type=EventType.CDM_UPDATED,
        source_type="cdm",
        source_id=exam_id,
        payload={"teacher_id": teacher_id, "param_delta": param_delta}
    ))


async def after_prerequisite_discovery(kp_a: str, kp_b: str,
                                        confidence: float, teacher_id: int):
    await event_bus.publish(AgentEvent(
        event_type=EventType.PREREQUISITE_CANDIDATE_FOUND,
        source_type="knowledge_graph",
        source_id=0,
        payload={"kp_a": kp_a, "kp_b": kp_b,
                 "confidence": confidence, "teacher_id": teacher_id}
    ))


async def after_mastery_check(kp_name: str, mastery_rate: float,
                               consecutive_count: int, teacher_id: int):
    await event_bus.publish(AgentEvent(
        event_type=EventType.MASTERY_THRESHOLD_BREACHED,
        source_type="diagnosis",
        source_id=0,
        payload={"kp_name": kp_name, "mastery_rate": mastery_rate,
                 "consecutive_count": consecutive_count, "teacher_id": teacher_id}
    ))
```

---

**文档结束**
