export interface CoursewareItem {
  id: string;
  name: string;
  subject: string;
  version: string;
  grade: string;
  slide_count: number | null;
  parse_status: 'pending' | 'parsing' | 'completed' | 'failed';
  parse_mode: 'template' | 'free';
  parsed_at: string | null;
  created_at: string;
}

export interface CoursewareDetail extends CoursewareItem {
  knowledge_points: KnowledgePointItem[];
}

export interface KnowledgePointItem {
  id: string;
  code: string;
  name: string;
  cognitive_level: string | null;
  chapter: string | null;
  source_type: string;
}

export interface CoursewareListResponse {
  total: number;
  items: CoursewareItem[];
}

export interface GraphNode {
  code: string;
  name: string;
  cognitive_level?: string;
  chapter?: string;
  mastery_rate?: number;
  source_type?: string;
  module_code?: string;
  courseware_id?: string | null;
  sequence?: number;
  description?: string;
  curriculum_alignment?: string;
}

export interface GraphSubject {
  code: string;
  name: string;
  version: string;
  [key: string]: string;
}

export interface GraphModule {
  code: string;
  name: string;
  semester: string;
  textbook_ref: string;
  theme_code: string;
  [key: string]: string | undefined;
}

export interface GraphTheme {
  code: string;
  name: string;
  subject_code?: string;
  [key: string]: string | undefined;
}

export interface PrerequisiteChain {
  chain: GraphNode[];
  depth: number;
}

export interface TraceResult {
  kp_code: string;
  prerequisite_chains: PrerequisiteChain[];
  downstream: string[];
  downstream_count: number;
}

export interface GraphEntity {
  type: string;
  code: string;
  name?: string;
  cognitive_level?: string;
  mastery_rate?: number;
  source_type?: string;
  module_code?: string;
  description?: string;
  courseware_id?: string | null;
  [key: string]: unknown;
}

export interface GraphRelation {
  source: string;
  target: string;
  type: string;
  weight: number;
  confidence: number;
  discovered_by: string;
  evidence?: Record<string, unknown>;
}

export interface OntologyInfo {
  entity_types: string[];
  relation_types: Record<string, RelationTypeDef>;
}

export interface RelationTypeDef {
  source: string;
  target: string;
  description: string;
}

export interface KnowledgeGraphDataV2 {
  nodes: GraphEntity[];
  edges: GraphRelation[];
  subjects: GraphSubject[];
  themes: GraphTheme[];
  modules: GraphModule[];
  ontology: OntologyInfo;
  stats: {
    total_nodes: number;
    total_edges: number;
    entity_counts: Record<string, number>;
    relation_counts: Record<string, number>;
  };
}

export interface RelatedEntity {
  source: string;
  target: string;
  type: string;
  weight: number;
  confidence: number;
  discovered_by: string;
  direction: 'incoming' | 'outgoing';
  source_entity?: GraphEntity | null;
  target_entity?: GraphEntity | null;
}

// ===== Project =====

export interface Project {
  id: string;
  name: string;
  subject: string;
  grade: string | null;
  description: string | null;
  status: string;
  curriculum_imported: boolean;
  graph_initialized: boolean;
  created_at: string;
}

// ===== Homework =====

export interface Homework {
  id: string;
  title: string;
  class_id: string;
  status: string;
  project_id: string;
  created_at: string;
}

export interface Question {
  id: string;
  seq: number;
  content: string;
  question_type: string;
  score: number;
  q_matrix: Record<string, number> | null;
  q_matrix_confirmed: boolean;
  q_matrix_source: string | null;
}

export interface StudentAnswer {
  id: string;
  student_id: string;
  question_id: string;
  student_answer: string | null;
  score: number | null;
  is_correct: boolean | null;
}

export interface HomeworkResult {
  status: string;
  homework_id: string;
  title: string;
  questions: Question[];
  student_answers: StudentAnswer[];
  student_ids: string[];
  students?: Record<string, unknown>;
  question_count?: number;
  student_count?: number;
}

export interface QMatrixRow {
  question_id: string;
  seq: number;
  content: string;
  q_vector: number[];
  confirmed: boolean;
}

export interface QMatrixResponse {
  status: string;
  homework_id: string;
  kp_codes: string[];
  kp_names: string[];
  questions: QMatrixRow[];
}

// ===== Diagnosis =====

export interface CDMParams {
  cdm_params_id: string;
  homework_id: string;
  model_type: string;
  slip: number[];
  guess: number[];
  alpha: {
    kp_codes: string[];
    student_ids: string[];
    alpha_estimates: number[][];
  };
  aic: number;
  bic: number;
  convergence_status: string;
  estimated_at: string;
}

export interface DiagnosisResult {
  status: string;
  diagnosis_id: string;
  student_id: string;
  knowledge_state: Record<string, number>;
  weak_kp_count: number;
  weak_kps: Array<{ code: string; mastery: number }>;
  root_causes: Array<{
    weak_kp: { code: string; mastery: number };
    root_cause: { code: string; mastery: number; name?: string };
    prerequisite_chain: Array<{ code: string; name: string; mastery: number }>;
    trace_depth: number;
  }>;
}

export interface ClassDiagnosisResult {
  status: string;
  homework_id: string;
  n_students: number;
  n_knowledge_points: number;
  kp_avg_mastery: Record<string, number>;
  class_root_causes: Array<{
    kp_code: string;
    kp_name: string;
    weak_count: number;
    weak_rate: number;
    avg_mastery: number;
    root_cause_code: string;
    prerequisite_chain: Array<{ code: string; name: string; mastery: number }>;
  }>;
}

// ===== Learning Path =====

export interface LearningPathNode {
  kp_id: string;
  kp_name: string;
  mastery_rate: number;
  cognitive_level: string;
  sequence: number;
}

export interface LearningActivity {
  id: string;
  type: string;
  content: { name: string; kp_name: string };
  sequence: number;
  status: string;
  result: Record<string, unknown> | null;
}

export interface LearningPath {
  id: string;
  student_id: string;
  root_cause_kp_id: string | null;
  path_nodes: LearningPathNode[];
  path_edges: Array<{ from: string; to: string; relation: string }>;
  estimated_duration: { total_hours: number; sessions: number; weeks: number };
  status: string;
  progress: number;
  activities: LearningActivity[];
}

// ===== Agent =====

export interface AgentMessage {
  id: string;
  sender_agent: string;
  receiver_agent: string;
  message_type: string;
  payload: Record<string, unknown>;
  status: string;
  parent_message_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface AgentNotification {
  id: number;
  teacher_id: number;
  event_id: number | null;
  notification_type: string;
  title: string;
  content: string | null;
  is_read: boolean;
  created_at: string;
}

// ===== API Response wrappers =====

export interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

