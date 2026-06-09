import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Deal } from '../../types/models';
import { useFunnelStore } from '../../stores/funnelStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

// Calcula quantos dias inteiros se passaram desde a data informada (0 se nula).
function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

interface Props {
  deal: Deal;
}

/** Linha de etiquetas da negociação: badges de "nova", funil, dias de esfriamento (com cor por limite) e início das observações. */
export function DealTagRow({ deal }: Props) {
  const funnels = useFunnelStore((s) => s.funnels);
  const { warningDays, dangerDays } = useSettingsStore((s) => s.coolingThresholds);

  const funnel = funnels.find((f) => f.id === deal.funnelId);
  const isNew = daysSince(deal.createdAt) < 7;
  const coolingDays = daysSince(deal.stageChangedAt || deal.updatedAt);

  let coolingColor = COLORS.gray[500];
  let coolingBg = COLORS.gray[100];
  if (coolingDays >= dangerDays) { coolingColor = '#ef4444'; coolingBg = '#fef2f2'; }
  else if (coolingDays >= warningDays) { coolingColor = '#f59e0b'; coolingBg = '#fffbeb'; }
  else { coolingColor = '#16a34a'; coolingBg = '#f0fdf4'; }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container} contentContainerStyle={styles.content}>
      {isNew && (
        <View style={[styles.badge, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.badgeText, { color: '#3b82f6' }]}>NOVA</Text>
        </View>
      )}
      {funnel && (
        <View style={[styles.badge, { backgroundColor: COLORS.gray[100] }]}>
          <Text style={[styles.badgeText, { color: COLORS.gray[700] }]}>{funnel.name}</Text>
        </View>
      )}
      <View style={[styles.badge, { backgroundColor: coolingBg }]}>
        <Text style={[styles.badgeText, { color: coolingColor }]}>
          {coolingDays === 0 ? 'Hoje' : `ESFRIANDO HÁ ${coolingDays} DIA${coolingDays !== 1 ? 'S' : ''}`}
        </Text>
      </View>
      {deal.notes && (
        <View style={[styles.badge, { backgroundColor: '#f5f3ff' }]}>
          <Text style={[styles.badgeText, { color: '#7c3aed' }]} numberOfLines={1}>
            {deal.notes.split('\n')[0].substring(0, 30)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  content: { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm },
  badge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.full, flexDirection: 'row', alignItems: 'center',
  },
  badgeText: { fontSize: FONTS.xs, fontWeight: '700', letterSpacing: 0.3 },
});
