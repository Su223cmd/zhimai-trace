# ARCHITECTURE.md — AI知识根因诊断系统

> 核心引擎是CDM（认知诊断模型，DINA/G-DINA），不是LLM推理。
> LLM是工具（文本理解），不是引擎（诊断）。
> Q矩阵由数据联合估计（NLP先验 + EM算法），不是LLM分类。
> 知识图谱存储于SQLite/PostgreSQL，通过SQLAlchemy ORM操作，不依赖Neo4j。
> 课件（PPT）解析是知识来源，不是教材解析。
> 不微调基础模型。CDM参数通过EM算法估计（统计推断，非神经网络训练）。
> 作业数据以已批改结果导入，不做自动批改。
> 项目制多学科：每个学科独立项目，数据隔离，独立诊断。

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  前端层 (React 19 + TypeScript 6 + Ant Design 6)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │课件管理   │ │知识图谱   │ │诊断分析   │ │教学决策   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  AntV G6 5 (图谱) │ ECharts 6 (图表) │ Axios (HTTP)             │
│  React Router 7 │ CSS Tokens │ Tailwind CSS                     │
├─────────────────────────────────────────────────────────────────┤
│  API层 (FastAPI 0.111)                                          │
│  7个路由模块: project / courseware / knowledge / homework        │
│              diagnosis / agent / curriculum                      │
│  Pydantic 2.8 请求/响应模型 │ CORS中间件 │ 健康检查              │
├─────────────────────────────────────────────────────────────────┤
│  Agent框架层                                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ AgentBus (同步消息总线)                                      │ │
│  │  消息路由 · 状态持久化 · 通知推送                              │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ 4+1 Agents                                                  │ │
│  │  DiagnosisAgent ──→ TeachingAgent ──→ EvaluationAgent        │ │
│  │       │                                         ▲            │ │
│  │  KnowledgeAgent ──→ DiagnosisAgent              │            │ │
│  │  DiscoveryAgent ──→ (参数漂移/因果发现) ────────┘            │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ AgentState (共享状态)                                        │ │
│  │  AgentMessage · AgentEvent · AgentNotification               │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  数据层 (SQLite/PostgreSQL + SQLAlchemy 2.0 ORM)                │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐   │
│  │ 关系数据库         │ │ JSON课标数据      │ │ PPT文件存储     │   │
│  │ 22张业务表         │ │ 课程标准知识树     │ │ 本地文件系统     │   │
│  │ +内存图谱缓存      │ │ 学科-主题-模块-KP │ │ uploads/目录    │   │
│  └──────────────────┘ └──────────────────┘ └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**架构决策**：FastAPI单体应用，内部4层（前端 → API → Agent框架 → 数据）。不做微服务拆分。原因：团队小、功能聚焦、快速验证。5个Agent通过AgentBus同步协作，替代原来的9层7模型架构，降低系统复杂度同时保留核心诊断能力。

---

## 2. 项目制多学科设计

### 2.1 设计原则

每个学科独立项目，数据完全隔离，诊断独立运行。不同学科的课件、知识点、作业、诊断结果互不干扰。

```
┌─ 项目：高中地理（人教版） ─────────────────────┐
│  课件 · 知识图谱 · 作业 · 诊断 · 学习路径        │
└─────────────────────────────────────────────────┘
┌─ 项目：高中数学（人教版） ─────────────────────┐
│  课件 · 知识图谱 · 作业 · 诊断 · 学习路径        │
└─────────────────────────────────────────────────┘
```

### 2.2 项目模型 (projects表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) PK | UUID主键 |
| name | VARCHAR(200) NOT NULL | 项目名称，如"高中地理（人教版）" |
| subject | VARCHAR(50) NOT NULL | 学科标识，如"geography" |
| grade | VARCHAR(20) | 年级，如"高一" |
| description | VARCHAR(500) | 项目描述 |
| status | VARCHAR(20) | 项目状态：active / archived |
| curriculum_imported | BOOLEAN | 是否已导入课标 |
| graph_initialized | BOOLEAN | 是否已初始化图谱 |
| settings | JSON | 项目配置 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 2.3 数据隔离

所有业务表均通过 `project_id` 外键关联到projects表，实现数据隔离。API层强制按项目过滤数据，Agent框架在项目上下文中运行。当前实现中，部分表（Question、StudentAnswer、CDMParameter、Diagnosis）通过homework_id间接关联项目，后续需加强project_id的显式过滤。

---

## 3. 知识层级体系

### 3.1 六层知识层级

```
学科 (Subject)
  └── 主题 (Theme)
        └── 模块 (Module / Chapter)
              └── 知识点 (KnowledgePoint)
                    └── 考点 (ExamPoint)
                          └── 考法 (ExamMethod)
```

| 层级 | 说明 | 示例 |
|------|------|------|
| 学科 | 最顶层分类 | 地理 |
| 主题 | 知识领域划分 | 自然地理 / 人文地理 / 区域地理 |
| 模块 | 教材章节 | 必修一第二章 大气 |
| 知识点 | 最小知识单元 | 大气受热过程 |
| 考点 | 可被考查的知识维度 | 大气受热过程三环节 |
| 考法 | 考查方式与题型 | 选择题判断辐射类型 |

### 3.2 知识层级与图谱的关系

知识图谱中，学科→主题→模块→知识点构成层级结构（CONTAINS关系），知识点→考点→考法构成考查结构（HAS_EXAM_POINT / TESTED_BY_METHOD关系）。8种实体类型覆盖全部6个层级，25种关系类型描述层级间和层级内的关联。

---

## 4. 前端架构

