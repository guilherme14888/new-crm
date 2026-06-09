import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../../utils/currency';
import { COLORS, FONTS, SPACING } from '../../constants/theme';

interface Props {
  totalValue: number;
  totalDeals: number;
}

/** Barra de resumo do funil que exibe o valor total do pipeline e a quantidade de negócios ativos. */
export function FunnelSummaryBar({ totalValue, totalDeals }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.item}>
        <Text style={styles.value}>{formatCurrency(totalValue)}</Text>
        <Text style={styles.label}>Pipeline Value</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <Text style={styles.value}>{totalDeals}</Text>
        <Text style={styles.label}>Active Deals</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  item: { flex: 1, alignItems: 'center' },
  value: { fontSize: FONTS['2xl'], fontWeight: '700', color: COLORS.gray[900] },
  label: { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  divider: { width: 1, backgroundColor: COLORS.gray[200], marginVertical: SPACING.xs },
});
