import { get, post } from './api';
import type { Project } from '../types';

export const projectApi = {
  create: (name: string, subject: string, grade?: string, description?: string) =>
    post<{ id: string; name: string; subject: string; status: string }>('/api/project/', { name, subject, grade, description }),

  list: () =>
    get<{ total: number; items: Project[] }>('/api/project/'),

  get: (projectId: string) =>
    get<Project>(`/api/project/${projectId}`),

  importCurriculum: (projectId: string, curriculumData?: Record<string, unknown>) =>
    post<{ status: string; entity_count: number; relation_count: number }>(`/api/project/${projectId}/import-curriculum`, { curriculum_data: curriculumData }),
};
