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

  /** Carrega as tarefas de uma negociação a partir da API. */
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

  /** Cria uma tarefa, insere-a no topo da lista e a retorna; relança em caso de falha. */
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

  /** Atualiza uma tarefa e aplica o patch ao estado. */
  updateTask: async (id, patch) => {
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) }));
    } catch {
      useUIStore.getState().showToast('Erro ao atualizar tarefa');
    }
  },

  /** Marca uma tarefa como concluída, definindo completedAt no estado. */
  completeTask: async (id) => {
    try {
      await apiFetch(`/api/tasks/${id}/complete`, { method: 'PATCH' });
      const now = new Date().toISOString();
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, completedAt: now } : t) }));
    } catch {
      useUIStore.getState().showToast('Erro ao concluir tarefa');
    }
  },

  /** Reabre uma tarefa concluída, limpando completedAt no estado. */
  reopenTask: async (id) => {
    try {
      await apiFetch(`/api/tasks/${id}/reopen`, { method: 'PATCH' });
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, completedAt: null } : t) }));
    } catch {
      useUIStore.getState().showToast('Erro ao reabrir tarefa');
    }
  },

  /** Exclui uma tarefa e a remove do estado. */
  deleteTask: async (id) => {
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Erro ao excluir tarefa');
    }
  },
}));
