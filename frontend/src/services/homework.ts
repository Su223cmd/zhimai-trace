import { get, post, put } from './api';
import type { Homework, HomeworkResult, QMatrixResponse } from '../types';

export const homeworkApi = {
  list: (projectId?: string) => {
    const params: Record<string, string> = {};
    if (projectId) params.project_id = projectId;
    return get<{ total: number; items: Homework[] }>('/api/homework/', params);
  },

  create: (projectId: string, title: string, classId: string = 'default-class', homeworkDate?: string) =>
    post<{ status: string; homework_id: string; title: string }>('/api/homework/', {
      project_id: projectId,
      title,
      class_id: classId,
      homework_date: homeworkDate,
    }),

  addItems: (homeworkId: string, questions: Array<Record<string, unknown>>) =>
    post<{ status: string; homework_id: string; added_count: number }>(`/api/homework/${homeworkId}/items`, { questions }),

  importAnswers: (homeworkId: string, answers: Array<Record<string, unknown>>) =>
    post<{ status: string; homework_id: string; imported_count: number }>(`/api/homework/${homeworkId}/import`, { answers }),

  getResults: (homeworkId: string) =>
    get<HomeworkResult>(`/api/homework/${homeworkId}/results`),

  generateQMatrix: (homeworkId: string, method: 'nlp' | 'llm' | 'manual' = 'nlp') =>
    post<{ status: string; homework_id: string; method: string; n_questions: number; n_knowledge_points: number; q_matrix: number[][]; kp_codes: string[]; kp_names: string[] }>(`/api/homework/${homeworkId}/q-matrix/generate`, { method }),

  getQMatrix: (homeworkId: string) =>
    get<QMatrixResponse>(`/api/homework/${homeworkId}/q-matrix`),

  confirmQMatrix: (homeworkId: string, adjustments?: Record<string, Record<string, number>>) =>
    put<{ status: string; message: string; homework_id: string }>(`/api/homework/${homeworkId}/q-matrix/confirm`, { adjustments }),

  validateQMatrix: (homeworkId: string) =>
    post<{ status: string; warnings: string[]; kp_coverage: number; total_kps: number; coverage_rate: number; n_questions: number }>(`/api/homework/${homeworkId}/q-matrix/validate`),
};
