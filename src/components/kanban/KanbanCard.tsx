import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Deal } from '../../types/models';
import { formatCurrency } from '../../utils/currency';
import { useUIStore } from '../../stores/uiStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  deal: Deal;
  contactName: string;
  onDragStart?: (dealId: string, absX: number, absY: number, localX: number, localY: number) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (dealId: string, x: number, y: number) => void;
  onPress?: () => void;
  isFloating?: boolean;
}

/** Cartão de negociação do Kanban: exibe título, valor, contato e empresa, com gestos de arrastar e tocar. */
export function KanbanCard({
  deal,
  contactName,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
  isFloating = false,
}: Props) {
  const scale = useSharedValue(isFloating ? 1.05 : 1);
  const dragDealId = useUIStore((s) => s.dragDealId);
  const isGhost = !isFloating && dragDealId === deal.id;
  const isWon  = deal.stage === 'closed_won';
  const isLost = deal.stage === 'closed_lost';

  const pan = Gesture.Pan()
    .enabled(!isFloating)
    .minDistance(8)
    .onStart((e: { absoluteX: number; absoluteY: number; x: number; y: number }) => {
      scale.value = withSpring(1.05);
      onDragStart?.(deal.id, e.absoluteX, e.absoluteY, e.x, e.y);
    })
    .onUpdate((e: { absoluteX: number; absoluteY: number }) => {
      onDragMove?.(e.absoluteX, e.absoluteY);
    })
    .onEnd((e: { absoluteX: number; absoluteY: number }) => {
      scale.value = withSpring(1);
      onDragEnd?.(deal.id, e.absoluteX, e.absoluteY);
    });

  const tap = Gesture.Tap()
    .enabled(!isFloating)
    .onEnd(() => {
      if (!dragDealId) onPress?.();
    });

  const composed = Gesture.Simultaneous(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isFloating ? 1.05 : scale.value }],
    opacity: isGhost ? 0.25 : 1,
    shadowOpacity: isFloating ? 0.22 : (isGhost ? 0.02 : 0.06),
    elevation: isFloating ? 14 : (isGhost ? 0 : 2),
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[
        styles.card,
        animStyle,
        isFloating && styles.floatingShadow,
        isWon  && styles.wonCard,
        isLost && styles.lostCard,
      ]}>
        {isWon  && <Text style={styles.statusBadge}>✓ Ganho</Text>}
        {isLost && <Text style={[styles.statusBadge, styles.lostBadge]}>✗ Perdido</Text>}
        <Text style={styles.title} numberOfLines={2}>{deal.title}</Text>
        <Text style={[styles.value, isWon && styles.wonValue]}>{formatCurrency(deal.value)}</Text>
        <Text style={styles.contact} numberOfLines={1}>{contactName}</Text>
        {deal.companyName ? (
          <Text style={styles.companyTag} numberOfLines={1}>{deal.companyName}</Text>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  floatingShadow: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  title: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[900], marginBottom: 4 },
  value: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  contact: { fontSize: FONTS.sm, color: COLORS.gray[500] },
  wonCard:  { backgroundColor: '#f0fdf4', borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  lostCard: { backgroundColor: '#fef2f2', borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  wonValue: { color: '#16a34a' },
  statusBadge: {
    fontSize: 10, fontWeight: '700', color: '#16a34a',
    backgroundColor: '#dcfce7', alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 6,
  },
  lostBadge: { color: '#ef4444', backgroundColor: '#fee2e2' },
  companyTag: {
    fontSize: 10, fontWeight: '600', color: '#6366f1',
    backgroundColor: '#eef2ff', alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 6,
  },
});
