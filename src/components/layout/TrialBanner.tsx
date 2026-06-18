import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { FONTS, SPACING } from '../../constants/theme';

/**
 * Linha vermelha permanente com a contagem regressiva do período de teste.
 * Aparece em todo o app enquanto o tenant ativo estiver em teste; some ao
 * encerrar (a partir daí o login dos não-admin é bloqueado no backend).
 */
export function TrialBanner() {
  const user = useAuthStore((s) => s.user);
  const days = user?.trialDaysLeft;
  if (!user?.onTrial || days == null) return null;

  const label = days <= 0 ? 'menos de 1 dia' : days === 1 ? '1 dia' : `${days} dias`;
  return (
    <View style={s.bar}>
      <Text style={s.txt} numberOfLines={1}>
        ⏳  Período de teste — faltam {label} para o término. Ao acabar, o acesso será bloqueado. Entre em contato com o setor financeiro.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#dc2626', paddingVertical: 6, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#ffffff', fontWeight: '700', fontSize: FONTS.sm, textAlign: 'center' },
});
