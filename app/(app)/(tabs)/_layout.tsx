import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { COLORS } from '../../../src/constants/theme';

/** Ícone da barra de abas: renderiza um emoji, aumentando o tamanho quando a aba está em foco. */
function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: focused ? 22 : 18 }}>{emoji}</Text>;
}

const isWeb = Platform.OS === 'web';

/** Layout das abas: define as abas visíveis (Dashboard, Órgãos, Licitações) e oculta as rotas legadas de funil e kanban. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray[400],
        tabBarStyle: isWeb ? { display: 'none' } : { borderTopColor: COLORS.gray[100] },
        headerShown: !isWeb,
        headerStyle: { backgroundColor: COLORS.white },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <Icon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Órgãos',
          tabBarIcon: ({ focused }) => <Icon emoji="👥" focused={focused} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="negotiations"
        options={{
          title: 'Licitações',
          tabBarIcon: ({ focused }) => <Icon emoji="🤝" focused={focused} />,
          headerShown: false,
        }}
      />
      {/* Hide old funnel and kanban tabs — kept as files for route compat but hidden */}
      <Tabs.Screen name="funnel" options={{ href: null }} />
      <Tabs.Screen name="kanban" options={{ href: null }} />
    </Tabs>
  );
}
