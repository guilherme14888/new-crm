import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { useMarketIntelStore, MarketKeyword } from '../../stores/marketIntelStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

// Configurações → Palavras-Chave (por tenant)
//   Lista com cadastrar / editar / excluir / ativar-desativar.
//   Campos: termo, rótulo (produto), contexto (negócio) e negativos (exclusões).

const EMPTY = { termo: '', produtoCandidato: '', contexto: '', negativos: '', ativo: true };

export function PalavrasChaveModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const keywords      = useMarketIntelStore((s) => s.keywords);
  const loading       = useMarketIntelStore((s) => s.keywordsLoading);
  const loadKeywords  = useMarketIntelStore((s) => s.loadKeywords);
  const createKeyword = useMarketIntelStore((s) => s.createKeyword);
  const updateKeyword = useMarketIntelStore((s) => s.updateKeyword);
  const deleteKeyword = useMarketIntelStore((s) => s.deleteKeyword);

  const [editing, setEditing] = useState<MarketKeyword | 'new' | null>(null);

  useEffect(() => { if (visible) loadKeywords(); }, [visible]);

  const confirmDelete = (kw: MarketKeyword) => {
    const go = () => deleteKeyword(kw.id);
    if (Platform.OS === 'web') { if (window.confirm(`Excluir a palavra-chave "${kw.termo}"?`)) go(); }
    else Alert.alert('Excluir', `Excluir "${kw.termo}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: go }]);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={st.overlay}>
          <Pressable style={st.overlayBg} onPress={onClose} />
          <View style={st.sheet}>
            <View style={st.header}>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>Palavras-Chave</Text>
                <Text style={st.sub}>Dirigem a busca de licitações nos portais</Text>
              </View>
              <Pressable style={st.addBtn} onPress={() => setEditing('new')}>
                <Text style={st.addBtnTxt}>+ Nova</Text>
              </Pressable>
              <Pressable style={st.closeBtn} onPress={onClose}><Text style={st.closeTxt}>✕</Text></Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
              {loading && keywords.length === 0 && (
                <View style={{ padding: SPACING.xl, alignItems: 'center' }}><ActivityIndicator color={COLORS.primary} /></View>
              )}
              {!loading && keywords.length === 0 && (
                <Text style={st.empty}>Nenhuma palavra-chave cadastrada.{'\n'}Clique em “+ Nova” para começar.</Text>
              )}
              {keywords.map((kw) => (
                <View key={kw.id} style={st.row}>
                  <Pressable
                    style={[st.dot, kw.ativo ? st.dotOn : st.dotOff]}
                    onPress={() => updateKeyword(kw.id, { ativo: !kw.ativo })}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={st.rowTitleLine}>
                      <Text style={[st.termo, !kw.ativo && st.termoOff]}>{kw.termo}</Text>
                      {!!kw.produtoCandidato && <View style={st.tag}><Text style={st.tagTxt}>{kw.produtoCandidato}</Text></View>}
                      {!kw.ativo && <Text style={st.inactive}>inativa</Text>}
                    </View>
                    {!!kw.contexto && <Text style={st.meta} numberOfLines={1}>Contexto: {kw.contexto}</Text>}
                    {!!kw.negativos && <Text style={st.metaNeg} numberOfLines={1}>Exclui: {kw.negativos}</Text>}
                  </View>
                  <Pressable style={st.iconBtn} onPress={() => setEditing(kw)}><Text>✏️</Text></Pressable>
                  <Pressable style={st.iconBtn} onPress={() => confirmDelete(kw)}><Text>🗑</Text></Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {editing && (
        <KeywordForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing === 'new') await createKeyword(data);
            else await updateKeyword((editing as MarketKeyword).id, data);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

// ─── Formulário (cadastrar / editar) ──────────────────────────────────────────
function KeywordForm({
  initial, onClose, onSave,
}: {
  initial: MarketKeyword | null;
  onClose: () => void;
  onSave: (data: Partial<MarketKeyword>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    termo: initial?.termo ?? '',
    produtoCandidato: initial?.produtoCandidato ?? '',
    contexto: initial?.contexto ?? '',
    negativos: initial?.negativos ?? '',
    ativo: initial?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.termo.trim()) return;
    setSaving(true);
    await onSave({
      termo: form.termo.trim(),
      produtoCandidato: form.produtoCandidato.trim() || null,
      contexto: form.contexto.trim() || null,
      negativos: form.negativos.trim() || null,
      ativo: form.ativo,
    });
    setSaving(false);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={st.overlayBg} onPress={onClose} />
        <View style={[st.sheet, st.formSheet]}>
          <View style={st.header}>
            <Text style={st.title}>{initial ? 'Editar palavra-chave' : 'Nova palavra-chave'}</Text>
            <Pressable style={st.closeBtn} onPress={onClose}><Text style={st.closeTxt}>✕</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
            <Text style={st.label}>Palavra-chave *</Text>
            <Text style={st.hint}>O termo buscado nos portais (ex.: pneu, osimertinibe).</Text>
            <TextInput style={st.input} value={form.termo} onChangeText={(v) => set('termo', v)} placeholder="ex.: pneu" placeholderTextColor={COLORS.gray[400]} autoCapitalize="none" />

            <Text style={[st.label, { marginTop: SPACING.md }]}>Rótulo / Produto</Text>
            <Text style={st.hint}>Como classificar o achado no painel (opcional).</Text>
            <TextInput style={st.input} value={form.produtoCandidato} onChangeText={(v) => set('produtoCandidato', v)} placeholder="ex.: PNEU AUTOMOTIVO" placeholderTextColor={COLORS.gray[400]} />

            <Text style={[st.label, { marginTop: SPACING.md }]}>Contexto do negócio</Text>
            <Text style={st.hint}>Descreva o que se encaixa no seu negócio — usado para análise de contexto.</Text>
            <TextInput style={[st.input, st.textarea]} value={form.contexto} onChangeText={(v) => set('contexto', v)} placeholder="ex.: pneus para veículos automotores (carros, caminhões)" placeholderTextColor={COLORS.gray[400]} multiline />

            <Text style={[st.label, { marginTop: SPACING.md }]}>Termos a excluir (negativos)</Text>
            <Text style={st.hint}>Separe por vírgula. Achados com esses termos são descartados.</Text>
            <TextInput style={[st.input, st.textarea]} value={form.negativos} onChangeText={(v) => set('negativos', v)} placeholder="ex.: carrinho, obra, bicicleta, brinquedo" placeholderTextColor={COLORS.gray[400]} multiline />

            <Pressable style={st.toggleRow} onPress={() => set('ativo', !form.ativo)}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Ativa</Text>
                <Text style={st.hint}>Inclui esta palavra na captação diária.</Text>
              </View>
              <View style={[st.switch, form.ativo && st.switchOn]}>
                <View style={[st.knob, form.ativo && st.knobOn]} />
              </View>
            </Pressable>
          </ScrollView>

          <View style={st.footer}>
            <Pressable style={st.cancelBtn} onPress={onClose}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
            <Pressable style={[st.saveBtn, (saving || !form.termo.trim()) && { opacity: 0.5 }]} onPress={handleSave} disabled={saving || !form.termo.trim()}>
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
  sheet:      { width: 600, maxWidth: '92%' as any, maxHeight: '85%' as any, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  formSheet:  { width: 480 },

  header:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:      { flex: 1, fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  sub:        { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
  addBtn:     { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  addBtnTxt:  { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt:   { fontSize: 15, color: COLORS.gray[500] },

  row:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  dot:        { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  dotOn:      { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  dotOff:     { backgroundColor: 'transparent', borderColor: COLORS.gray[300] },
  rowTitleLine:{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' as any },
  termo:      { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[800] },
  termoOff:   { color: COLORS.gray[400], textDecorationLine: 'line-through' as any },
  tag:        { backgroundColor: COLORS.primary + '15', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 1 },
  tagTxt:     { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  inactive:   { fontSize: 11, color: COLORS.gray[400], fontStyle: 'italic' as any },
  meta:       { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  metaNeg:    { fontSize: FONTS.sm, color: '#b45309', marginTop: 1 },
  iconBtn:    { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.gray[50] },
  empty:      { textAlign: 'center' as any, color: COLORS.gray[400], padding: SPACING.xl, lineHeight: 22 },

  label:      { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[700], marginBottom: 2 },
  hint:       { fontSize: FONTS.sm, color: COLORS.gray[400], marginBottom: 6 },
  input:      { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white },
  textarea:   { minHeight: 64, textAlignVertical: 'top' as any },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, marginTop: SPACING.md },
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
