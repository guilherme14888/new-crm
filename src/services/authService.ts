import { useAuthStore } from '../stores/authStore';
import { apiFetch, tokenStorage } from './api';
import { User } from '../types/models';

type AuthUserResponse = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: User['role'];
  companyId: string;
  companyName: string | null;
  teamId: string | null;
};

function mapUser(u: AuthUserResponse): User {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    companyId: u.companyId,
    companyName: u.companyName ?? null,
    teamId: u.teamId ?? null,
  };
}

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
    store.setUser(mapUser(data.user));
  } catch (e: unknown) {
    store.setError(e instanceof Error ? e.message : 'Login failed');
    throw e;
  } finally {
    store.setLoading(false);
  }
}

export async function signOut(): Promise<void> {
  await tokenStorage.clear();
  useAuthStore.getState().clearAuth();
}

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
    store.setUser(mapUser(data.user));
  } else {
    const user = await fetchCurrentUser();
    if (user) store.setUser(user);
  }
}

/** List companies the current user can access */
export async function listCompanies(): Promise<{ id: string; name: string; slug: string; plan: string; isActive: boolean }[]> {
  return apiFetch('/api/auth/companies');
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
