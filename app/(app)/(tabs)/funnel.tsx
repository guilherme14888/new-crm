import React, { useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useDealStore } from '../../../src/stores/dealStore';
import { useContactStore } from '../../../src/stores/contactStore';
import { useDeals } from '../../../src/hooks/useDeals';
import { FunnelStage } from '../../../src/components/funnel/FunnelStage';
import { FunnelSummaryBar } from '../../../src/components/funnel/FunnelSummaryBar';
import { PIPELINE_STAGES } from '../../../src/constants/pipeline';
import { COLORS, FONTS, SPACING } from '../../../src/constants/theme';

export default function FunnelScreen() {
  const loadDeals = useDealStore((s) => s.loadDeals);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const contacts = useContactStore((s) => s.contacts);
  const { dealsByStage, deals } = useDeals();

  useEffect(() => {
    loadDeals();
    loadContacts();
  }, []);

  const contactNames = Object.fromEntries(
    contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`])
  );

  const totalValue = deals
    .filter((d) => d.stage !== 'closed_lost')
    .reduce((sum, d) => sum + d.value, 0);

  const activeDeals = deals.filter((d) => !d.deletedAt).length;

  return (
    <View style={styles.screen}>
      <FunnelSummaryBar totalValue={totalValue} totalDeals={activeDeals} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        snapToInterval={undefined}
        decelerationRate="fast"
      >
        {PIPELINE_STAGES.map((stage) => (
          <FunnelStage
            key={stage.key}
            stage={stage}
            deals={dealsByStage[stage.key] ?? []}
            contactNames={contactNames}
            onDealPress={(id) => router.push(`/(app)/deal/${id}`)}
          />
        ))}
      </ScrollView>
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(app)/deal/new')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  scroll: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: COLORS.white, fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
