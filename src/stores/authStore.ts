import { create } from 'zustand';
import { User } from '../types/models';
import { tokenStorage } from '../services/api';
import { fetchCurrentUser } from '../services/authService';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  restoreSession: () => Promise<void>;
  clearAuth: () => void;
}

/**
 * Store Zustand para autenticação e sessão do usuário.
 * Gerencia token JWT, dados do usuário e estado de carregamento.
 * Persiste token em SecureStore (mobile) ou localStorage (web).
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  /** Atualiza o usuário autenticado no estado */
  setUser: (user) => set({ user }),

  /** Define mensagem de erro de autenticação */
  setError: (error) => set({ error }),

  /** Controla o estado de carregamento durante operações de auth */
  setLoading: (isLoading) => set({ isLoading }),

  /**
   * Restaura a sessão na inicialização do app.
   * Lê o token do storage, valida com o servidor e restaura dados do usuário.
   * Se o token expirou ou é inválido, limpa o storage.
   */
  restoreSession: async () => {
    try {
      await tokenStorage.init();
      if (tokenStorage.get()) {
        const user = await fetchCurrentUser();
        if (user) {
          set({ user, isLoading: false });
          return;
        }
        // Token inválido/expirado — limpa o armazenamento
        await tokenStorage.clear();
      }
    } catch { /* ignore */ }
    set({ isLoading: false });
  },

  /** Limpa o estado de auth (logout) e remove token do storage */
  clearAuth: () => set({ user: null, error: null }),
}));
