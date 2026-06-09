import { Redirect } from 'expo-router';

/** Rota base de Inteligência de Mercado: redireciona para o Dashboard. */
export default function MarketIntelligenceIndex() {
  return <Redirect href="/(app)/market-intelligence/dashboard" />;
}
