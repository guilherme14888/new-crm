/** Paleta de cores do aplicativo — tons de azul como principal, com estados danger/success/warning */
export const COLORS = {
  primary: '#3b82f6',        // Azul primário
  primaryDark: '#1d4ed8',    // Azul primário escuro para hover
  danger: '#ef4444',         // Vermelho para erros e ações perigosas
  success: '#16a34a',        // Verde para sucesso
  warning: '#f59e0b',        // Âmbar para avisos
  gray: {
    50: '#f8fafc',           // Cinza muito claro (backgrounds)
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',          // Cinza muito escuro (textos)
  },
  white: '#ffffff',
  black: '#000000',
};

/** Tamanhos de fonte em pixels — escala tipográfica baseada em Tailwind */
export const FONTS = {
  xs: 10,    // Muito pequeno (badges, dicas)
  sm: 12,    // Pequeno
  base: 14,  // Padrão
  lg: 16,    // Grande
  xl: 18,    // Extra grande
  '2xl': 22, // 2x extra grande
  '3xl': 28, // 3x extra grande
};

/** Espaçamento interno/externo em pixels — segue escala 4px base */
export const SPACING = {
  xs: 4,     // Extra pequeno
  sm: 8,     // Pequeno
  md: 12,    // Médio
  lg: 16,    // Grande
  xl: 24,    // Extra grande
  '2xl': 32, // 2x extra grande
};

/** Raio de borda em pixels — para criar cantos arredondados */
export const RADIUS = {
  sm: 4,     // Levemente arredondado
  md: 8,     // Arredondado padrão
  lg: 12,    // Muito arredondado
  xl: 16,    // Extra arredondado (cards/modais)
  full: 9999,// Totalmente circular (para avatares)
};

// ─── Tema customizável por tenant ─────────────────────────────────────────────
// Cores que cada tenant pode personalizar. São lidas SINCRONAMENTE do localStorage
// (web) no carregamento deste módulo — ANTES de qualquer StyleSheet.create — então a
// UI já nasce com as cores do tenant. O `primary` é injetado na paleta global COLORS,
// afetando botões/realces do sistema inteiro. Trocar o tema grava no localStorage e
// recarrega a página (os StyleSheets são gerados uma única vez, no load).
export type ThemeColors = { sidebarBg?: string; sidebarText?: string; primary?: string };

const THEME_KEY = 'ui_theme_v1';
export const THEME_DEFAULTS = {
  sidebarBg:   COLORS.gray[900],
  sidebarText: COLORS.white,
  primary:     COLORS.primary,
};

function withAlpha(hex: string, a: number): string {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r},${g},${b},${a})`;
}

function readStoredTheme(): ThemeColors {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(THEME_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch { return {}; }
}

const _stored = readStoredTheme();

// Injeta o primary do tenant na paleta global → realça o sistema inteiro com a marca.
if (_stored.primary) {
  COLORS.primary = _stored.primary;
  COLORS.primaryDark = _stored.primary;
}

const _sbBg   = _stored.sidebarBg   || THEME_DEFAULTS.sidebarBg;
const _sbText = _stored.sidebarText || THEME_DEFAULTS.sidebarText;

/** Tema EFETIVO (defaults + override do tenant) usado pela sidebar e componentes temáticos. */
export const THEME = {
  sidebarBg:        _sbBg,
  sidebarText:      _sbText,
  primary:          _stored.primary || THEME_DEFAULTS.primary,
  sidebarTextDim:   withAlpha(_sbText, 0.72),  // texto secundário da sidebar
  sidebarTextFaint: withAlpha(_sbText, 0.5),   // texto terciário (e-mail, captions)
  sidebarBorder:    withAlpha(_sbText, 0.14),  // divisórias/bordas (adapta ao fundo)
  sidebarHover:     withAlpha(_sbText, 0.08),  // realce sutil (hover, dropdown)
};

/** Grava o tema do tenant no localStorage. Retorna true se MUDOU (precisa recarregar). */
export function persistTheme(theme: ThemeColors | null): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const next = JSON.stringify(theme || {});
    const cur = localStorage.getItem(THEME_KEY) || '{}';
    if (next === cur) return false;
    localStorage.setItem(THEME_KEY, next);
    return true;
  } catch { return false; }
}

/** Aplica o tema do tenant (login/troca de empresa): persiste e recarrega se mudou. */
export function applyTenantTheme(theme: ThemeColors | null | undefined): void {
  if (theme === undefined) return;               // backend antigo sem tema → não mexe
  const changed = persistTheme(theme);
  if (changed && typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
    window.location.reload();
  }
}