### 4.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2 | UI框架 |
| TypeScript | 6.0 | 类型安全 |
| Ant Design | 6.4 | UI组件库 |
| AntV G6 | 5.1 | 知识图谱可视化 |
| ECharts | 6.0 | 图表可视化 |
| Axios | 1.16 | HTTP客户端 |
| React Router | 7.15 | 路由管理 |
| Vite | 8.0 | 构建工具 |
| Tailwind CSS | 3.4 | 原子化CSS |

### 4.2 路由设计

当前实现4个页面路由，默认重定向到知识图谱页：

| 路由路径 | 页面组件 | 说明 |
|----------|----------|------|
| / | Navigate → /knowledge-overview | 默认重定向 |
| /knowledge-overview | KnowledgeOverview | 知识图谱（图谱可视化+前驱追溯+关联实体） |
| /diagnosis-detail | DiagnosisDetail | 诊断分析（CDM诊断+根因追溯） |
| /teaching-decision | TeachingDecision | 教学决策（学习路径+教学建议） |
| /courseware-manage | CoursewareManage | 课件管理（上传+解析+知识点提取） |

路由结构采用MainLayout嵌套布局，侧边栏导航 + 顶部通知栏 + 内容区Outlet。

### 4.3 状态管理

当前采用组件内useState管理页面状态，尚未引入全局状态管理。计划引入Zustand管理以下全局状态：

| Store | 状态 | 说明 |
|-------|------|------|
| projectStore | currentProject, projectList | 当前项目上下文 |
| graphStore | graphData, selectedNode, highlightPath | 图谱交互状态 |
| diagnosisStore | diagnosisResults, cdmParams | 诊断结果缓存 |
| notificationStore | notifications, unreadCount | Agent通知 |

### 4.4 API层设计

API层基于Axios封装，响应拦截器自动解包`response.data`：

```typescript
// 基础配置
const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
});

// 响应拦截器：自动解包
api.interceptors.response.use(
  (response) => response.data,
  (error) => { console.error('API Error:', error); return Promise.reject(error); }
);
```

当前3个API模块：

| 模块 | 方法 | 说明 |
|------|------|------|
| coursewareApi | upload, list, get, parse, downloadTemplate, getFeedback | 课件管理 |
| knowledgeApi | graph, sync, prerequisite, trace, downstream, ontology, related, createEntity, createRelation, edcExtract | 知识图谱 |
| curriculumApi | import, tree | 课标管理 |

计划补充的API模块：

| 模块 | 方法 | 说明 |
|------|------|------|
| homeworkApi | create, addItems, importAnswers, getResults | 作业管理 |
| diagnosisApi | cdmEstimate, diagnose, getResult, confirm, getTrajectory | 诊断引擎 |
| agentApi | getEvents, getNotifications, markRead, getMessages | Agent监控 |
| projectApi | create, list, get, importCurriculum | 项目管理 |

### 4.5 组件库架构

| 组件 | 类型 | 说明 |
|------|------|------|
| KnowledgeGraph | 核心组件 | AntV G6图谱可视化，支持层级展开/折叠、节点点击、路径高亮、掌握率着色 |
| CDMParams | 核心组件 | CDM参数展示（待实现） |
| CounterfactualPanel | 核心组件 | 反事实推理面板（待实现） |
| CoursewareModeTag | 标签组件 | 课件解析模式标签（模板/自由） |
| ParseStatusTag | 标签组件 | 解析状态标签（待解析/解析中/已解析/失败） |
| MainLayout | 布局组件 | 侧边栏+顶部栏+内容区 |

KnowledgeGraph组件核心特性：
- 5层节点样式：subject(圆形) → theme(矩形) → module(矩形) → knowledgepoint(掌握率着色) → exampoint/exammethod
- 25种关系边的差异化样式（颜色、虚线、箭头、标签）
- 点击展开/折叠子层级
- 前驱追溯路径高亮
- 根因节点红色加粗边框
- 自定义知识点黄色虚线边框

### 4.6 类型系统

核心TypeScript类型定义：

| 类型 | 说明 |
|------|------|
| CoursewareItem / CoursewareDetail | 课件列表项/详情 |
| KnowledgePointItem | 知识点 |
| GraphNode / GraphEdge | 图谱节点/边 |
| GraphEntity / GraphRelation | 图谱实体/关系（V2） |
| KnowledgeGraphData / KnowledgeGraphDataV2 | 图谱数据（V1/V2） |
| GraphSubject / GraphModule | 学科/模块 |
| PrerequisiteChain / TraceResult | 前驱链/追溯结果 |
| RelatedEntity | 关联实体 |
| OntologyInfo / RelationTypeDef | 本体信息 |

### 4.7 设计系统

CSS Token变量定义于 `tokens.css`，覆盖颜色、字体、间距、圆角4个维度：

- **诊断色板**：cdm-high(绿) / cdm-medium(黄) / cdm-low(红) / root-cause(红) / counterfactual(紫)
- **Agent色板**：agent(紫)
- **间距系统**：xs(4px) → sm(8px) → md(16px) → lg(24px) → xl(32px) → xxl(48px)
- **圆角系统**：sm(4px) / md(8px) / lg(12px)

---

## 5. API层设计

### 5.1 路由模块总览

| 模块 | 前缀 | 标签 | 端点数 |
|------|------|------|--------|
| project | /api/project | project | 4 |
| courseware | /api/courseware | courseware | 5 |
| knowledge | /api/knowledge | knowledge | 13 |
| homework | /api/homework | homework | 7 |
| diagnosis | /api/diagnosis | diagnosis | 14 |
| agent | /api/agent | agent | 6 |
| curriculum | /api/curriculum | curriculum | 3 |

