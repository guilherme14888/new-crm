import { Stack } from 'expo-router';

/** Layout da seção de Inteligência de Mercado: Stack das telas (Dashboard, Listagem) sem header. */
export default function MarketIntelligenceLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
