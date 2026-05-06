import { create } from 'zustand';
import { Platform } from 'react-native';
import { CRMUser } from '../types/models';
import { useUIStore } from './uiStore';
import { apiGetCRMUsers, apiUpdateCRMUser, apiCreateCRMUser } from '../services/apiDataService';

interface CRMUserState {
  users: CRMUser[];
  isLoading: boolean;

  loadUsers: () => Promise<void>;
  createUser: (data: Pick<CRMUser, 'email' | 'displayName' | 'role' | 'avatarUrl'> & { password?: string; companyId?: string; teamId?: string; aclProfileId?: string }) => Promise<void>;
  updateUser: (id: string, patch: Partial<Pick<CRMUser, 'displayName' | 'role' | 'isActive' | 'avatarUrl'> & { companyId?: string; aclProfileId?: string }>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const useCRMUserStore = create<CRMUserState>((set) => ({
  users: [],
  isLoading: false,

  loadUsers: async () => {
    set({ isLoading: true });
    try {
      if (Platform.OS === 'web') {
        const users = await apiGetCRMUsers();
        set({ users });
      } else {
        const { getAllCRMUsers } = await import('../db/crmUserRepo');
        const users = await getAllCRMUsers();
        set({ users });
      }
    } catch {
      useUIStore.getState().showToast('Failed to load users');
    } finally {
      set({ isLoading: false });
    }
  },

  createUser: async (data) => {
    try {
      if (Platform.OS === 'web') {
        const user = await apiCreateCRMUser(data);
        set((s) => ({ users: [...s.users, user] }));
        return;
      }
      const { createCRMUser } = await import('../db/crmUserRepo');
      const user = await createCRMUser(data);
      set((s) => ({ users: [...s.users, user] }));
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Failed to create user');
      throw e;
    }
  },

  updateUser: async (id, patch) => {
    try {
      if (Platform.OS === 'web') {
        await apiUpdateCRMUser(id, patch);
      } else {
        const { updateCRMUser } = await import('../db/crmUserRepo');
        await updateCRMUser(id, patch);
      }
      set((s) => ({ users: s.users.map((u) => u.id === id ? { ...u, ...patch } : u) }));
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Failed to update user');
      throw e;
    }
  },

  deleteUser: async (id) => {
    try {
      if (Platform.OS === 'web') {
        await apiUpdateCRMUser(id, { isActive: false });
      } else {
        const { deleteCRMUser } = await import('../db/crmUserRepo');
        await deleteCRMUser(id);
      }
      set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Failed to delete user');
    }
  },
}));