### 5.2 项目管理 /api/project/*

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/project/ | 创建项目 |
| GET | /api/project/ | 项目列表 |
| GET | /api/project/{project_id} | 项目详情 |
| POST | /api/project/{project_id}/import-curriculum | 导入课标到项目 |

### 5.3 课件管理 /api/courseware/*

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/courseware/upload | 上传PPT课件（multipart/form-data） |
| POST | /api/courseware/{id}/parse | 触发课件解析（模板检测+知识点提取） |
| GET | /api/courseware/ | 课件列表（支持subject过滤） |
| GET | /api/courseware/{id} | 课件详情（含知识点列表） |
| GET | /api/courseware/template/download | 下载课件模板 |

### 5.4 知识图谱 /api/knowledge/*

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/knowledge/graph | 获取知识图谱（支持subject/entity_type过滤） |
| GET | /api/knowledge/ontology | 获取本体定义（8种实体+25种关系） |
| POST | /api/knowledge/sync | 同步图谱（DB↔内存） |
| GET | /api/knowledge/{kp_code}/prerequisite | 获取前驱链（DFS，max_depth=5） |
| GET | /api/knowledge/{kp_code}/trace | 获取追溯路径（前驱链+下游+关联实体） |
| GET | /api/knowledge/{kp_code}/downstream | 获取下游影响节点（BFS） |
| GET | /api/knowledge/{kp_code}/related | 获取关联实体（入向+出向） |
| POST | /api/knowledge/entity | 创建图谱实体 |
| POST | /api/knowledge/relation | 创建图谱关系 |
| POST | /api/knowledge/edc/extract | EDC关系提取（模式匹配+LLM） |
| POST | /api/knowledge/fusion/align | 课件-课标知识融合对齐 |
| PUT | /api/knowledge/kp/{kp_id} | 更新知识点 |
| DELETE | /api/knowledge/kp/{kp_id} | 删除知识点 |
| PUT | /api/knowledge/kp/{kp_id}/align | 手动对齐知识点到课标 |

### 5.5 作业管理 /api/homework/*

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/homework/ | 创建作业 |
| POST | /api/homework/{id}/items | 添加题目 |
| POST | /api/homework/{id}/import | 导入已批改答题数据 |
| GET | /api/homework/{id}/results | 获取作业结果 |
| POST | /api/homework/{id}/q-matrix/generate | 生成Q矩阵（nlp/llm/manual） |
| GET | /api/homework/{id}/q-matrix | 获取Q矩阵 |
| PUT | /api/homework/{id}/q-matrix/confirm | 教师确认/修正Q矩阵 |
| POST | /api/homework/{id}/q-matrix/validate | Q矩阵数据验证 |

### 5.6 诊断引擎 /api/diagnosis/*

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/diagnosis/cdm-estimate | 触发CDM参数估计（DINA模型EM算法） |
| GET | /api/diagnosis/cdm/status | CDM估计状态 |
| GET | /api/diagnosis/cdm/params | 获取CDM参数（slip/guess/alpha） |
| GET | /api/diagnosis/cdm/update-history | 参数更新历史 |
| POST | /api/diagnosis/diagnose | 触发诊断（学生/班级） |
| GET | /api/diagnosis/result/{exam_id}/{student_id} | 获取诊断结果 |
| POST | /api/diagnosis/{id}/confirm | 教师确认诊断 |
| POST | /api/diagnosis/counterfactual | 反事实推理（待实现） |
| POST | /api/diagnosis/online-em/update | 在线EM增量更新 |
| POST | /api/diagnosis/session | 创建诊断会话 |
| GET | /api/diagnosis/trajectory/{student_id} | 获取掌握轨迹 |
| POST | /api/diagnosis/kt/predict | BKT预测 |
| POST | /api/diagnosis/kt/mastery-time | 掌握时间预测 |
| POST | /api/diagnosis/learning-path | 生成学习路径 |
| GET | /api/diagnosis/learning-path/{student_id} | 获取学习路径 |
| PUT | /api/diagnosis/learning-activity/{id}/result | 更新学习活动结果 |

### 5.7 Agent /api/agent/*

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/agent/events | Agent事件列表 |
| GET | /api/agent/notifications | 教师通知列表 |
| PUT | /api/agent/notifications/{id}/read | 标记通知已读 |
| GET | /api/agent/messages | Agent消息列表 |
| POST | /api/agent/messages | 发送Agent消息 |
| GET | /api/agent/agents | Agent列表及状态 |

### 5.8 课标管理 /api/curriculum/*

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/curriculum/import | 导入默认课标 |
| GET | /api/curriculum/tree | 获取课标知识树 |
| POST | /api/curriculum/align | 课件对齐（提示信息） |

### 5.9 认证与中间件

**当前状态**：未实现JWT认证。CORS中间件已配置，允许localhost:5173和localhost:3000。

**计划实现**：
- JWT认证中间件（python-jose + passlib已引入）
- 全局异常处理器（FastAPI ExceptionHandler）
- 请求日志中间件

### 5.10 请求/响应模型 (Pydantic)

