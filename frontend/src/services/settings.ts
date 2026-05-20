import { get, put, post } from './api';

export const settingsApi = {
  getLLMConfig: () =>
    get<{ provider: string; api_key: string; base_url: string; configured: boolean }>('/api/settings/llm'),

  updateLLMConfig: (config: { provider?: string; api_key?: string; base_url?: string }) =>
    put<{ status: string }>('/api/settings/llm', config),

  testLLMConnection: () =>
    post<{ status: string; message: string }>('/api/settings/llm/test', {}),
};
