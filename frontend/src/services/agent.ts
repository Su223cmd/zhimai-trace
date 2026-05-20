import { get, post, put } from './api';
import type { AgentMessage, AgentNotification } from '../types';

export const agentApi = {
  sendMessage: (sender: string, receiver: string, messageType: string, payload: Record<string, unknown>, parentMessageId?: string) =>
    post<{ id: string; sender: string; receiver: string; type: string; status: string }>('/api/agent/messages', {
      sender,
      receiver,
      message_type: messageType,
      payload,
      parent_message_id: parentMessageId,
    }),

  getMessages: (agentType?: string, status?: string, limit: number = 50) => {
    const params: Record<string, string> = {};
    if (agentType) params.agent_type = agentType;
    if (status) params.status = status;
    params.limit = String(limit);
    return get<{ total: number; items: AgentMessage[] }>('/api/agent/messages', params);
  },

  getNotifications: (isRead?: boolean) => {
    const params: Record<string, string> = {};
    if (isRead !== undefined) params.is_read = String(isRead);
    return get<{ total: number; items: AgentNotification[] }>('/api/agent/notifications', params);
  },

  markNotificationRead: (notificationId: number) =>
    put<{ status: string }>(`/api/agent/notifications/${notificationId}/read`),

  initializeAgents: () =>
    post<{ status: string; message: string }>('/api/agent/initialize', {}),

  getAgentStates: () =>
    get<{ agents: Array<{ name: string; status: string; last_event_type: string; last_event_time: string; description: string }>; total: number }>('/api/agent/agents'),

  getAgentEvents: (limit: number = 20) =>
    get<{ total: number; items: Array<{ id: number; event_type: string; source_type: string; payload: Record<string, unknown>; status: string; created_at: string }> }>('/api/agent/events', { limit: String(limit) }),
};
