import React, { useRef } from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions, Platform } from 'react-native';
import { Deal } from '../../types/models';
import { FunnelStage } from '../../types/models';
import { formatCurrency } from '../../utils/currency';
import { KanbanCard } from './KanbanCard';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const COLUMN_WIDTH = Platform.OS === 'web'
  ? 280
  : Dimensions.get('window').width * 0.72;

interface ColumnBounds {
  x: number;
  width: number;
  stageId: string;
  getLiveBounds?: () => { x: number; width: number } | null;
}

interface Props {
  stage: FunnelStage;
  deals: Deal[];
  contactNames: Record<string, string>;
  onDragStart: (dealId: string, absX: number, absY: number, localX: number, localY: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (dealId: string, x: number, y: number) => void;
  onDealPress: (dealId: string) => void;
  onLayout: (bounds: ColumnBounds) => void;
  isDragTarget: boolean;
}

/** Coluna de uma etapa do funil no Kanban: cabeçalho com total, contador e lista de cartões; reporta seus limites para o drag-and-drop. */
export function KanbanColumn({
  stage,
  deals,
  contactNames,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDealPress,
  onLayout,
  isDragTarget,
}: Props) {
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  const typeIcon = stage.type === 'won' ? '✓' : stage.type === 'lost' ? '✗' : '';

  const colRef = useRef<View>(null);
  // Retorna os limites atuais (x e largura) da coluna na web via getBoundingClientRect; null em outras plataformas.
  const getLiveBounds = (): { x: number; width: number } | null => {
    if (Platform.OS !== 'web') return null;
    const el = colRef.current as any;
    if (!el?.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, width: r.width };
  };

  return (
    <View
      ref={colRef}
      style={[styles.column, isDragTarget && styles.dragTarget, { borderTopColor: stage.color }]}
      onLayout={(e) => {
        if (Platform.OS === 'web') {
          const live = getLiveBounds();
          if (live) {
            onLayout({ x: live.x, width: live.width, stageId: stage.id, getLiveBounds });
          } else {
            const { width, x } = e.nativeEvent.layout;
            onLayout({ x, width, stageId: stage.id, getLiveBounds });
          }
        } else {
          (e.target as any).measure((_x: number, _y: number, width: number, _h: number, pageX: number) => {
            onLayout({ x: pageX, width, stageId: stage.id });
          });
        }
      }}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: stage.color }]} />
        <Text style={styles.stageName} numberOfLines={1}>
          {stage.name}{typeIcon ? ` ${typeIcon}` : ''}
        </Text>
        <Text style={styles.count}>{deals.length}</Text>
      </View>
      <Text style={styles.total}>{formatCurrency(totalValue)}</Text>
      {/* FlatList virtualiza: renderiza ~10 cartões e vai carregando de 10 em 10
          conforme rola (sem travar quando a coluna tem centenas de cartões). */}
      <FlatList
        data={deals}
        keyExtractor={(d) => d.id}
        renderItem={({ item: deal }) => (
          <KanbanCard
            deal={deal}
            contactName={contactNames[deal.contactId] ?? '—'}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onPress={() => onDealPress(deal.id)}
          />
        )}
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={30}
        windowSize={11}
        removeClippedSubviews={false}
        ListEmptyComponent={<Text style={styles.empty}>Solte aqui</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: COLUMN_WIDTH,
    marginRight: SPACING.md,
    borderTopWidth: 3,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray[50],
    overflow: 'hidden',
  },
  dragTarget: {
    backgroundColor: '#eff6ff',
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderTopWidth: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.white,
    gap: SPACING.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stageName: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[800], flex: 1 },
  count: {
    backgroundColor: COLORS.gray[200],
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    fontSize: FONTS.sm,
    color: COLORS.gray[700],
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  total: {
    fontSize: FONTS.sm,
    color: COLORS.gray[500],
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  scroll: {
    flex: 1,
    maxHeight: Platform.OS === 'web' ? 600 : 480,
    ...(Platform.OS === 'web' ? {
      scrollbarWidth: 'thin' as any,
      scrollbarColor: `${COLORS.gray[300]} transparent` as any,
    } : {}),
  },
  list: { padding: SPACING.sm, paddingBottom: SPACING.xl },
  empty: {
    textAlign: 'center',
    color: COLORS.gray[300],
    paddingVertical: SPACING.xl,
    fontSize: FONTS.sm,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    margin: SPACING.sm,
  },
});
