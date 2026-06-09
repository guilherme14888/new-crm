import React, { useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useDealStore } from '../../../src/stores/dealStore';
import { useContactStore } from '../../../src/stores/contactStore';
import { useUIStore } from '../../../src/stores/uiStore';
import { useDeals } from '../../../src/hooks/useDeals';
import { KanbanColumn } from '../../../src/components/kanban/KanbanColumn';
import { KanbanDragProvider, useDragContext } from '../../../src/components/kanban/KanbanDragContext';
import { PIPELINE_STAGES } from '../../../src/constants/pipeline';
import { DealStage } from '../../../src/types/models';
import { COLORS, SPACING, FONTS } from '../../../src/constants/theme';

/** Quadro Kanban: renderiza uma coluna por etapa do pipeline com os negócios da etapa e cuida do arraste (drag) entre colunas. */
function KanbanBoard() {
  const { dealsByStage, deals } = useDeals();
  const contacts = useContactStore((s) => s.contacts);
  const openDeal = useUIStore((s) => s.openDeal);
  const { registerColumn, onDragStart, onDragMove, onDragEnd, dragTargetStage } = useDragContext();

  const contactNames = Object.fromEntries(
    contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`])
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      scrollEventThrottle={16}
    >
      {PIPELINE_STAGES.map((stage) => (
        <KanbanColumn
          key={stage.key}
          stage={stage as any}  /* config estática legada (StageConfig) — mantida como está */
          deals={dealsByStage[stage.key] ?? []}
          contactNames={contactNames}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDealPress={(id) => openDeal(id)}
          onLayout={registerColumn}
          isDragTarget={dragTargetStage === stage.key}
        />
      ))}
    </ScrollView>
  );
}

/** Tela do Kanban: carrega negócios/contatos, provê o contexto de arraste e exibe o quadro com um botão flutuante para novo negócio. */
export default function KanbanScreen() {
  const loadDeals = useDealStore((s) => s.loadDeals);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const deals = useDealStore((s) => s.deals);

  useEffect(() => {
    loadDeals();
    loadContacts();
  }, []);

  // Retorna o id do contato associado a um negócio (usado pelo contexto de arraste).
  const contactIdForDeal = useCallback(
    (dealId: string) => deals.find((d) => d.id === dealId)?.contactId ?? '',
    [deals]
  );

  return (
    <View style={styles.screen}>
      <KanbanDragProvider contactIdForDeal={contactIdForDeal}>
        <KanbanBoard />
      </KanbanDragProvider>
      <Pressable style={styles.fab} onPress={() => router.push('/(app)/deal/new')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
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
