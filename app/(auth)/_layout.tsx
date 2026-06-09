import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS } from '../../src/constants/theme';

/** Layout das telas de autenticação: exibe loader durante o carregamento, redireciona usuários já logados ao dashboard e renderiza o Stack sem header. */
export default function AuthLayout() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(app)/(tabs)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[50],
  },
});
