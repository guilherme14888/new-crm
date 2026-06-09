import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal,
  Alert, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useFunnelStore } from '../../../src/stores/funnelStore';
import { Funnel } from '../../../src/types/models';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';

/** Tela de listagem de funis de venda: cards com etapas, ações de padrão/editar/excluir e modal de criação. */
export default function FunnelsScreen() {
  const { funnels, isLoading, loadFunnels, createFunnel, deleteFunnel, setDefaultFunnel } = useFunnelStore();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { loadFunnels(); }, []);

  /** Cria um novo funil a partir do formulário e limpa/fecha o modal. */
  const handleCreate = async () => {
    if (!name.trim()) return;
    await createFunnel({ name: name.trim(), description: description.trim() || undefined });
    setName(''); setDescription(''); setShowCreate(false);
  };

  /** Pede confirmação (web/nativo) e exclui o funil, exceto se for o padrão. */
  const confirmDelete = (funnel: Funnel) => {
    if (funnel.isDefault) return;
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir funil "${funnel.name}"?`)) deleteFunnel(funnel.id);
    } else {
      Alert.alert('Excluir funil', `Excluir "${funnel.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteFunnel(funnel.id) },
      ]);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Funis de Venda</Text>
          <Text style={styles.sub}>Gerencie seus pipelines de oportunidades</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ Novo Funil</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {funnels.map((funnel) => (
          <View key={funnel.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitle}>
                <Text style={styles.funnelName}>{funnel.name}</Text>
                {funnel.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Padrão</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardActions}>
                {!funnel.isDefault && (
                  <Pressable style={styles.actionBtn} onPress={() => setDefaultFunnel(funnel.id)}>
                    <Text style={styles.actionBtnText}>Definir padrão</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.editBtn}
                  onPress={() => router.push(`/(app)/funnels/${funnel.id}` as never)}
                >
                  <Text style={styles.editBtnText}>Editar</Text>
                </Pressable>
                {!funnel.isDefault && (
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(funnel)}>
                    <Text style={styles.deleteBtnText}>Excluir</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {funnel.description ? (
              <Text style={styles.funnelDesc}>{funnel.description}</Text>
            ) : null}
            {/* Stages preview */}
            <View style={styles.stages}>
              {funnel.stages.map((stage) => (
                <View key={stage.id} style={[styles.stagePill, { backgroundColor: stage.color + '22', borderColor: stage.color }]}>
                  <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
                  <Text style={[styles.stageLabel, { color: stage.color }]}>{stage.name}</Text>
                </View>
              ))}
              <Pressable
                style={styles.addStageBtn}
                onPress={() => router.push(`/(app)/funnels/${funnel.id}` as never)}
              >
                <Text style={styles.addStageBtnText}>+ Etapa</Text>
              </Pressable>
            </View>
            <Text style={styles.stageCount}>{funnel.stages.length} etapas</Text>
          </View>
        ))}
        {funnels.length === 0 && !isLoading && (
          <Text style={styles.empty}>Nenhum funil encontrado.</Text>
        )}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Novo Funil</Text>
            <Text style={styles.inputLabel}>Nome *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Pipeline de Vendas"
              autoFocus
            />
            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="Opcional"
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, !name.trim() && styles.disabledBtn]} onPress={handleCreate}>
                <Text style={styles.confirmBtnText}>Criar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  title: { fontSize: FONTS['2xl'], fontWeight: '700', color: COLORS.gray[900] },
  sub: { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  addBtnText: { color: COLORS.white, fontWeight: '600', fontSize: FONTS.base },
  list: { flex: 1 },
  listContent: { padding: SPACING.lg, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.gray[100],
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  funnelName: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900] },
  defaultBadge: { backgroundColor: COLORS.primary + '18', borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: SPACING.xs },
  actionBtn: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, backgroundColor: COLORS.gray[100] },
  actionBtnText: { fontSize: FONTS.sm, color: COLORS.gray[600] },
  editBtn: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, backgroundColor: COLORS.primary + '18' },
  editBtnText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  deleteBtn: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, backgroundColor: '#fee2e2' },
  deleteBtnText: { fontSize: FONTS.sm, color: '#b91c1c' },
  funnelDesc: { fontSize: FONTS.sm, color: COLORS.gray[500], marginBottom: SPACING.sm },
  stages: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  stagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderWidth: 1,
  },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  stageLabel: { fontSize: 11, fontWeight: '500' },
  addStageBtn: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.gray[300] },
  addStageBtnText: { fontSize: 11, color: COLORS.gray[400] },
  stageCount: { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: SPACING.sm },
  empty: { textAlign: 'center', color: COLORS.gray[400], marginTop: SPACING.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 400, maxWidth: '90%' as unknown as number },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.lg },
  inputLabel: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.base, color: COLORS.gray[900], marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end', marginTop: SPACING.sm },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelBtnText: { color: COLORS.gray[600], fontWeight: '600' },
  confirmBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmBtnText: { color: COLORS.white, fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
});