| 模型 | 模块 | 说明 |
|------|------|------|
| ProjectCreate | project | 创建项目请求 |
| CurriculumImportRequest | project | 导入课标请求 |
| CreateHomeworkRequest | homework | 创建作业请求 |
| AddItemsRequest | homework | 添加题目请求 |
| ImportAnswersRequest | homework | 导入答题请求 |
| GenerateQMatrixRequest | homework | 生成Q矩阵请求 |
| ConfirmQMatrixRequest | homework | 确认Q矩阵请求 |
| CDMEstimateRequest | diagnosis | CDM估计请求 |
| DiagnoseRequest | diagnosis | 诊断请求 |
| ConfirmRequest | diagnosis | 确认诊断请求 |
| LearningPathRequest | diagnosis | 学习路径请求 |
| OnlineEMRequest | diagnosis | 在线EM请求 |
| KTPredictRequest | diagnosis | BKT预测请求 |
| KTMasteryTimeRequest | diagnosis | 掌握时间请求 |
| AgentMessageCreate | agent | Agent消息请求 |
| EntityCreate | knowledge | 创建实体请求 |
| RelationCreate | knowledge | 创建关系请求 |
| EDCExtractRequest | knowledge | EDC提取请求 |
| KPUpdateRequest | knowledge | 知识点更新请求 |
| KPAlignRequest | knowledge | 知识点对齐请求 |
| FusionAlignRequest | knowledge | 融合对齐请求 |

---

## 6. Agent框架设计

### 6.1 AgentBus 消息总线

AgentBus是Agent之间的通信中枢，采用同步调用模式，消息持久化到数据库。

**消息格式** (agent_messages表)：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) PK | UUID主键 |
| sender_agent | VARCHAR(50) NOT NULL | 发送方Agent名称 |
| receiver_agent | VARCHAR(50) NOT NULL | 接收方Agent名称 |
| message_type | VARCHAR(50) NOT NULL | 消息类型 |
| payload | JSON NOT NULL | 消息负载 |
| status | VARCHAR(20) | 消息状态：pending / processed / failed |
| parent_message_id | VARCHAR(36) FK | 父消息ID（消息链） |
| created_at | DATETIME | 创建时间 |
| processed_at | DATETIME | 处理时间 |

**传递方式**：同步调用。AgentBus接收消息后，立即调用目标Agent的handler处理，处理完成后标记status为processed。

**消息处理流程**：

```
send_agent_message()
  ├── 创建AgentMessage记录 → 写入DB
  ├── _process_message()
  │     ├── 查找receiver的handler
  │     ├── 执行handler逻辑
  │     │     ├── 可能创建AgentEvent
  │     │     ├── 可能创建AgentNotification
  │     │     └── 可能递归调用send_agent_message()
  │     └── 标记status=processed
  └── 返回AgentMessage
```

### 6.2 Agent定义

当前代码中定义了4种Agent类型，对应5个概念Agent（KnowledgeAgent的逻辑分散在knowledge_service中）：

| Agent | 代码标识 | 核心能力 | 触发条件 | 输出 |
|-------|----------|----------|----------|------|
| DiagnosisAgent | diagnosis | DINA模型EM估计、知识状态推断、根因追溯 | cdm_estimate_request, parameter_update | CDMParameter, Diagnosis, RootCauseReport |
| KnowledgeAgent | (分散在knowledge_service) | 图谱构建、EDC关系提取、语义对齐、前驱发现 | Courseware.parsed, Curriculum.imported | GraphEntity, GraphRelation, AlignmentResult |
| TeachingAgent | teaching | 学习路径生成、活动推荐、教学建议 | diagnosis_complete | LearningPath, LearningActivity, TeachingSuggestion |
| EvaluationAgent | evaluation | 教学效果追踪、参数验证 | monitor_request | EvaluationEvent |
| DiscoveryAgent | discovery | 因果发现、参数漂移检测、图谱演化 | new_prereq_candidate | CausalHypothesis, DriftAlert |

### 6.3 Agent协作关系

```
KnowledgeAgent ──(图谱更新)──→ DiagnosisAgent
DiagnosisAgent ──(诊断完成)──→ TeachingAgent
TeachingAgent ──(教学效果数据)──→ EvaluationAgent
DiscoveryAgent ──(参数漂移)──→ DiagnosisAgent (重新诊断)
DiscoveryAgent ──(新前驱候选)──→ AgentNotification (通知教师)
```

### 6.4 Agent消息类型

| 事件类型 | 发送方 | 接收方 | 说明 |
|----------|--------|--------|------|
| cdm_estimate_request | API层 | DiagnosisAgent | CDM参数估计请求 |
| parameter_update | DiscoveryAgent | DiagnosisAgent | 参数更新（漂移>0.1触发通知） |
| diagnosis_complete | DiagnosisAgent | TeachingAgent | 诊断完成（触发教学建议） |
| monitor_request | TeachingAgent | EvaluationAgent | 教学效果监控请求 |
| new_prereq_candidate | DiscoveryAgent | AgentNotification | 新前驱关系候选（置信度>0.7通知教师） |

### 6.5 Agent事件与通知

**AgentEvent** (agent_events表)：记录Agent内部事件，用于审计和调试。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK AUTO | 自增主键 |
| event_type | VARCHAR(50) | 事件类型 |
| source_type | VARCHAR(50) | 来源Agent |
| source_id | INTEGER | 来源ID |
| payload | JSON | 事件负载 |
| status | VARCHAR(20) | 事件状态 |
| created_at | DATETIME | 创建时间 |
| processed_at | DATETIME | 处理时间 |

**AgentNotification** (agent_notifications表)：向教师推送通知。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK AUTO | 自增主键 |
| teacher_id | INTEGER | 教师ID |
| event_id | INTEGER FK | 关联事件 |
| notification_type | VARCHAR(50) | 通知类型 |
| title | VARCHAR(200) | 通知标题 |
| content | VARCHAR | 通知内容 |
| is_read | BOOLEAN | 是否已读 |
| created_at | DATETIME | 创建时间 |

### 6.6 Agent协作流程

**场景：学生完成一次作业后的完整诊断-教学闭环**

