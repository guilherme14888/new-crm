import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ScrollView } from 'react-native';
import { useTaskStore } from '../../../stores/taskStore';
import { Task, TaskType } from '../../../types/models';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

const TASK_ICONS: Record<TaskType, string> = {
  to_do: '☐', call: '📞', email: '✉️', meeting: '🤝', visit: '🚗',
};

const TASK_LABELS: Record<TaskType, string> = {
  to_do: 'Tarefa', call: 'Ligação', email: 'E-mail', meeting: 'Reunião', visit: 'Visita',
};

const TASK_TYPES: TaskType[] = ['to_do', 'call', 'email', 'meeting', 'visit'];

interface Props { dealId: string; }

export function DealTasksTab({ dealId }: Props) {
  const { tasks, loadTasks, createTask, completeTask, reopenTask, deleteTask } = useTaskStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('to_do');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => { loadTasks(dealId); }, [dealId]);

  const pending = tasks.filter((t) => !t.completedAt);
  const completed = tasks.filter((t) => !!t.completedAt);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createTask({ dealId, title: title.trim(), type, dueDate: dueDate || null });
    setTitle(''); setType('to_do'); setDueDate(''); setShowForm(false);
  };

  const isOverdue = (t: Task) => !!t.dueDate && !t.completedAt && new Date(t.dueDate) < new Date();

  const renderTask = (t: Task) => (
    <View key={t.id} style={[styles.taskRow, isOverdue(t) && styles.taskOverdue]}>
      <Pressable
        style={[styles.checkbox, !!t.completedAt && styles.checkboxDone]}
        onPress={() => t.completedAt ? reopenTask(t.id) : completeTask(t.id)}
      >
        {t.completedAt && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
      <View style={styles.taskInfo}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTypeIcon}>{TASK_ICONS[t.type]}</Text>
          <Text style={[styles.taskTitle, !!t.completedAt && styles.taskTitleDone]}>{t.title}</Text>
        </View>
        {t.dueDate && (
          <Text style={[styles.taskDue, isOverdue(t) && styles.taskDueOverdue]}>
            {new Date(t.dueDate).toLocaleDateString('pt-BR')}
          </Text>
        )}
      </View>
      <Pressable style={styles.deleteBtn} onPress={() => deleteTask(t.id)}>
        <Text style={styles.deleteText}>×</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.addBtnText}>+ Criar tarefa</Text>
      </Pressable>

      {pending.length === 0 && completed.length === 0 && (
        <Text style={styles.empty}>Nenhuma tarefa para esta negociação.</Text>
      )}

      {pending.map(renderTask)}

      {completed.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Concluídas ({completed.length})</Text>
          {completed.map(renderTask)}
        </>
      )}

      <Modal visible={showForm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nova Tarefa</Text>
            <TextInput
              style={styles.input}
              placeholder="Título da tarefa *"
              placeholderTextColor={COLORS.gray[400]}
              value={title}
              onChangeText={setTitle}
            />
            <Text style={styles.inputLabel}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
              <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
                {TASK_TYPES.map((tt) => (
                  <Pressable
                    key={tt}
                    style={[styles.typeBtn, type === tt && styles.typeBtnActive]}
                    onPress={() => setType(tt)}
                  >
                    <Text style={[styles.typeBtnText, type === tt && styles.typeBtnTextActive]}>
                      {TASK_ICONS[tt]} {TASK_LABELS[tt]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.inputLabel}>Prazo (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 30/04/2026"
              placeholderTextColor={COLORS.gray[400]}
              value={dueDate}
              onChangeText={setDueDate}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleCreate}>
                <Text style={styles.saveText}>Criar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md },
  addBtn: {
    padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary,
    alignItems: 'center', marginBottom: SPACING.md,
  },
  addBtnText: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.gray[400], paddingVertical: SPACING.xl, fontSize: FONTS.sm },
  sectionLabel: { fontSize: FONTS.xs, fontWeight: '700', color: COLORS.gray[500], marginTop: SPACING.md, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, marginBottom: SPACING.xs,
    borderWidth: 1, borderColor: COLORS.gray[100], gap: SPACING.sm,
  },
  taskOverdue: { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: COLORS.gray[300], alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { borderColor: '#16a34a', backgroundColor: '#16a34a' },
  checkmark: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  taskInfo: { flex: 1 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskTypeIcon: { fontSize: 14 },
  taskTitle: { fontSize: FONTS.sm, fontWeight: '500', color: COLORS.gray[800] },
  taskTitleDone: { textDecorationLine: 'line-through', color: COLORS.gray[400] },
  taskDue: { fontSize: FONTS.xs, color: COLORS.gray[500], marginTop: 2 },
  taskDueOverdue: { color: '#ef4444', fontWeight: '600' },
  deleteBtn: { padding: SPACING.xs },
  deleteText: { fontSize: 20, color: COLORS.gray[400], lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 360, maxWidth: '90%' },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.md },
  inputLabel: { fontSize: FONTS.xs, color: COLORS.gray[500], fontWeight: '600', marginBottom: SPACING.xs, marginTop: SPACING.sm },
  input: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    padding: SPACING.sm, color: COLORS.gray[900], fontSize: FONTS.sm,
  },
  typeBtn: {
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200],
  },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  typeBtnText: { fontSize: FONTS.xs, color: COLORS.gray[600] },
  typeBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  cancelBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' },
  cancelText: { color: COLORS.gray[600], fontSize: FONTS.sm, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '700' },
});
