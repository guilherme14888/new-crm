import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

/** Rota inicial: redireciona para o dashboard se houver usuário logado ou para a tela de login caso contrário. */
export default function Index() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  return <Redirect href={user ? '/(app)/(tabs)/dashboard' : '/(auth)/login'} />;
}
