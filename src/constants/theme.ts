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
  full: 9999,// Totalmente circular (para avatares)
};