```
1. 作业数据导入 → API层创建StudentAnswer记录
2. Q矩阵生成 → NLP/LLM在课标约束候选集内匹配
3. 教师确认Q矩阵 → q_matrix_confirmed=True
4. DiagnosisAgent 接收触发：
   a. 运行DINA模型EM估计 → 得到slip、guess、alpha参数
   b. 沿知识图谱前驱链追溯根因 → 生成RootCauseReport
   c. 发送 diagnosis_complete → TeachingAgent
5. TeachingAgent 接收诊断结果：
   a. 生成个性化学习路径 → LearningPath
   b. 推荐适配学习活动 → LearningActivity
   c. 发送 monitor_request → EvaluationAgent
6. DiscoveryAgent 后台运行：
   a. 在线EM增量更新CDM参数
   b. 检测参数漂移 → DriftAlert
   c. 因果发现 → CausalHypothesis
   d. 参数更新 → 触发DiagnosisAgent重新诊断
```

---

## 7. 数据层设计

### 7.1 完整表结构（22张表）

#### 项目表

| 表名 | 说明 | project_id |
|------|------|------------|
| projects | 项目（学科独立项目，数据隔离） | - (自身) |

#### 知识图谱表

| 表名 | 说明 | project_id |
|------|------|------------|
| graph_entities | 图谱实体（8种实体类型） | ✓ 索引 |
| graph_relations | 图谱关系（25种关系类型，含权重和置信度） | ✓ 索引 |

#### 课件与知识点表

| 表名 | 说明 | project_id |
|------|------|------------|
| coursewares | 课件（PPT文件元数据、解析状态） | ✓ 索引 |
| knowledge_points | 知识点（编码、名称、认知层级、课标对齐） | ✓ 索引 |
| curriculum_standards | 课程标准（JSON知识树） | ✓ 索引 |

#### 作业与答题表

| 表名 | 说明 | project_id |
|------|------|------------|
| homeworks | 作业（关联课件和班级） | ✓ 索引 |
| questions | 题目（内容、Q矩阵JSON、分值） | - (通过homework_id) |
| student_answers | 学生答题（答案、得分、正误） | - (通过homework_id) |

#### 诊断表

| 表名 | 说明 | project_id |
|------|------|------------|
| cdm_parameters | CDM参数（slip/guess/alpha JSON、AIC/BIC） | - (通过homework_id) |
| diagnoses | 诊断结果（知识状态、根因、置信度、追溯路径） | - (通过homework_id) |
| class_diagnoses | 班级诊断（根因聚合、学生分组、教学建议） | - (通过homework_id) |
| teacher_feedbacks | 教师反馈（诊断修正） | - (通过diagnosis_id) |
| courseware_feedbacks | 课件反馈（基于诊断结果的课件改进建议） | - (通过courseware_id) |

#### 追踪与路径表

| 表名 | 说明 | project_id |
|------|------|------------|
| diagnosis_sessions | 诊断会话（CDM快照、BKT状态、遗忘曲线） | - (通过homework_id) |
| learning_paths | 学习路径（路径节点JSON、当前进度） | - (通过diagnosis_session_id) |
| learning_activities | 学习活动（活动类型、难度、完成状态） | - (通过learning_path_id) |

#### Agent表

| 表名 | 说明 | project_id |
|------|------|------------|
| agent_events | Agent事件（事件类型、来源、负载） | - |
| agent_notifications | Agent通知（教师通知、已读状态） | - |
| agent_messages | Agent消息（发送方、接收方、消息链） | - |

#### 因果发现表

| 表名 | 说明 | project_id |
|------|------|------------|
| causal_discovery_results | 因果发现结果（skeleton、CPDAG、do演算） | - (通过homework_id) |

### 7.2 索引策略

当前已创建的索引：

| 表 | 索引字段 | 类型 | 说明 |
|----|----------|------|------|
| graph_entities | entity_type | 单列索引 | 按实体类型查询 |
| graph_entities | code | UNIQUE | 实体编码唯一 |
| graph_entities | project_id | 单列索引 | 项目数据隔离 |
| graph_relations | source_code | 单列索引 | 按源节点查询 |
| graph_relations | target_code | 单列索引 | 按目标节点查询 |
| graph_relations | relation_type | 单列索引 | 按关系类型查询 |
| graph_relations | project_id | 单列索引 | 项目数据隔离 |
| agent_messages | sender_agent | 单列索引 | 按发送方查询 |
| agent_messages | receiver_agent | 单列索引 | 按接收方查询 |
| diagnosis_sessions | session_timestamp | 单列索引 | 按时间查询 |

**需要补充的索引**：

| 表 | 索引字段 | 说明 |
|----|----------|------|
| student_answers | homework_id | 按作业查询答题 |
| student_answers | student_id | 按学生查询答题 |
| diagnoses | homework_id + student_id | 复合索引，查询学生诊断 |
| cdm_parameters | homework_id + estimated_at | 复合索引，查询最新参数 |
| knowledge_points | courseware_id | 按课件查询知识点 |

### 7.3 数据迁移策略

使用Alembic管理数据库迁移：

- `alembic/` 目录已初始化，含env.py和script.py.mako模板
- 启动时通过 `Base.metadata.create_all(bind=engine)` 自动创建表
- 生产环境应使用 `alembic revision --autogenerate` + `alembic upgrade head`

### 7.4 内存-数据库同步策略

**当前实现**：knowledge_service.py中使用模块级字典 `_graph_store` 作为内存图谱缓存，通过 `sync_from_db()` 和 `persist_to_db()` 实现双向同步。

