import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useMarketIntelStore, MarketIntelSource } from '../../stores/marketIntelStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

// Configurações → API Externa
//   Modal 1: lista de portais (cada linha com botão Editar)
//   Modal 2: edição da configuração do portal (campos dinâmicos + Ativo)

export function ApiExternaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const sources        = useMarketIntelStore((s) => s.sources);
  const loading        = useMarketIntelStore((s) => s.sourcesLoading);
  const loadSources    = useMarketIntelStore((s) => s.loadSources);
  const saveSource     = useMarketIntelStore((s) => s.saveSource);

  const [editing, setEditing] = useState<MarketIntelSource | null>(null);

  useEffect(() => { if (visible) loadSources(); }, [visible]);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={st.overlay}>
          <Pressable style={st.overlayBg} onPress={onClose} />
          <View style={st.sheet}>
            <View style={st.header}>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>API Externa</Text>
                <Text style={st.sub}>Portais de captação de licitações</Text>
              </View>
              <Pressable style={st.closeBtn} onPress={onClose}><Text style={st.closeTxt}>✕</Text></Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
              {loading && sources.length === 0 && (
                <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              )}
              {sources.map((src) => (
                <View key={src.key} style={st.row}>
                  <View style={{ flex: 1 }}>
                    <View style={st.rowTitleLine}>
                      <Text style={st.rowName}>{src.name}</Text>
                      <View style={[st.badge, src.enabled ? st.badgeOn : st.badgeOff]}>
                        <Text style={[st.badgeTxt, src.enabled ? st.badgeTxtOn : st.badgeTxtOff]}>
                          {src.enabled ? 'Ativo' : 'Inativo'}
                        </Text>
                      </View>
                      {!src.implemented && (
                        <View style={[st.badge, st.badgePending]}>
                          <Text style={[st.badgeTxt, st.badgeTxtPending]}>Em breve</Text>
                        </View>
                      )}
                    </View>
                    {!!src.note && <Text style={st.rowNote} numberOfLines={2}>{src.note}</Text>}
                  </View>
                  <Pressable style={st.editBtn} onPress={() => setEditing(src)}>
                    <Text style={st.editBtnTxt}>✏️ Editar</Text>
                  </Pressable>
                </View>
              ))}
              {!loading && sources.length === 0 && (
                <Text style={st.empty}>Nenhum portal configurado.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {editing && (
        <EditSourceModal
          source={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => { await saveSource(editing.key, patch); setEditing(null); }}
        />
      )}
    </>
  );
}

// ─── Modal de edição ────────────────────────────────────────────────────────────
function EditSourceModal({
  source, onClose, onSave,
}: {
  source: MarketIntelSource;
  onClose: () => void;
  onSave: (patch: { enabled: boolean; config: Record<string, string> }) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(source.enabled);
  const [config, setConfig]   = useState<Record<string, string>>({ ...source.config });
  const [saving, setSaving]   = useState(false);

  const setField = (k: string, v: string) => setConfig((c) => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave({ enabled, config });
    setSaving(false);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={st.overlayBg} onPress={onClose} />
        <View style={[st.sheet, st.editSheet]}>
          <View style={st.header}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{source.name}</Text>
              <Text style={st.sub}>
                {source.mode === 'processos' ? 'Lista de processos (sem busca por palavra-chave)' : 'Busca por palavra-chave'}
              </Text>
            </View>
            <Pressable style={st.closeBtn} onPress={onClose}><Text style={st.closeTxt}>✕</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
            {!!source.note && (
              <View style={st.noteBox}><Text style={st.noteTxt}>{source.note}</Text></View>
            )}

            {/* Ativo */}
            <Pressable style={st.toggleRow} onPress={() => setEnabled((v) => !v)}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Ativo</Text>
                <Text style={st.hint}>Inclui este portal na captação diária.</Text>
              </View>
              <View style={[st.switch, enabled && st.switchOn]}>
                <View style={[st.knob, enabled && st.knobOn]} />
              </View>
            </Pressable>

            {/* Campos dinâmicos */}
            {source.fields.length === 0 ? (
              <Text style={st.hint}>Este portal não requer credenciais.</Text>
            ) : (
              source.fields.map((f) => (
                <View key={f.key} style={{ marginTop: SPACING.md }}>
                  <Text style={st.label}>{f.label || f.key}</Text>
                  <TextInput
                    style={[st.input, f.type === 'textarea' && st.textarea]}
                    value={config[f.key] ?? ''}
                    onChangeText={(v) => setField(f.key, v)}
                    placeholder={f.placeholder || ''}
                    placeholderTextColor={COLORS.gray[400]}
                    secureTextEntry={!!f.secret}
                    autoCapitalize="none"
                    multiline={f.type === 'textarea'}
                  />
                </View>
              ))
            )}
          </ScrollView>

          <View style={st.footer}>
            <Pressable style={st.cancelBtn} onPress={onClose}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
            <Pressable style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={st.saveTxt}>{saving ? 'Salvando…' : 'Salvar'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayBg:  { position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' } as any,
  sheet:      { width: 560, maxWidth: '92%' as any, maxHeight: '85%' as any, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  editSheet:  { width: 460 },

  header:     { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:      { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  sub:        { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt:   { fontSize: 15, color: COLORS.gray[500] },

  row:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  rowTitleLine:{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' as any },
  rowName:    { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[800] },
  rowNote:    { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
  editBtn:    { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '15', borderWidth: 1, borderColor: COLORS.primary + '40' },
  editBtnTxt: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '700' },
  empty:      { textAlign: 'center' as any, color: COLORS.gray[400], padding: SPACING.lg },

  badge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeOn:    { backgroundColor: '#f0fdf4' },
  badgeOff:   { backgroundColor: COLORS.gray[100] },
  badgePending:{ backgroundColor: '#fffbeb' },
  badgeTxt:   { fontSize: 11, fontWeight: '700' },
  badgeTxtOn: { color: '#16a34a' },
  badgeTxtOff:{ color: COLORS.gray[500] },
  badgeTxtPending: { color: '#b45309' },

  noteBox:    { backgroundColor: COLORS.gray[50], borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  noteTxt:    { fontSize: FONTS.sm, color: COLORS.gray[600], lineHeight: 18 },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, marginTop: SPACING.sm },
  label:      { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[700], marginBottom: 4 },
  hint:       { fontSize: FONTS.sm, color: COLORS.gray[400] },
  input:      { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white },
  textarea:   { minHeight: 80, textAlignVertical: 'top' as any },

  switch:     { width: 46, height: 26, borderRadius: 13, backgroundColor: COLORS.gray[300], padding: 3, justifyContent: 'center' },
  switchOn:   { backgroundColor: COLORS.primary },
  knob:       { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },
  knobOn:     { alignSelf: 'flex-end' as any },

  footer:     { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  cancelBtn:  { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:  { color: COLORS.gray[600], fontWeight: '600' },
  saveBtn:    { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveTxt:    { color: COLORS.white, fontWeight: '700' },
});
