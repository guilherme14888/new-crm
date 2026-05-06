import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  return <Redirect href={user ? '/(app)/(tabs)/dashboard' : '/(auth)/login'} />;
}
