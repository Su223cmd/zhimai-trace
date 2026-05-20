import { create } from 'zustand';
import { agentApi } from '../services/agent';
import type { AgentNotification } from '../types';

interface NotificationState {
  notifications: AgentNotification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    try {
      const result = await agentApi.getNotifications();
      const notifications = result.items || [];
      set({
        notifications,
        unreadCount: notifications.filter((n: AgentNotification) => !n.is_read).length,
      });
    } catch {
      // silently fail for notifications
    }
  },

  markRead: async (id) => {
    try {
      await agentApi.markNotificationRead(id);
      set(state => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // silently fail
    }
  },

  markAllRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },
}));