```
DB (GraphEntity/GraphRelation)  ←load_from_db()──  _graph_store (内存)
                                  ──persist_to_db()→
DB (KnowledgePoint)             ←sync_from_db()──  _graph_store (内存)
                                  ──persist_to_db()→
```

**问题**：内存图谱是进程内的，服务重启后丢失，需从DB重新加载。多个请求间的内存状态不一致。

**解决方案**：DB为唯一数据源。所有读写操作直接操作DB，移除内存缓存层。图谱查询通过SQLAlchemy ORM直接查询GraphEntity/GraphRelation表，用索引保证查询性能。

---

## 8. CDM引擎设计

### 8.1 DINA模型

DINA（Deterministic Inputs, Noisy "And" Gate）模型是本系统的核心认知诊断模型。

**模型公式**：

```
P(X_ij = 1 | α_j) = (1 - s_i) × ∏_{k=1}^{K} α_{jk} ^ q_{ik}
                   + g_i × (1 - ∏_{k=1}^{K} α_{jk} ^ q_{ik})
```

| 符号 | 含义 |
|------|------|
| X_ij | 学生j在题目i上的作答（0/1） |
| α_j | 学生j的知识掌握向量（K维0/1向量） |
| q_i | 题目i的Q矩阵行向量（K维0/1向量） |
| s_i | 题目i的失误参数（slip，掌握了但答错） |
| g_i | 题目i的猜测参数（guess，没掌握但答对） |
| K | 知识点总数 |

**核心逻辑**：
- 若学生掌握全部所需知识点：P = 1 - s_i
- 若学生未掌握至少一个所需知识点：P = g_i
- 约束：s_i + g_i < 1（题目有区分度），代码中clip到[0.01, 0.49]并保证s+g<0.99

### 8.2 EM算法参数估计

**实现**：`DINAModel`类（dina_model.py）

**E步**：计算后验分布

```
P(α_l | X_j, Q, s, g) = P(X_j | α_l, s, g) × P(α_l) / Σ P(X_j | α_{l'}, s, g) × P(α_{l'})
```

对每个学生j，计算其属于每种知识掌握模式 α_l 的后验概率。遍历 2^K 种模式。

**M步**：更新参数

```
ŝ_i = Σ_post × (1 - responses) / Σ_post × η  (掌握但答错)
ĝ_i = Σ_post × responses / Σ_post × (1-η)    (未掌握但答对)
```

参数clip到[0.01, 0.49]，保证s+g<0.99。

**收敛条件**：参数变化量 max(|Δslip|, |Δguess|) < 1e-4 或达到最大迭代次数100。

**模型选择**：AIC/BIC

```
AIC = -2 × log(L) + 2 × p    (p = 2×题目数 + 知识点数)
BIC = -2 × log(L) + log(N) × p
```

### 8.3 Q矩阵管线

Q矩阵通过四步管线联合估计：

**Step 0：课程标准约束**

输入考试范围，从课标数据中确定候选知识点集合 K_candidate。课标约束确保Q矩阵的知识点选择范围有据可依。

**Step 1：NLP在候选集内选择**

输入题目文本 + 候选知识点集合。两种匹配策略：
- `_nlp_match()`：子串匹配 + 字符集重叠度（>0.6阈值）
- `_llm_match()`：调用DeepSeek API在候选集内选择，失败降级到NLP匹配

**Step 2：CDM联合估计验证**

当 ≥30 名学生有答题数据时触发。以 Q_prior 为初始值，EM算法迭代，同时估计Q矩阵和CDM参数。

**Step 3：教师修正作为约束**

教师修正的条目标记为 `q_matrix_source = 'teacher'`，EM算法不更新这些条目。

### 8.4 根因推断

根因推断基于知识图谱前驱链遍历 + CDM掌握概率，不是LLM推理。

**算法**（root_cause.py）：

1. 从CDM参数获取学生知识掌握状态 P(α_k=1)
2. 标记 P(α_k=1) < 0.5 的知识点为薄弱知识点
3. 对每个薄弱知识点，沿知识图谱PREREQUISITE_OF关系DFS遍历前驱链
4. 找到最深层前驱知识点 k_root，使得 P(α_{k_root}=1) < 0.5
5. 返回 k_root 作为根因，追溯路径为遍历路径

**置信度**：confidence = 1 - P(α_{k_root}=1)

**班级诊断**：聚合所有学生的掌握状态，统计每个知识点的薄弱人数，按薄弱人数排序定位班级根因。

---

## 9. 知识追踪设计

### 9.1 CDM+BKT双层架构

CDM提供单次快照诊断，BKT提供时序建模轨迹，两者互补：

```
CDM层（快照诊断）                    BKT层（时序追踪）
┌──────────────────┐                ┌──────────────────┐
│ 输入：单次作业数据 │                │ 输入：历史答题序列 │
│ 输出：P(α_k=1)    │ ──先验──→      │ 输出：P(L_t)      │
│ 特点：静态快照     │                │ 特点：动态轨迹     │
└──────────────────┘                └──────────────────┘
         │                                    │
         └──────────┬─────────────────────────┘
                    ▼
         ┌──────────────────┐
         │ 综合诊断输出       │
         │ · 学习速率        │
         │ · 遗忘曲线        │
         │ · 掌握时间预测     │
         └──────────────────┘
```

### 9.2 BKT模型

**实现**：`BKTModel`类（knowledge_tracing_service.py）

| 参数 | 含义 | 默认先验 |
|------|------|----------|
| P(L_0) | 初始掌握概率 | 0.1 |
| P(T) | 学习转移概率 | 0.1 |
| P(G) | 猜测概率 | 0.2 |
| P(S) | 失误概率 | 0.1 |

**状态更新**：

