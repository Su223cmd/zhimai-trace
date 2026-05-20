import { create } from 'zustand';
import { projectApi } from '../services/project';
import { get } from '../services/api';
import type { Project, ClassItem } from '../types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  classes: ClassItem[];
  currentClassId: string;
  fetchProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, subject: string, grade?: string, description?: string) => Promise<Project>;
  fetchClasses: (projectId: string) => Promise<void>;
  setCurrentClassId: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  classes: [],
  currentClassId: '',

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const result = await projectApi.list();
      set({ projects: result.items, loading: false });
      if (!get().currentProject && result.items.length > 0) {
        set({ currentProject: result.items[0] });
        get().fetchClasses(result.items[0].id);
      }
    } catch {
      set({ loading: false });
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project, classes: [], currentClassId: '' });
    if (project) {
      get().fetchClasses(project.id);
    }
  },

  createProject: async (name, subject, grade, description) => {
    const result = await projectApi.create(name, subject, grade, description);
    await get().fetchProjects();
    const newProject = get().projects.find(p => p.id === result.id);
    if (newProject) set({ currentProject: newProject });
    return result as unknown as Project;
  },

  fetchClasses: async (projectId: string) => {
    try {
      const res = await get<{ status: string; classes: ClassItem[] }>('/api/class/list', { project_id: projectId });
      const classes = res.classes || [];
      set({ classes });
      if (!get().currentClassId && classes.length > 0) {
        set({ currentClassId: classes[0].id });
      }
    } catch {
      set({ classes: [] });
    }
  },

  setCurrentClassId: (id) => set({ currentClassId: id }),
}));
