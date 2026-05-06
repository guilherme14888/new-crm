import { create } from 'zustand';
import { Task } from '../types/models';
import { apiFetch } from '../services/api';
import { useUIStore } from './uiStore';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  loadTasks: (dealId: string) => Promise<void>;
  createTask: (data: { dealId: string; title: string; type?: string; dueDate?: string | null; description?: string | null; assignedTo?: string | null }) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,

  loadTasks: async (dealId) => {
    set({ isLoading: true });
    try {
      const tasks = await apiFetch<Task[]>(`/api/tasks?dealId=${dealId}`);
      set({ tasks });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar tarefas');
    } finally {
      set({ isLoading: false });
    }
  },

  createTask: async (data) => {
    try {
      const task = await apiFetch<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
      set((s) => ({ tasks: [task, ...s.tasks] }));
      return task;
    } catch {
      useUIStore.getState().showToast('Erro ao criar tarefa');
      throw new Error('Failed to create task');
    }
  },

  updateTask: async (id, patch) => {
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) }));
    } catch {
      useUIStore.getState().showToast('Erro ao atualizar tarefa');
    }
  },

  completeTask: async (id) => {
    try {
      await apiFetch(`/api/tasks/${id}/complete`, { method: 'PATCH' });
      const now = new Date().toISOString();
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, completedAt: now } : t) }));
    } catch {
      useUIStore.getState().showToast('Erro ao concluir tarefa');
    }
  },

  reopenTask: async (id) => {
    try {
      await apiFetch(`/api/tasks/${id}/reopen`, { method: 'PATCH' });
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, completedAt: null } : t) }));
    } catch {
      useUIStore.getState().showToast('Erro ao reabrir tarefa');
    }
  },

  deleteTask: async (id) => {
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Erro ao excluir tarefa');
    }
  },
}));
