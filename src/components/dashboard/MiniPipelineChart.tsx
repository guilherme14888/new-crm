import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DashboardMetrics, DealStage } from '../../types/models';
import { PIPELINE_STAGES } from '../../constants/pipeline';
import { formatCurrency } from '../../utils/currency';
import { COLORS, FONTS, SPACING } from '../../constants/theme';

interface Props {
  dealsByStage: DashboardMetrics['dealsByStage'];
}

export function MiniPipelineChart({ dealsByStage }: Props) {
  const activeStages = PIPELINE_STAGES.filter(
    (s) => s.key !== 'closed_lost'
  );
  const maxValue = Math.max(
    1,
    ...activeStages.map((s) => dealsByStage[s.key]?.value ?? 0)
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pipeline by Stage</Text>
      {activeStages.map((stage) => {
        const data = dealsByStage[stage.key] ?? { count: 0, value: 0 };
        const pct = data.value / maxValue;
        return (
          <View key={stage.key} style={styles.row}>
            <Text style={styles.stageLabel} numberOfLines={1}>{stage.label}</Text>
            <View style={styles.barContainer}>
              <View style={[styles.bar, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: stage.color }]} />
            </View>
            <Text style={styles.stageValue}>{data.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.md },
  title: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[800], marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  stageLabel: { width: 90, fontSize: FONTS.sm, color: COLORS.gray[600] },
  barContainer: { flex: 1, height: 16, backgroundColor: COLORS.gray[100], borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  stageValue: { width: 28, fontSize: FONTS.sm, color: COLORS.gray[700], textAlign: 'right' },
});
