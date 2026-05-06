import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../../constants/theme';

export function DealProposalsTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📄</Text>
      <Text style={styles.title}>Propostas</Text>
      <Text style={styles.sub}>Gere propostas profissionais em PDF com template personalizável e envie diretamente por e-mail.</Text>
      <Text style={styles.badge}>Em breve</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48, marginBottom: SPACING.md },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[800], marginBottom: SPACING.sm },
  sub: { fontSize: FONTS.base, color: COLORS.gray[500], textAlign: 'center', maxWidth: 320, marginBottom: SPACING.lg, lineHeight: 22 },
  badge: {
    paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#eff6ff',
    borderRadius: 20, color: COLORS.primary, fontSize: FONTS.sm, fontWeight: '700',
  },
});
