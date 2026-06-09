import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Deal } from '../../types/models';
import { useDealStore } from '../../stores/dealStore';
import { useFunnelStore } from '../../stores/funnelStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  deal: Deal;
  onUpdate: (patch: Partial<Deal>) => void;
}

/** Cabeçalho da tela de negociação: título editável, botões de marcar venda/perda e excluir, com modal de motivo da perda. */
export function DealHeader({ deal, onUpdate }: Props) {
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(deal.title);

  const deleteDeal = useDealStore((s) => s.deleteDeal);
  const moveDeal = useDealStore((s) => s.moveDeal);
  const funnels = useFunnelStore((s) => s.funnels);
  const winLossReasons = useFunnelStore((s) => s.winLossReasons);

  const funnel = funnels.find((f) => f.id === deal.funnelId);
  const wonStage = funnel?.stages.find((s) => s.type === 'won');
  const lostStage = funnel?.stages.find((s) => s.type === 'lost');

  // Move a negociação para a etapa de "ganho" e retorna à tela anterior.
  const handleMarkWon = async () => {
    if (!wonStage) return;
    await moveDeal(deal.id, 'closed_won', 0, deal.contactId, wonStage.id);
    router.back();
  };

  // Move a negociação para a etapa de "perdido", registra o motivo informado e retorna à tela anterior.
  const handleMarkLost = async () => {
    if (!lostStage) return;
    await moveDeal(deal.id, 'closed_lost', 0, deal.contactId, lostStage.id);
    if (lostReason) onUpdate({ closingReason: lostReason });
    setShowLostModal(false);
    router.back();
  };

  // Salva o título editado se for válido e diferente do atual, encerrando o modo de edição.
  const handleTitleSave = () => {
    if (titleDraft.trim() && titleDraft !== deal.title) {
      onUpdate({ title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  // Exclui a negociação e retorna à tela anterior.
  const handleDelete = async () => {
    await deleteDeal(deal.id);
    router.back();
  };

  const lostReasons = winLossReasons.filter((r) => r.type === 'lost' && r.isActive);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        {editingTitle ? (
          <TextInput
            style={styles.titleInput}
            value={titleDraft}
            onChangeText={setTitleDraft}
            onBlur={handleTitleSave}
            onSubmitEditing={handleTitleSave}
            autoFocus
          />
        ) : (
          <Pressable onPress={() => { setTitleDraft(deal.title); setEditingTitle(true); }}>
            <Text style={styles.title} numberOfLines={1}>{deal.title}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.lostBtn} onPress={() => setShowLostModal(true)}>
          <Text style={styles.lostBtnText}>👎 Marcar perda</Text>
        </Pressable>
        <Pressable style={styles.wonBtn} onPress={handleMarkWon}>
          <Text style={styles.wonBtnText}>👍 Marcar venda</Text>
        </Pressable>
        <Pressable style={styles.menuBtn} onPress={handleDelete}>
          <Text style={styles.menuBtnText}>🗑</Text>
        </Pressable>
      </View>

      <Modal visible={showLostModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Motivo da perda</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {lostReasons.map((r) => (
                <Pressable
                  key={r.id}
                  style={[styles.reasonBtn, lostReason === r.label && styles.reasonBtnActive]}
                  onPress={() => setLostReason(r.label)}
                >
                  <Text style={[styles.reasonText, lostReason === r.label && styles.reasonTextActive]}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={styles.reasonInput}
              placeholder="Ou escreva o motivo..."
              value={lostReason}
              onChangeText={setLostReason}
              placeholderTextColor={COLORS.gray[400]}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowLostModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleMarkLost}>
                <Text style={styles.modalConfirmText}>Confirmar perda</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.sm },
  backBtn: { padding: SPACING.xs },
  backArrow: { fontSize: 20, color: COLORS.gray[600] },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900] },
  titleInput: {
    fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900],
    borderBottomWidth: 2, borderBottomColor: COLORS.primary, minWidth: 200,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  lostBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#ef4444',
  },
  lostBtnText: { color: '#ef4444', fontSize: FONTS.sm, fontWeight: '600' },
  wonBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md, backgroundColor: '#16a34a',
  },
  wonBtnText: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '600' },
  menuBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.gray[200], alignItems: 'center', justifyContent: 'center',
  },
  menuBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl,
    width: 360, maxWidth: '90%',
  },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.md },
  reasonBtn: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.gray[200],
    marginBottom: SPACING.xs,
  },
  reasonBtnActive: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  reasonText: { color: COLORS.gray[700], fontSize: FONTS.sm },
  reasonTextActive: { color: '#ef4444', fontWeight: '600' },
  reasonInput: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    padding: SPACING.sm, marginTop: SPACING.sm, color: COLORS.gray[900], fontSize: FONTS.sm,
  },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  modalCancelBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center',
  },
  modalCancelText: { color: COLORS.gray[600], fontSize: FONTS.sm, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: '#ef4444', alignItems: 'center' },
  modalConfirmText: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '600' },
});
