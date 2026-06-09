import { Stack } from 'expo-router';

/** Layout da seção de funis: renderiza o Stack de navegação das telas de funis sem header. */
export default function FunnelsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
