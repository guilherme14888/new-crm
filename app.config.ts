import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CRM Mobile',
  slug: 'crm-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: { supportsTablet: false, bundleIdentifier: 'com.crmobile.app' },
  android: { adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#ffffff' }, package: 'com.crmobile.app' },
  // SPA: um único index.html com roteamento no cliente — o backend serve o
  // estático e faz fallback para index.html (ver backend/src/app.js).
  web: { ...(config.web as any), output: 'single', bundler: 'metro' },
  extra: {
    // API_URL='' (string vazia) ⇒ modo same-origin: o app chama /api no mesmo
    // domínio que o serviu (produção atrás do Traefik). Sem a env, usa localhost:3001 (dev).
    apiUrl: process.env.API_URL ?? 'http://localhost:3001',
    eas: { projectId: 'your-eas-project-id' },
  },
  plugins: ['expo-router', 'expo-secure-store'],
  scheme: 'crm-mobile',
});