```
答对：P(L_t | 正确) = P(L_{t-1}) × (1-P(S)) / P_correct
答错：P(L_t | 错误) = P(L_{t-1}) × P(S) / (1-P_correct)
学习：P(L_t) = P(L_t | 答题) + (1 - P(L_t | 答题)) × P(T)
```

### 9.3 遗忘曲线

```
R(t) = mastery × e^{-decay_rate × t}
```

decay_rate = 0.02，预测30个时间步的保留率衰减。

### 9.4 掌握时间预测

```
T_mastery(k) = 迭代步数，直到 P(L_t) ≥ θ_mastery (默认0.8)
每步：P(L_t) = P(L_{t-1}) + (1 - P(L_{t-1})) × P(T)
最大迭代100步
```

---

## 10. 在线EM与参数演化

### 10.1 在线EM

**实现**：`OnlineEM`类（online_em_service.py）

```
在线EM：θ_{t+1} = (1 - η_t) · θ_t + η_t · M-step(E-step(x_t, θ_t))
```

- 学习率 η_t = 0.1 / (1 + 0.01 × update_count)，随更新次数衰减
- 充分统计量增量更新
- 参数clip到[0.01, 0.49]，保证s+g<0.99
- 检测显著变化：delta_slip > 0.1 或 delta_guess > 0.1

### 10.2 参数漂移检测

```
drift_i = |θ_i^{(t)} - θ_i^{(t-W)}| / σ_i^{(t-W)}
```

W为监控窗口大小。若drift > 0.1，触发AgentNotification通知教师。

### 10.3 因果发现

EvolutionAgent基于偏相关检验和PC-Stable算法发现知识点间的因果结构。结果存储在causal_discovery_results表（skeleton、CPDAG、do演算结果、置信度分数）。

---

## 11. 课件解析管线

课件（PPT）是知识来源，不是教材。解析管线支持模板PPT和非模板PPT两种模式：

```
PPT上传 → 检测是否模板PPT
  ├─ 是: 模板模式(确定性提取) → 准确率≥95%
  │     python-pptx直接读取固定区域 → 无需LLM
  └─ 否: 自由模式(LLM提取+校验) → 准确率≥80%
        LLM逐页解析 → 标记"需教师确认"
```

**模板PPT结构**：每页包含固定区域标识：`【标题】`、`【知识点】`、`【重点】`、`【认知层级】`。模板检测阈值：80%以上页面匹配模板标记。

**解析流程**：

1. **PPT上传**：保存到uploads/目录，创建Courseware记录（parse_status=pending）
2. **python-pptx提取**：逐页提取文本、表格、图片、备注
3. **模板检测**：检查固定区域标识，确定parse_mode
4. **知识点提取**：模板模式→确定性解析；自由模式→LLM提取+降级回退
5. **EDC关系提取**：模式匹配（PREREQUISITE_OF等7种关系）+ LLM关系提取
6. **课标对齐**：规则匹配（精确/子串/Jaccard）+ LLM语义对齐
7. **写入图谱**：创建GraphEntity/GraphRelation，创建KnowledgePoint记录

---

## 12. 安全设计

### 12.1 JWT认证流程（计划实现）

```
1. 教师登录 → POST /api/auth/login → 验证用户名密码
2. 签发JWT Access Token（python-jose）+ Refresh Token
3. 前端存储Token → Axios请求拦截器自动附加Authorization头
4. 后端FastAPI Depends验证Token → 获取当前用户
5. Token过期 → Refresh Token刷新
```

已引入的依赖：python-jose（JWT）、passlib（密码哈希）。

### 12.2 API权限控制（计划实现）

