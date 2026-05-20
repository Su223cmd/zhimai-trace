import axios from 'axios';
import type {
  CoursewareDetail,
  CoursewareListResponse,
  KnowledgeGraphDataV2,
  OntologyInfo,
  TraceResult,
  RelatedEntity,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export async function get<T>(url: string, params?: Record<string, string>): Promise<T> {
  const response = await api.get<T>(url, { params });
  return response.data;
}

export async function post<T>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T> {
  const response = await api.post<T>(url, data, config);
  return response.data;
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.put<T>(url, data);
  return response.data;
}

export const coursewareApi = {
  upload: (file: File, subject: string = 'geography', version: string = '人教版', grade: string = '高一') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', subject);
    formData.append('version', version);
    formData.append('grade', grade);
    return post<{ id: string; name: string; parse_status: string }>(
      '/api/courseware/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  list: (subject?: string) => {
    const params: Record<string, string> = {};
    if (subject) params.subject = subject;
    return get<CoursewareListResponse>('/api/courseware/', params);
  },
  get: (id: string) => get<CoursewareDetail>(`/api/courseware/${id}`),
  parse: (id: string) => post<{ parse_mode: string; created_knowledge_points: number }>(`/api/courseware/${id}/parse`),
  downloadTemplate: () => `${api.defaults.baseURL}/api/courseware/template/download`,
  getFeedback: (id: string) => get<Record<string, unknown>>(`/api/courseware/${id}/feedback`),
};

export const knowledgeApi = {
  graph: (subject?: string) => {
    const params: Record<string, string> = {};
    if (subject) params.subject = subject;
    return get<KnowledgeGraphDataV2>('/api/knowledge/graph', params);
  },
  sync: () => post<{ status: string }>('/api/knowledge/sync'),
  prerequisite: (kpCode: string, maxDepth: number = 5) =>
    get<{ chain: Array<{ code: string; name: string }>; depth: number }>(
      `/api/knowledge/${kpCode}/prerequisite`,
      { max_depth: String(maxDepth) }
    ),
  trace: (kpCode: string) => get<TraceResult>(`/api/knowledge/${kpCode}/trace`),
  downstream: (kpCode: string) => get<{ downstream: string[]; count: number }>(`/api/knowledge/${kpCode}/downstream`),
  ontology: () => get<OntologyInfo>('/api/knowledge/ontology'),
  related: (kpCode: string, relationType?: string) => {
    const params: Record<string, string> = {};
    if (relationType) params.relation_type = relationType;
    return get<{ related: RelatedEntity[] }>(`/api/knowledge/${kpCode}/related`, params);
  },
  createEntity: (entityType: string, code: string, properties: Record<string, unknown>) =>
    post<{ code: string; type: string }>('/api/knowledge/entity', { entity_type: entityType, code, properties }),
  createRelation: (source: string, target: string, type: string, weight: number = 1.0, confidence: number = 0.5) =>
    post<{ id: string }>('/api/knowledge/relation', { source, target, type, weight, confidence }),
  edcExtract: (text: string) =>
    post<{ entities: Array<{ type: string; code: string; name: string }>; relations: Array<{ source: string; target: string; type: string }> }>('/api/knowledge/edc/extract', { text }),
};

export const curriculumApi = {
  import: () => post<{ status: string; entity_count: number; relation_count: number }>('/api/curriculum/import'),
  tree: () => get<Record<string, unknown>>('/api/curriculum/tree'),
};

export default api;
