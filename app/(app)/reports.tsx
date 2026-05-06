import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../src/constants/theme';

export default function ReportsScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Relatórios</Text>
        <Text style={styles.sub}>Em breve — análises e métricas do seu CRM</Text>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text style={styles.emptyTitle}>Relatórios em desenvolvimento</Text>
        <Text style={styles.emptyDesc}>Aqui você poderá visualizar relatórios de desempenho, funil de vendas, atividades da equipe e muito mais.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  title: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  sub:   { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon:  { fontSize: 56, marginBottom: SPACING.lg },
  emptyTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[700], marginBottom: SPACING.sm, textAlign: 'center' },
  emptyDesc:  { fontSize: FONTS.base, color: COLORS.gray[400], textAlign: 'center', lineHeight: 24, maxWidth: 400 },
});