- 所有 /api/* 端点默认需要JWT认证
- 教师只能访问自己项目下的数据
- Agent消息和通知按teacher_id过滤

### 12.3 数据隔离（项目制）

- 所有业务表通过project_id外键关联
- API层强制按project_id过滤查询
- 当前缺失：Question、StudentAnswer、CDMParameter、Diagnosis等表缺少project_id字段，通过homework_id间接关联

### 12.4 LLM调用安全

- API Key通过环境变量注入（.env文件），不硬编码
- httpx.AsyncClient设置60秒超时
- LLM输出经Pydantic/JSON校验，防止注入
- Q矩阵LLM匹配降级策略：API不可用时回退到NLP匹配

---

## 13. 审计问题技术解决方案

### 13.1 循环依赖 → llm_client.py独立模块

**问题**：courseware_service.py 和 knowledge_service.py 互相导入（courseware_service调用knowledge_service的sync_courseware_knowledge/persist_to_db，knowledge_service调用courseware_service的call_llm_for_semantic_align）。

**解决方案**：提取 `llm_client.py` 独立模块，封装所有LLM调用逻辑（call_llm、call_llm_for_extraction、call_llm_for_relation_extraction、call_llm_for_semantic_align）。courseware_service和knowledge_service都依赖llm_client，消除双向依赖。

### 13.2 内存图谱不持久化 → DB为唯一数据源

**问题**：knowledge_service.py使用模块级字典 `_graph_store` 作为内存图谱缓存。进程重启后丢失，需从DB重新加载。多请求间状态不一致。

**解决方案**：
1. 移除 `_graph_store` 内存缓存
2. 所有图谱操作直接通过SQLAlchemy ORM读写GraphEntity/GraphRelation表
3. 图谱查询通过索引优化（entity_type、source_code、target_code、relation_type已有索引）
4. `get_graph()` 改为直接查询DB并组装返回数据
5. `add_entity()` / `add_relation()` 改为直接写入DB

### 13.3 DINA指数爆炸 → 变分推断降级

**问题**：DINA模型的E步需要遍历 2^K 种知识掌握模式。当K>20时，2^K超过百万，内存和计算不可行。

**解决方案**：
1. K ≤ 15：标准EM（2^K ≤ 32768，可行）
2. 15 < K ≤ 25：变分推断（Variational EM），用因子化分布 q(α) = Π q_k(α_k) 近似后验，复杂度从O(2^K)降到O(K)
3. K > 25：知识点分块诊断，按模块/章节分组，每组独立运行DINA

### 13.4 同步HTTP阻塞 → httpx.AsyncClient

**问题**：qmatrix_service.py的 `_llm_match()` 使用 `httpx.post()` 同步调用，阻塞事件循环。

**解决方案**：将 `_llm_match()` 改为 `async def _llm_match()`，使用 `httpx.AsyncClient` 异步调用。courseware_service.py的 `call_llm()` 已使用AsyncClient，作为参考实现。

### 13.5 线程安全 → threading.Lock

**问题**：
- `_graph_store` 字典在多线程环境下不安全（SQLite的check_same_thread=False已配置）
- `_online_em_instances` 字典在多请求环境下不安全

**解决方案**：
1. 移除 `_graph_store` 后此问题自然消除（DB为唯一数据源，SQLAlchemy Session已处理线程安全）
2. `_online_em_instances` 添加 `threading.Lock` 保护，或改为按homework_id从DB加载OnlineEM状态

### 13.6 类型安全 → 泛型API封装

**问题**：前端API调用返回 `Promise<unknown>`，需要手动类型断言 `as unknown as SomeType`。

**解决方案**：封装泛型API请求函数：

```typescript
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response: T = await api(config);
  return response;
}

// 使用
const data = await request<CoursewareListResponse>({ url: '/api/courseware/' });
```

---

## 14. 技术选型

| 层级 | 技术 | 版本 | 理由 |
|------|------|------|------|
| 前端框架 | React + TypeScript | 19.2 / 6.0 | 生态成熟，类型安全 |
| UI组件 | Ant Design | 6.4 | 开箱即用，中文友好 |
| 图谱可视化 | AntV G6 | 5.1 | 国产、中文文档、层级展开流畅 |
| 图表 | ECharts | 6.0 | 国产、功能全 |
| HTTP客户端 | Axios | 1.16 | 拦截器、自动解包 |
| 路由 | React Router | 7.15 | 声明式路由 |
| 构建 | Vite | 8.0 | 快速HMR |
| CSS | Tailwind CSS | 3.4 | 原子化CSS + CSS Tokens |
| 后端 | FastAPI | 0.111 | 异步、自动API文档、类型提示 |
| ORM | SQLAlchemy | 2.0 | Python生态标准，SQLite/PostgreSQL通用 |
| 数据验证 | Pydantic | 2.8 | 请求/响应模型、JSON校验 |
| 数值计算 | NumPy | 1.26 | EM算法矩阵运算 |
| 统计检验 | SciPy | 1.14 | 偏相关系数计算与显著性检验 |
| 数据处理 | Pandas | 2.2 | 答题数据清洗与统计 |
| HTTP客户端 | httpx | 0.27 | LLM API异步调用 |
| PPT解析 | python-pptx | 0.6 | Python标准PPT解析库 |
| LLM调用 | DeepSeek API | - | 便宜、中文好、结构化输出 |
| 数据库（开发） | SQLite | - | 零配置、单文件、开发便捷 |
| 数据库（生产） | PostgreSQL | 16 | JSONB支持好、并发性能优 |
| 文件存储 | 本地文件系统 | - | MVP阶段够用 |
| 迁移 | Alembic | 1.13 | 数据库版本管理 |

**已移除的技术**：

| 技术 | 移除原因 |
|------|----------|
| Neo4j | 知识图谱存储于GraphEntity/GraphRelation表，通过SQLAlchemy ORM操作，无需独立图数据库。docker-compose.yml中仍保留neo4j服务定义，应移除。 |
| Redis | AgentBus采用同步调用，共享状态存储于AgentMessage表，无需独立缓存。docker-compose.yml中仍保留redis服务定义，应移除。 |
| Celery | 配置了celery_app.py但无任何task定义，Agent触发采用同步调用，无需异步任务队列。应移除celery_app.py和requirements.txt中的celery/redis依赖。 |
| PyTorch | 知识追踪采用BKT（贝叶斯知识追踪），无需深度学习框架。 |

---

## 15. MVP不做的事

- ❌ 微服务拆分（单体即可，内部分层足够）
- ❌ Neo4j图数据库（GraphEntity/GraphRelation表满足需求）
- ❌ Redis缓存（SQLite/PostgreSQL满足MVP阶段读写需求）
- ❌ Celery异步任务（AgentBus同步调用满足需求）
- ❌ Milvus向量数据库（MVP知识点少，NLP语义匹配直接用LLM+规则）
- ❌ MinIO对象存储（本地文件系统）
- ❌ K8s部署（Docker Compose即可）
- ❌ 模型微调（CDM参数通过EM算法估计，不是神经网络训练）
- ❌ 自动批改（作业数据以已批改结果导入）
- ❌ 视频理解（多模态仅支持图片OCR和图表解析，不做视频内容理解）
- ❌ Agent自主决策（MVP阶段Agent按预设流程协作，不做自主规划与协商）
- ❌ 实时流式诊断（在线EM增量更新，但不做流式数据管道，仍以作业批次为单位触发）
- ❌ 跨学科因果发现（偏相关检验和PC-Stable仅在单项目/单学科知识图谱内运行）
- ❌ DKT/AKT深度知识追踪（MVP采用BKT，无需PyTorch）
