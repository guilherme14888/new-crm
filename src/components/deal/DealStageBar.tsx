import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Deal } from '../../types/models';
import { useFunnelStore } from '../../stores/funnelStore';
import { useDealStore } from '../../stores/dealStore';
import { COLORS, FONTS, SPACING } from '../../constants/theme';

interface Props {
  deal: Deal;
}

export function DealStageBar({ deal }: Props) {
  const funnels = useFunnelStore((s) => s.funnels);
  const moveDeal = useDealStore((s) => s.moveDeal);

  const funnel = funnels.find((f) => f.id === deal.funnelId);
  const stages = funnel?.stages ?? [];
  const currentIdx = stages.findIndex((s) => s.id === deal.stageId);

  const handleStagePress = async (stageId: string, idx: number) => {
    if (stageId === deal.stageId) return;
    await moveDeal(deal.id, deal.stage, idx, deal.contactId, stageId);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container} contentContainerStyle={styles.content}>
      {stages.map((stage, idx) => {
        const isCurrent = stage.id === deal.stageId;
        const isPast = idx < currentIdx;
        return (
          <Pressable key={stage.id} style={styles.stageWrapper} onPress={() => handleStagePress(stage.id, idx)}>
            <View style={[
              styles.stage,
              isPast && styles.stagePast,
              isCurrent && { backgroundColor: stage.color },
            ]}>
              <Text style={[
                styles.stageText,
                isPast && styles.stageTextPast,
                isCurrent && styles.stageTextCurrent,
              ]} numberOfLines={1}>
                {stage.name}
              </Text>
            </View>
            {idx < stages.length - 1 && (
              <View style={[styles.arrow, isPast && { borderLeftColor: stage.color }]} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  content: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 2 },
  stageWrapper: { flexDirection: 'row', alignItems: 'center' },
  stage: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.gray[100], borderRadius: 4, minWidth: 80, alignItems: 'center',
  },
  stagePast: { backgroundColor: '#e0f2fe' },
  stageText: { fontSize: FONTS.xs, fontWeight: '600', color: COLORS.gray[500] },
  stageTextPast: { color: '#0369a1' },
  stageTextCurrent: { color: COLORS.white },
  arrow: {
    width: 0, height: 0,
    borderTopWidth: 16, borderBottomWidth: 16, borderLeftWidth: 10,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: COLORS.gray[100],
  },
});
