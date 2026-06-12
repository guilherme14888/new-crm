import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = 3001;

/** Resolve a URL base da API conforme a plataforma (override de config, host web ou host de dev nativo). */
function resolveApiUrl(): string {
  // 0) Same-origin mode (produção atrás do Traefik): API_URL='' faz o app chamar
  //    a API na MESMA origem que serviu a página — ex.: https://sistema.br4licitacoes.com/api/...
  //    O Node serve o web estático e a API no mesmo domínio, então não há host/porta a prefixar.
  const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromConfig === '') return '';

  // 1) Explicit override always wins (set via API_URL env var → app.config.ts)
  if (fromConfig && fromConfig !== 'http://localhost:3001') return fromConfig;

  // 2) On web, derive from the host that actually loaded the page so
  //    accessing from a phone via the dev machine's LAN IP also works.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:${API_PORT}`;
  }

  // 3) Fallback for native dev: try the host-uri Expo gives us
  //    (e.g. "192.168.1.10:8081"). On a built native app this won't be set
  //    and the explicit override should be used instead.
  const hostUri = (Constants.expoConfig as any)?.hostUri
    ?? (Constants as any)?.expoGoConfig?.hostUri
    ?? (Constants as any)?.manifest2?.extra?.expoGo?.developer?.host
    ?? (Constants as any)?.manifest?.debuggerHost
    ?? '';
  const host = String(hostUri).split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  return fromConfig ?? 'http://localhost:3001';
}

const API_URL = resolveApiUrl();
const TOKEN_KEY = 'crm_token';

// In-memory cache so apiFetch is synchronous after init
let _token: string | null = null;

/** Armazenamento do token de autenticação (localStorage na web, SecureStore no nativo) com cache em memória. */
export const tokenStorage = {
  /** Carrega o token persistido para o cache em memória. */
  init: async (): Promise<void> => {
    if (Platform.OS === 'web') {
      _token = localStorage.getItem(TOKEN_KEY);
    } else {
      const SecureStore = await import('expo-secure-store');
      _token = await SecureStore.getItemAsync(TOKEN_KEY);
    }
  },
  /** Retorna o token atual em cache (síncrono). */
  get: () => _token,
  /** Persiste e armazena em cache o token de autenticação. */
  set: async (token: string): Promise<void> => {
    _token = token;
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  },
  /** Remove o token do cache e do armazenamento persistente. */
  clear: async (): Promise<void> => {
    _token = null;
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  },
};

/** Faz uma requisição HTTP à API com headers JSON e token Bearer, lançando erro em respostas não-ok. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined ?? {}),
  };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Baixa um recurso binário (ex.: PDF) com o token Bearer e retorna um Blob. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.blob();
}
