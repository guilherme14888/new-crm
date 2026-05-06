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
  extra: {
    apiUrl: process.env.API_URL ?? 'http://localhost:3001',
    eas: { projectId: 'your-eas-project-id' },
  },
  plugins: ['expo-router', 'expo-secure-store'],
  scheme: 'crm-mobile',
});
