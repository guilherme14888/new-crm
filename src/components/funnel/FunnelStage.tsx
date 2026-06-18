import React, { useState, useRef, useEffect } from 'react';
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

  // Renderização incremental: 10 cartões e +10 ao rolar perto do fim.
  const STEP = 10;
  const [visible, setVisible] = useState(STEP);
  const prevLen = useRef(deals.length);
  useEffect(() => {
    if (deals.length < visible) setVisible(Math.max(STEP, deals.length));
    prevLen.current = deals.length;
  }, [deals.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = deals.slice(0, visible);
  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 160) {
      setVisible((v) => (v < deals.length ? Math.min(v + STEP, deals.length) : v));
    }
  };

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
        data={shown}
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={11}
        ListEmptyComponent={<Text style={styles.empty}>No deals</Text>}
        ListFooterComponent={visible < deals.length ? (
          <Text style={styles.more}>Carregando… ({visible}/{deals.length})</Text>
        ) : null}
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
  more: { textAlign: 'center', color: COLORS.gray[400], paddingVertical: SPACING.sm, fontSize: FONTS.sm },
  empty: { textAlign: 'center', color: COLORS.gray[400], paddingVertical: SPACING.xl, fontSize: FONTS.sm },
});
