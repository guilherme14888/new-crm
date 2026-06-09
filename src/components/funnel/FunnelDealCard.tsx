import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Deal } from '../../types/models';
import { formatCurrency } from '../../utils/currency';
import { formatDate, daysAgo } from '../../utils/date';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { Card } from '../ui/Card';

interface Props {
  deal: Deal;
  contactName: string;
  onPress: () => void;
}

/** Cartão de negócio no funil que mostra título, valor, contato, empresa e prazos, com destaque visual para ganho/perdido. */
export function FunnelDealCard({ deal, contactName, onPress }: Props) {
  const days  = daysAgo(deal.createdAt);
  const isWon = deal.stage === 'closed_won';
  const isLost = deal.stage === 'closed_lost';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Card style={[styles.card, isWon && styles.wonCard, isLost && styles.lostCard]}>
        {isWon  && <Text style={styles.wonBadge}>✓ Ganho</Text>}
        {isLost && <Text style={[styles.wonBadge, styles.lostBadge]}>✗ Perdido</Text>}
        <Text style={styles.title} numberOfLines={2}>{deal.title}</Text>
        <Text style={[styles.value, isWon && styles.wonValue]}>{formatCurrency(deal.value)}</Text>
        <Text style={styles.contact} numberOfLines={1}>{contactName}</Text>
        {deal.companyName ? (
          <Text style={styles.companyTag} numberOfLines={1}>{deal.companyName}</Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.meta}>{days}d ago</Text>
          {deal.expectedCloseDate && (
            <Text style={styles.meta}>Close: {formatDate(deal.expectedCloseDate)}</Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.sm, marginHorizontal: SPACING.sm },
  wonCard:  { backgroundColor: '#f0fdf4', borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  lostCard: { backgroundColor: '#fef2f2', borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  wonBadge: {
    fontSize: 10, fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7',
    alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 6,
  },
  lostBadge: { color: '#ef4444', backgroundColor: '#fee2e2' },
  title: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900], marginBottom: 4 },
  value: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  wonValue: { color: '#16a34a' },
  contact: { fontSize: FONTS.sm, color: COLORS.gray[500], marginBottom: SPACING.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: FONTS.sm, color: COLORS.gray[400] },
  companyTag: {
    fontSize: 10, fontWeight: '600', color: '#6366f1',
    backgroundColor: '#eef2ff', alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: SPACING.sm,
  },
});
