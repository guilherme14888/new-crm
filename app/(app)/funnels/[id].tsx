import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFunnelStore } from '../../../src/stores/funnelStore';
import { FunnelStage } from '../../../src/types/models';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { generateId } from '../../../src/utils/id';

const PRESET_COLORS = ['#94a3b8','#3b82f6','#8b5cf6','#f59e0b','#f97316','#ef4444','#16a34a','#06b6d4','#ec4899'];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={cp.row}>
      {PRESET_COLORS.map((c) => (
        <Pressable key={c} style={[cp.dot, { backgroundColor: c }, value === c && cp.dotActive]} onPress={() => onChange(c)} />
      ))}
    </View>
  );
}
const cp = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: SPACING.md },
  dot: { width: 28, height: 28, borderRadius: 14 },
  dotActive: { borderWidth: 3, borderColor: COLORS.gray[900] },
});

type StageType = 'active' | 'won' | 'lost';

interface StageForm {
  name: string;
  color: string;
  probability: string;
  type: StageType;
  rottenDays: string;
}

const emptyStageForm = (): StageForm => ({ name: '', color: '#3b82f6', probability: '30', type: 'active', rottenDays: '' });

export default function FunnelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { funnels, loadFunnels, updateFunnel, createStage, updateStage, deleteStage, reorderStages } = useFunnelStore();

  const funnel = funnels.find((f) => f.id === id) ?? null;

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null);
  const [stageForm, setStageForm] = useState<StageForm>(emptyStageForm());

  useEffect(() => { loadFunnels(); }, []);

  useEffect(() => {
    if (funnel) { setEditName(funnel.name); setEditDesc(funnel.description ?? ''); }
  }, [funnel?.id]);

  if (!funnel) return (
    <View style={styles.center}><Text style={styles.empty}>Funil não encontrado.</Text></View>
  );

  const handleSaveFunnel = async () => {
    setSaving(true);
    await updateFunnel(funnel.id, { name: editName.trim(), description: editDesc.trim() || undefined });
    setSaving(false);
  };

  const openCreateStage = () => { setEditingStage(null); setStageForm(emptyStageForm()); setShowStageModal(true); };
  const openEditStage = (s: FunnelStage) => {
    setEditingStage(s);
    setStageForm({ name: s.name, color: s.color, probability: String(s.probability), type: s.type, rottenDays: s.rottenDays ? String(s.rottenDays) : '' });
    setShowStageModal(true);
  };

  const handleSaveStage = async () => {
    const data = {
      name: stageForm.name.trim(),
      color: stageForm.color,
      probability: Math.min(100, Math.max(0, parseInt(stageForm.probability) || 0)),
      type: stageForm.type,
      rottenDays: stageForm.rottenDays ? parseInt(stageForm.rottenDays) : null,
    };
    if (!data.name) return;
    if (editingStage) {
      await updateStage(funnel.id, editingStage.id, data);
    } else {
      await createStage({ ...data, funnelId: funnel.id, order: funnel.stages.length });
    }
    setShowStageModal(false);
  };

  const confirmDeleteStage = (s: FunnelStage) => {
    const doDelete = () => deleteStage(funnel.id, s.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir etapa "${s.name}"?`)) doDelete();
    } else {
      Alert.alert('Excluir etapa', `Excluir "${s.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const TYPE_LABELS: Record<StageType, string> = { active: 'Em andamento', won: 'Ganho ✓', lost: 'Perdido ✗' };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Back */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Funis</Text>
      </Pressable>

      {/* Funnel details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes do Funil</Text>
        <Text style={styles.label}>Nome *</Text>
        <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
        <Text style={styles.label}>Descrição</Text>
        <TextInput style={[styles.input, styles.inputMulti]} value={editDesc} onChangeText={setEditDesc} multiline numberOfLines={2} />
        <Pressable style={[styles.saveBtn, saving && styles.disabledBtn]} onPress={handleSaveFunnel}>
          <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
        </Pressable>
      </View>

      {/* Stages */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Etapas ({funnel.stages.length})</Text>
          <Pressable style={styles.addBtn} onPress={openCreateStage}>
            <Text style={styles.addBtnText}>+ Nova Etapa</Text>
          </Pressable>
        </View>
        {funnel.stages.map((stage, idx) => (
          <View key={stage.id} style={styles.stageRow}>
            <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
            <View style={styles.stageInfo}>
              <Text style={styles.stageName}>{stage.name}</Text>
              <Text style={styles.stageMeta}>{TYPE_LABELS[stage.type]} · {stage.probability}%{stage.rottenDays ? ` · Podre em ${stage.rottenDays}d` : ''}</Text>
            </View>
            <View style={styles.stageOrder}>
              <Text style={styles.orderNum}>#{idx + 1}</Text>
            </View>
            <Pressable style={styles.stageEditBtn} onPress={() => openEditStage(stage)}>
              <Text style={styles.stageEditBtnText}>✏️</Text>
            </Pressable>
            {funnel.stages.length > 1 && (
              <Pressable style={styles.stageDeleteBtn} onPress={() => confirmDeleteStage(stage)}>
                <Text style={styles.stageDeleteBtnText}>🗑</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {/* Stage modal */}
      <Modal visible={showStageModal} transparent animationType="fade" onRequestClose={() => setShowStageModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingStage ? 'Editar Etapa' : 'Nova Etapa'}</Text>

            <Text style={styles.label}>Nome *</Text>
            <TextInput style={styles.input} value={stageForm.name} onChangeText={(v) => setStageForm((f) => ({ ...f, name: v }))} autoFocus />

            <Text style={styles.label}>Cor</Text>
            <ColorPicker value={stageForm.color} onChange={(c) => setStageForm((f) => ({ ...f, color: c }))} />

            <Text style={styles.label}>Probabilidade (%)</Text>
            <TextInput
              style={styles.input} keyboardType="numeric"
              value={stageForm.probability}
              onChangeText={(v) => setStageForm((f) => ({ ...f, probability: v }))}
            />

            <Text style={styles.label}>Tipo de Etapa</Text>
            <View style={styles.typeRow}>
              {(['active', 'won', 'lost'] as StageType[]).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeBtn, stageForm.type === t && styles.typeBtnActive]}
                  onPress={() => setStageForm((f) => ({ ...f, type: t }))}
                >
                  <Text style={[styles.typeBtnText, stageForm.type === t && styles.typeBtnTextActive]}>
                    {TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Dias para "Podre" (opcional)</Text>
            <TextInput
              style={styles.input} keyboardType="numeric" placeholder="Ex: 30"
              value={stageForm.rottenDays}
              onChangeText={(v) => setStageForm((f) => ({ ...f, rottenDays: v }))}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowStageModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, !stageForm.name.trim() && styles.disabledBtn]} onPress={handleSaveStage}>
                <Text style={styles.confirmBtnText}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  content: { padding: SPACING.xl, gap: SPACING.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: COLORS.gray[400], fontSize: FONTS.base },
  backBtn: { marginBottom: SPACING.sm },
  backText: { color: COLORS.primary, fontSize: FONTS.base, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.gray[100],
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.md },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.base, color: COLORS.gray[900], marginBottom: SPACING.md, backgroundColor: COLORS.white,
  },
  inputMulti: { height: 72, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center' },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
  addBtn: { backgroundColor: COLORS.primary + '18', borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  addBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.sm },
  stageRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50],
  },
  stageDot: { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  stageInfo: { flex: 1 },
  stageName: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[800] },
  stageMeta: { fontSize: FONTS.sm, color: COLORS.gray[400] },
  stageOrder: { paddingHorizontal: SPACING.sm },
  orderNum: { fontSize: FONTS.sm, color: COLORS.gray[300] },
  stageEditBtn: { padding: SPACING.xs },
  stageEditBtnText: { fontSize: 16 },
  stageDeleteBtn: { padding: SPACING.xs },
  stageDeleteBtnText: { fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 460, maxWidth: '95%' as unknown as number },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.lg },
  typeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  typeBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '500' },
  typeBtnTextActive: { color: COLORS.white, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end', marginTop: SPACING.sm },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelBtnText: { color: COLORS.gray[600], fontWeight: '600' },
  confirmBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmBtnText: { color: COLORS.white, fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
});
