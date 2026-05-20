import { get, post } from './api';
import type {
  CDMParams,
  DiagnosisResult,
  LearningPath,
} from '../types';

export const diagnosisApi = {
  estimateCDM: (homeworkId: string) =>
    post<{ status: string; cdm_params_id: string; converged: boolean; iterations: number; n_students: number; n_knowledge_points: number }>('/api/diagnosis/cdm-estimate', { homework_id: homeworkId }),

  getCDMStatus: (homeworkId: string) =>
    get<{ status: string; cdm_params_id?: string; convergence_status?: string }>('/api/diagnosis/cdm/status', { homework_id: homeworkId }),

  getCDMParams: (homeworkId: string) =>
    get<CDMParams>('/api/diagnosis/cdm/params', { homework_id: homeworkId }),

  getCDMHistory: (homeworkId: string) =>
    get<{ homework_id: string; history: Array<{ cdm_params_id: string; model_type: string; convergence_status: string; aic: number; bic: number; estimated_at: string }> }>('/api/diagnosis/cdm/update-history', { homework_id: homeworkId }),

  diagnoseStudent: (homeworkId: string, studentId: string) =>
    post<DiagnosisResult>('/api/diagnosis/diagnose', { homework_id: homeworkId, student_id: studentId }),

  getResult: (examId: string, studentId: string) =>
    get<DiagnosisResult | { status: string; message: string }>(`/api/diagnosis/result/${examId}/${studentId}`),

  confirmDiagnosis: (diagnosisId: string, correction?: Record<string, unknown>) =>
    post<{ status: string; diagnosis_id: string; confirmed: boolean }>(`/api/diagnosis/${diagnosisId}/confirm`, { correction }),

  getTrajectory: (studentId: string) =>
    get<{ student_id: string; trajectory: unknown[]; session_count: number }>(`/api/diagnosis/trajectory/${studentId}`),

  counterfactual: (homeworkId: string, studentId: string, targetKpCodes?: string[]) =>
    post<{ status: string; message: string; counterfactual_results?: unknown }>('/api/diagnosis/counterfactual', {
      homework_id: homeworkId,
      student_id: studentId,
      target_kp_codes: targetKpCodes,
    }),

  createLearningPath: (studentId: string, sessionId: string, rootCauseKpId: string, prerequisiteChain: Array<Record<string, unknown>>) =>
    post<{ id: string; student_id: string; path_nodes: unknown[]; estimated_duration: unknown; status: string }>('/api/diagnosis/learning-path', {
      student_id: studentId,
      diagnosis_session_id: sessionId,
      root_cause_kp_id: rootCauseKpId,
      prerequisite_chain: prerequisiteChain,
    }),

  getLearningPaths: (studentId: string) =>
    get<{ student_id: string; paths: LearningPath[] }>(`/api/diagnosis/learning-path/${studentId}`),

  updateActivityResult: (activityId: string, result: Record<string, unknown>) =>
    post<{ id: string; status: string; result: Record<string, unknown> }>(`/api/diagnosis/learning-activity/${activityId}/result`, { result }),

  getTeachingSuggestions: (homeworkId: string) =>
    get<{ status: string; homework_id: string; suggestions: Array<{ target_group: string; student_count: number; group_label: string; focus_kps: Array<{ kp_code: string; kp_name: string; current_mastery: number; urgency: number }>; strategy: Array<{ kp_code: string; kp_name: string; approach: string; exercises: string; expected_improvement: string }>; estimated_sessions: number }> }>('/api/diagnosis/teaching-suggestions', { homework_id: homeworkId }),

  getRemediationPriority: (homeworkId: string) =>
    get<{ status: string; homework_id: string; priorities: Array<{ kp_code: string; kp_name: string; avg_mastery: number; weak_count: number; weak_rate: number; urgency_score: number; prerequisite_depth: number }> }>('/api/diagnosis/remediation-priority', { homework_id: homeworkId }),

  getStudentClusters: (homeworkId: string, nClusters: number = 3) =>
    get<{ status: string; homework_id: string; clusters: Array<{ cluster_id: number; student_ids: string[]; size: number; avg_overall_mastery: number; weak_kps: Array<{ kp_code: string; kp_name: string; avg_mastery: number }> }> }>('/api/diagnosis/student-clusters', { homework_id: homeworkId, n_clusters: String(nClusters) }),
};
