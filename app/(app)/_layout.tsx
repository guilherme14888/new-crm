import { Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Sidebar, HamburgerButton } from '../../src/components/layout/Sidebar';
import { DealModal } from '../../src/components/deal/DealModal';
import { COLORS } from '../../src/constants/theme';

/** Barra superior mobile: renderiza o botão hambúrguer apenas em telas estreitas (largura < 768). */
function MobileTopBar() {
  if (typeof window === 'undefined' || window.innerWidth >= 768) return null;
  return (
    <View style={styles.mobileTopBar}>
      <HamburgerButton />
    </View>
  );
}

/** Layout web da área autenticada: renderiza a sidebar lateral, a barra superior mobile, o conteúdo (Stack) e o modal de negócio. */
function WebLayout() {
  return (
    <View style={styles.container}>
      <Sidebar />
      <View style={styles.main}>
        <MobileTopBar />
        <View style={styles.content}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
      <DealModal />
    </View>
  );
}

/** Layout mobile da área autenticada: define o Stack de navegação com as telas do app e o modal de negócio. */
function MobileLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deal/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="deal/new" options={{ presentation: 'modal', title: 'New Deal' }} />
        <Stack.Screen name="reports" options={{ headerShown: false }} />
        <Stack.Screen name="boletim" options={{ headerShown: false }} />
        <Stack.Screen name="finance" options={{ title: 'Financeiro' }} />
        <Stack.Screen name="funnels" options={{ headerShown: false }} />
        <Stack.Screen name="admin/users" options={{ title: 'Usuários' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
      <DealModal />
    </>
  );
}

/** Layout principal protegido: aguarda a restauração da sessão, redireciona ao login se não houver usuário e escolhe entre layout web ou mobile. */
export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Wait for restoreSession() to finish before deciding to redirect
  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Block any direct access to authenticated routes — push to login
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return Platform.OS === 'web' ? <WebLayout /> : <MobileLayout />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
  },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[50],
  },
});
