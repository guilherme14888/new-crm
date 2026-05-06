import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable } from 'react-native';
import { useActivityStore } from '../../../stores/activityStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

const ICONS: Record<string, string> = {
  call: '📞', email: '✉️', meeting: '🤝', note: '📝', stage_change: '🔄',
};

interface Props { dealId: string; contactId: string; }

export function DealHistoryTab({ dealId, contactId }: Props) {
  const { getByDeal, createActivity } = useActivityStore();
  const [activities, setActivities] = useState<ReturnType<typeof getByDeal>>([]);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const data = await getByDeal(dealId);
    setActivities(data);
  };

  useEffect(() => { load(); }, [dealId]);

  const handleAddNote = async () => {
    if (!note.trim()) return;
    await createActivity({
      dealId, contactId, type: 'note', title: note.trim(),
      description: null, occurredAt: new Date().toISOString(), metadata: null,
    });
    setNote('');
    setAdding(false);
    load();
  };

  return (
    <View style={styles.container}>
      {adding ? (
        <View style={styles.noteBox}>
          <TextInput
            style={styles.noteInput}
            placeholder="Escreva uma anotação..."
            placeholderTextColor={COLORS.gray[400]}
            value={note}
            onChangeText={setNote}
            multiline
            autoFocus
            onKeyPress={(e: any) => {
              if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                e.preventDefault?.();
                handleAddNote();
              }
            }}
          />
          <View style={styles.noteActions}>
            <Pressable style={styles.cancelBtn} onPress={() => { setNote(''); setAdding(false); }}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleAddNote}>
              <Text style={styles.saveText}>Salvar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addNoteBtn} onPress={() => setAdding(true)}>
          <Text style={styles.addNoteText}>+ Adicionar anotação</Text>
        </Pressable>
      )}

      <FlatList
        data={activities}
        keyExtractor={(a) => a.id}
        renderItem={({ item: a }) => (
          <View style={styles.item}>
            <View style={styles.iconCol}>
              <Text style={styles.icon}>{ICONS[a.type] ?? '•'}</Text>
              <View style={styles.line} />
            </View>
            <View style={styles.content}>
              <Text style={styles.itemTitle}>{a.title}</Text>
              {a.description && <Text style={styles.itemDesc}>{a.description}</Text>}
              <Text style={styles.itemDate}>
                {new Date(a.occurredAt).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma atividade registrada.</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addNoteBtn: {
    margin: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.gray[300], alignItems: 'center',
  },
  addNoteText: { color: COLORS.primary, fontSize: FONTS.sm, fontWeight: '600' },
  noteBox: { margin: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary },
  noteInput: {
    fontSize: FONTS.sm, color: COLORS.gray[900], minHeight: 80,
    textAlignVertical: 'top', marginBottom: SPACING.sm,
  },
  noteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm },
  cancelBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  cancelText: { color: COLORS.gray[500], fontSize: FONTS.sm },
  saveBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm },
  saveText: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '600' },
  item: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  iconCol: { alignItems: 'center', marginRight: SPACING.sm, width: 32 },
  icon: { fontSize: 18 },
  line: { flex: 1, width: 1, backgroundColor: COLORS.gray[200], marginTop: 4 },
  content: { flex: 1, paddingBottom: SPACING.md },
  itemTitle: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[800] },
  itemDesc: { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  itemDate: { fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 4 },
  empty: { textAlign: 'center', color: COLORS.gray[400], padding: SPACING.xl, fontSize: FONTS.sm },
});
