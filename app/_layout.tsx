import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useUIStore } from '../src/stores/uiStore';
import { useFunnelStore } from '../src/stores/funnelStore';
import { useCRMUserStore } from '../src/stores/crmUserStore';
import { getDatabase } from '../src/db/migrations';
import { COLORS, FONTS, SPACING, RADIUS } from '../src/constants/theme';

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const user = useAuthStore((s) => s.user);
  const toast = useUIStore((s) => s.toastMessage);
  const loadFunnels = useFunnelStore((s) => s.loadFunnels);
  const loadWinLossReasons = useFunnelStore((s) => s.loadWinLossReasons);
  const loadUsers = useCRMUserStore((s) => s.loadUsers);

  // Initial boot: init SQLite on mobile, then restore session
  useEffect(() => {
    const init = async () => {
      if (Platform.OS !== 'web') await getDatabase();
      await restoreSession();
    };
    init();
  }, []);

  // Reload all shared data whenever auth state changes to logged-in
  useEffect(() => {
    if (!user) return;
    Promise.all([loadFunnels(), loadWinLossReasons(), loadUsers()]);
  }, [user?.id]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
        {toast && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 80,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: COLORS.gray[800],
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  toastText: { color: COLORS.white, fontSize: FONTS.base },
});
