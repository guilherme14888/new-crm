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
  updateUser: (id: string, patch: Partial<Pick<CRMUser, 'displayName' | 'role' | 'isActive' | 'avatarUrl'> & { companyId?: string; aclProfileId?: string; password?: string }>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const useCRMUserStore = create<CRMUserState>((set) => ({
  users: [],
  isLoading: false,

  /** Carrega os usuários do CRM via API (web) ou repositório local (nativo). */
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

  /** Cria um usuário (web ou local) e o adiciona ao estado; relança o erro em caso de falha. */
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

  /** Atualiza um usuário (web ou local) e aplica o patch ao estado; relança o erro em caso de falha. */
  updateUser: async (id, patch) => {
    try {
      if (Platform.OS === 'web') {
        await apiUpdateCRMUser(id, patch);
      } else {
        const { updateCRMUser } = await import('../db/crmUserRepo');
        await updateCRMUser(id, patch);
      }
      // a senha não faz parte do estado do usuário — não guardar em memória
      const { password: _pwd, ...statePatch } = patch as typeof patch & { password?: string };
      set((s) => ({ users: s.users.map((u) => u.id === id ? { ...u, ...statePatch } : u) }));
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Failed to update user');
      throw e;
    }
  },

  /** Remove um usuário: desativa via API (web) ou exclui no repositório local (nativo), tirando-o do estado. */
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
