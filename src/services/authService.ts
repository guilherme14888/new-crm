import { useAuthStore } from '../stores/authStore';
import { apiFetch, tokenStorage } from './api';
import { User } from '../types/models';
import { applyTenantTheme } from '../constants/theme';

type AuthUserResponse = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: User['role'];
  aclProfileId?: string | null;
  companyId: string;
  companyName: string | null;
  isMasterCompany?: boolean;
  isDefaultTenantUser?: boolean;
  canMiningHistory?: boolean;
  theme?: { sidebarBg?: string; sidebarText?: string; primary?: string } | null;
  companyLogo?: string | null;
  masterLogo?: string | null;
  teamId: string | null;
  onTrial?: boolean;
  trialDaysLeft?: number | null;
  trialEndsAt?: string | null;
  permissions?: Record<string, boolean> | null;
};

/** Converte a resposta de usuário da API de autenticação para o modelo User do frontend. */
function mapUser(u: AuthUserResponse): User {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    aclProfileId: u.aclProfileId ?? null,
    companyId: u.companyId,
    companyName: u.companyName ?? null,
    isMasterCompany: u.isMasterCompany ?? false,
    isDefaultTenantUser: u.isDefaultTenantUser ?? false,
    canMiningHistory: u.canMiningHistory ?? false,
    theme: u.theme ?? null,
    companyLogo: u.companyLogo ?? null,
    masterLogo: u.masterLogo ?? null,
    teamId: u.teamId ?? null,
    onTrial: u.onTrial ?? false,
    trialDaysLeft: u.trialDaysLeft ?? null,
    trialEndsAt: u.trialEndsAt ?? null,
    permissions: u.permissions ?? null,
  };
}

/** Autentica o usuário, persiste o token e atualiza o authStore (tratando loading/erro). */
export async function signIn(email: string, password: string): Promise<void> {
  const store = useAuthStore.getState();
  store.setLoading(true);
  store.setError(null);
  try {
    const data = await apiFetch<{ token: string; user: AuthUserResponse }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
    await tokenStorage.set(data.token);
    const u = mapUser(data.user);
    store.setUser(u);
    applyTenantTheme(u.theme);
  } catch (e: unknown) {
    store.setError(e instanceof Error ? e.message : 'Login failed');
    throw e;
  } finally {
    store.setLoading(false);
  }
}

/** Cria uma nova conta (POST /api/auth/register), persiste o token e atualiza o authStore. */
export async function signUp(email: string, password: string, displayName: string): Promise<void> {
  const store = useAuthStore.getState();
  store.setLoading(true);
  store.setError(null);
  try {
    const data = await apiFetch<{ token: string; user: AuthUserResponse }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, displayName }) }
    );
    await tokenStorage.set(data.token);
    const u = mapUser(data.user);
    store.setUser(u);
    applyTenantTheme(u.theme);
  } catch (e: unknown) {
    store.setError(e instanceof Error ? e.message : 'Falha no cadastro');
    throw e;
  } finally {
    store.setLoading(false);
  }
}

/** Limpa o token armazenado e o estado de autenticação. */
export async function signOut(): Promise<void> {
  await tokenStorage.clear();
  useAuthStore.getState().clearAuth();
}

/** Busca o usuário autenticado atual, retornando null em caso de falha. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const user = await apiFetch<AuthUserResponse>('/api/auth/me');
    return mapUser(user);
  } catch {
    return null;
  }
}

/** Switch active company and refresh token */
export async function switchCompany(companyId: string): Promise<void> {
  const store = useAuthStore.getState();
  const data = await apiFetch<{ token: string; activeCompanyId: string; company: { id: string; name: string }; user: AuthUserResponse }>(
    '/api/auth/switch-company',
    { method: 'POST', body: JSON.stringify({ companyId }) }
  );
  await tokenStorage.set(data.token);
  if (data.user) {
    const u = mapUser(data.user);
    store.setUser(u);
    applyTenantTheme(u.theme);
  } else {
    const user = await fetchCurrentUser();
    if (user) { store.setUser(user); applyTenantTheme(user.theme); }
  }
}

/** List companies the current user can access */
export async function listCompanies(): Promise<{ id: string; name: string; slug: string; plan: string; isActive: boolean }[]> {
  return apiFetch('/api/auth/companies');
}

/** Define (ou remove, com null) o logo da empresa ativa e recarrega o user → sidebar. */
export async function setCompanyLogo(companyId: string, logoUrl: string | null): Promise<void> {
  await apiFetch(`/api/companies/${companyId}/logo`, { method: 'PATCH', body: JSON.stringify({ logoUrl }) });
  const user = await fetchCurrentUser();
  if (user) useAuthStore.getState().setUser(user);
}

/** Define (ou reseta, com null) o tema (cores) da empresa ativa e aplica (recarrega a página). */
export async function setCompanyTheme(
  companyId: string,
  theme: { sidebarBg?: string; sidebarText?: string; primary?: string } | null,
): Promise<void> {
  const res = await apiFetch<{ ok: boolean; theme: typeof theme }>(
    `/api/companies/${companyId}/theme`, { method: 'PATCH', body: JSON.stringify({ theme }) });
  applyTenantTheme(res.theme ?? null);   // persiste + recarrega para regenerar os estilos
}

/** Update own profile (displayName, avatarUrl and/or password) */
export async function updateProfile(data: {
  displayName?: string;
  avatarUrl?: string | null;
  password?: string;
  currentPassword?: string;
}): Promise<void> {
  const user = await apiFetch<AuthUserResponse>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) });
  useAuthStore.getState().setUser(mapUser(user));
}
