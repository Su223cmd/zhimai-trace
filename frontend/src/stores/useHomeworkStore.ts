import { create } from 'zustand';
import { homeworkApi } from '../services/homework';
import type { Homework } from '../types';

interface HomeworkState {
  homeworks: Homework[];
  loading: boolean;
  loaded: boolean;
  fetchHomeworks: (projectId?: string) => Promise<void>;
  invalidate: () => void;
}

export const useHomeworkStore = create<HomeworkState>((set, get) => ({
  homeworks: [],
  loading: false,
  loaded: false,

  fetchHomeworks: async (projectId?: string) => {
    if (get().loaded && !projectId) return;
    set({ loading: true });
    try {
      const res = await homeworkApi.list(projectId);
      const items = (res as { items?: Homework[] }).items || [];
      set({ homeworks: items, loading: false, loaded: true });
    } catch {
      set({ loading: false });
    }
  },

  invalidate: () => set({ loaded: false, homeworks: [] }),
}));
