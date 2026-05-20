import { create } from 'zustand';
import { get, put } from '../services/api';

export interface AgentConfig {
  id: string;
  agent_name: string;
  config_key: string;
  config_value: string;
  value_type: string;
  description: string | null;
  updated_at: string;
}

export interface AgentLog {
  id: string;
  agent_name: string;
  task_type: string;
  status: string;
  input_summary: Record<string, unknown> | null;
  output_summary: Record<string, unknown> | null;
  steps: Array<{ agent: string; action: string; status: string; detail?: string; timestamp?: string }> | null;
  error_message: string | null;
  duration_ms: number | null;
  context_type: string | null;
  context_id: string | null;
  started_at: string;
  finished_at: string | null;
}

interface AgentState {
  configs: AgentConfig[];
  logs: AgentLog[];
  loading: boolean;
  fetchConfigs: (agentName?: string) => Promise<void>;
  updateConfig: (agentName: string, key: string, value: string, valueType?: string, description?: string) => Promise<void>;
  fetchLogs: (agentName?: string, contextType?: string, contextId?: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
  configs: [],
  logs: [],
  loading: false,

  fetchConfigs: async (agentName?: string) => {
    set({ loading: true });
    try {
      const params: Record<string, string> = {};
      if (agentName) params.agent_name = agentName;
      const res = await get<{ status: string; configs: AgentConfig[] }>('/api/agent/configs', params);
      set({ configs: res.configs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateConfig: async (agentName, key, value, valueType = 'string', description) => {
    await put('/api/agent/config', {
      agent_name: agentName,
      config_key: key,
      config_value: value,
      value_type: valueType,
      description,
    });
  },

  fetchLogs: async (agentName?: string, contextType?: string, contextId?: string) => {
    try {
      const params: Record<string, string> = {};
      if (agentName) params.agent_name = agentName;
      if (contextType) params.context_type = contextType;
      if (contextId) params.context_id = contextId;
      params.limit = '50';
      const res = await get<{ status: string; logs: AgentLog[] }>('/api/agent/logs', params);
      set({ logs: res.logs });
    } catch {
      set({ logs: [] });
    }
  },
}));
