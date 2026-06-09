import React from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Deal } from '../../types/models';
import { StageConfig } from '../../types/models';
import { formatCurrency } from '../../utils/currency';
import { FunnelDealCard } from './FunnelDealCard';
import { COLORS, FONTS, SPACING } from '../../constants/theme';

const COLUMN_WIDTH = Dimensions.get('window').width * 0.82;

interface Props {
  stage: StageConfig;
  deals: Deal[];
  contactNames: Record<string, string>;
  onDealPress: (dealId: string) => void;
}

/** Coluna de um estágio do funil que exibe cabeçalho (nome, contagem e valor total) e a lista de cartões de negócios do estágio. */
export function FunnelStage({ stage, deals, contactNames, onDealPress }: Props) {
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <View style={[styles.column, { borderTopColor: stage.color }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.stageName} numberOfLines={1}>{stage.label}</Text>
          <View style={[styles.dot, { backgroundColor: stage.color }]} />
          <Text style={styles.count}>{deals.length}</Text>
        </View>
        <Text style={styles.total}>{formatCurrency(totalValue)}</Text>
      </View>
      <FlatList
        data={deals}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <FunnelDealCard
            deal={item}
            contactName={contactNames[item.contactId] ?? '—'}
            onPress={() => onDealPress(item.id)}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No deals</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: COLUMN_WIDTH,
    marginRight: SPACING.md,
    borderTopWidth: 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.gray[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flex: 1 },
  stageName: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[800], flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  count: { fontSize: FONTS.sm, color: COLORS.gray[500] },
  total: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700] },
  list: { padding: SPACING.sm, paddingBottom: SPACING.xl },
  empty: { textAlign: 'center', color: COLORS.gray[400], paddingVertical: SPACING.xl, fontSize: FONTS.sm },
});
