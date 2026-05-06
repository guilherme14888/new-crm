import { create } from 'zustand';
import { apiFetch } from '../services/api';
import { useUIStore } from './uiStore';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  role: string;
  joinedAt: string;
}

interface TeamState {
  teams: Team[];
  teamMembers: Record<string, TeamMember[]>; // teamId -> members
  isLoading: boolean;

  loadTeams: () => Promise<void>;
  createTeam: (data: { name: string; description?: string; color?: string }) => Promise<Team | null>;
  updateTeam: (id: string, patch: Partial<Pick<Team, 'name' | 'description' | 'color'>>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  loadMembers: (teamId: string) => Promise<void>;
  addMember: (teamId: string, userId: string, role?: string) => Promise<TeamMember | null>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  updateMemberRole: (teamId: string, userId: string, role: string) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  teamMembers: {},
  isLoading: false,

  loadTeams: async () => {
    set({ isLoading: true });
    try {
      const teams = await apiFetch<Team[]>('/api/teams');
      set({ teams });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar equipes');
    } finally {
      set({ isLoading: false });
    }
  },

  createTeam: async (data) => {
    try {
      const team = await apiFetch<Team>('/api/teams', { method: 'POST', body: JSON.stringify(data) });
      set((s) => ({ teams: [...s.teams, team] }));
      return team;
    } catch {
      useUIStore.getState().showToast('Erro ao criar equipe');
      return null;
    }
  },

  updateTeam: async (id, patch) => {
    try {
      await apiFetch(`/api/teams/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ teams: s.teams.map((t) => t.id === id ? { ...t, ...patch } : t) }));
    } catch {
      useUIStore.getState().showToast('Erro ao atualizar equipe');
    }
  },

  deleteTeam: async (id) => {
    try {
      await apiFetch(`/api/teams/${id}`, { method: 'DELETE' });
      set((s) => ({ teams: s.teams.filter((t) => t.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Erro ao excluir equipe');
    }
  },

  loadMembers: async (teamId) => {
    try {
      const members = await apiFetch<TeamMember[]>(`/api/teams/${teamId}/members`);
      set((s) => ({ teamMembers: { ...s.teamMembers, [teamId]: members } }));
    } catch {
      useUIStore.getState().showToast('Erro ao carregar membros');
    }
  },

  addMember: async (teamId, userId, role = 'member') => {
    try {
      const member = await apiFetch<TeamMember>(`/api/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId, role }),
      });
      set((s) => ({
        teamMembers: { ...s.teamMembers, [teamId]: [...(s.teamMembers[teamId] ?? []), member] },
        teams: s.teams.map((t) => t.id === teamId ? { ...t, memberCount: t.memberCount + 1 } : t),
      }));
      return member;
    } catch {
      useUIStore.getState().showToast('Erro ao adicionar membro');
      return null;
    }
  },

  removeMember: async (teamId, userId) => {
    try {
      await apiFetch(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
      set((s) => ({
        teamMembers: {
          ...s.teamMembers,
          [teamId]: (s.teamMembers[teamId] ?? []).filter((m) => m.userId !== userId),
        },
        teams: s.teams.map((t) => t.id === teamId ? { ...t, memberCount: Math.max(0, t.memberCount - 1) } : t),
      }));
    } catch {
      useUIStore.getState().showToast('Erro ao remover membro');
    }
  },

  updateMemberRole: async (teamId, userId, role) => {
    try {
      await apiFetch(`/api/teams/${teamId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      set((s) => ({
        teamMembers: {
          ...s.teamMembers,
          [teamId]: (s.teamMembers[teamId] ?? []).map((m) =>
            m.userId === userId ? { ...m, role } : m
          ),
        },
      }));
    } catch {
      useUIStore.getState().showToast('Erro ao atualizar papel do membro');
    }
  },
}));
