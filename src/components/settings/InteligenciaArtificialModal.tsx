import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useMarketIntelStore } from '../../stores/marketIntelStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

// Configurações → Inteligência Artificial (por tenant)
//   Lista suspensa de provedores (Anthropic, OpenAI, Gemini, Grok, DeepSeek),
//   campo da chave da API e modelo opcional. O provedor escolhido é usado para
//   classificar licitações por contexto e sugerir contexto/exclusões de keywords.

export function InteligenciaArtificialModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const cfg     = useMarketIntelStore((s) => s.aiConfig);
  const loading = useMarketIntelStore((s) => s.aiConfigLoading);
  const load    = useMarketIntelStore((s) => s.loadAiConfig);
  const save    = useMarketIntelStore((s) => s.saveAiConfig);
  const test    = useMarketIntelStore((s) => s.testAiConfig);

  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey]     = useState('');
  const [model, setModel]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testMsg, setTestMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (visible) load(); }, [visible]);
  // reflete a config carregada no formulário (não traz a chave — só se existe)
  useEffect(() => {
    if (cfg) { setProvider(cfg.provider); setModel(cfg.model || ''); setApiKey(''); setTestMsg(null); }
  }, [cfg]);

  const providers = cfg?.providers || [];
  const selDef = providers.find((p) => p.key === provider);

  const handleSave = async () => {
    setSaving(true); setTestMsg(null);
    try {
      await save({ provider, apiKey: apiKey.trim() || undefined, model: model.trim() || undefined });
      setApiKey('');
    } catch { /* toast já exibido */ } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestMsg(null);
    const r = await test();
    setTestMsg(r.ok
      ? { ok: true, text: `Conexão OK — ${r.provider} · ${r.model}` }
      : { ok: false, text: r.error || 'Falha na conexão' });
    setTesting(false);
  };

  const statusTxt = !cfg ? ''
    : cfg.source === 'tenant' ? 'Ativo: usando a chave salva aqui.'
    : cfg.source === 'env'    ? 'Usando a chave do ambiente (.env) como fallback.'
    : 'Nenhuma chave configurada — a IA está desligada (a captação ainda funciona, mas sem filtro de contexto por IA).';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={st.overlayBg} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.header}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>Inteligência Artificial</Text>
              <Text style={st.sub}>Provedor usado para classificar e contextualizar licitações</Text>
            </View>
            <Pressable style={st.closeBtn} onPress={onClose}><Text style={st.closeTxt}>✕</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
            {loading && !cfg ? (
              <View style={{ padding: SPACING.xl, alignItems: 'center' }}><ActivityIndicator color={COLORS.primary} /></View>
            ) : (
              <>
                <Text style={st.label}>Provedor de IA</Text>
                <Text style={st.hint}>Selecione qual IA usar para a captação de licitações.</Text>
                <View style={st.provList}>
                  {providers.map((p) => {
                    const on = p.key === provider;
                    return (
                      <Pressable key={p.key} style={[st.provBtn, on && st.provBtnOn]} onPress={() => { setProvider(p.key); setModel(''); setTestMsg(null); }}>
                        <Text style={[st.provTxt, on && st.provTxtOn]}>{p.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[st.label, { marginTop: SPACING.md }]}>Chave da API</Text>
                <Text style={st.hint}>{cfg?.hasKey ? 'Já existe uma chave salva. Preencha apenas se quiser substituir.' : 'Cole a chave do provedor selecionado.'}</Text>
                <TextInput
                  style={st.input}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder={cfg?.hasKey ? '•••••••••• (chave salva)' : 'cole a chave da API aqui'}
                  placeholderTextColor={COLORS.gray[400]}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <Text style={[st.label, { marginTop: SPACING.md }]}>Modelo (opcional)</Text>
                <Text style={st.hint}>Em branco usa o padrão: {selDef?.defaultModel || '—'}</Text>
                <TextInput
                  style={st.input}
                  value={model}
                  onChangeText={setModel}
                  placeholder={selDef?.defaultModel || ''}
                  placeholderTextColor={COLORS.gray[400]}
                  autoCapitalize="none"
                />

                {!!statusTxt && <Text style={st.statusTxt}>{statusTxt}</Text>}
                {!!testMsg && <Text style={[st.testTxt, testMsg.ok ? st.testOk : st.testErr]}>{testMsg.ok ? '✓ ' : '⛔ '}{testMsg.text}</Text>}
                <Text style={st.foot}>A chave é gravada no servidor e nunca é devolvida à tela. O “Testar conexão” usa a configuração já salva.</Text>
              </>
            )}
          </ScrollView>

          <View style={st.footer}>
            <Pressable style={[st.testBtn, (testing || saving) && { opacity: 0.5 }]} onPress={handleTest} disabled={testing || saving}>
              <Text style={st.testBtnTxt}>{testing ? 'Testando…' : '↻ Testar conexão'}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable style={st.cancelBtn} onPress={onClose}><Text style={st.cancelTxt}>Fechar</Text></Pressable>
            <Pressable style={[st.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
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
  sheet:      { width: 520, maxWidth: '92%' as any, maxHeight: '85%' as any, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },

  header:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:      { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  sub:        { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt:   { fontSize: 15, color: COLORS.gray[500] },

  label:      { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[700], marginBottom: 2 },
  hint:       { fontSize: FONTS.sm, color: COLORS.gray[400], marginBottom: 6 },
  input:      { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white },

  provList:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  provBtn:    { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 7, backgroundColor: COLORS.white, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  provBtnOn:  { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
  provTxt:    { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
  provTxtOn:  { color: COLORS.primary, fontWeight: '800' },

  statusTxt:  { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: SPACING.md, lineHeight: 18 },
  testTxt:    { fontSize: FONTS.sm, marginTop: SPACING.sm, fontWeight: '700' },
  testOk:     { color: '#16a34a' },
  testErr:    { color: '#dc2626' },
  foot:       { fontSize: 11, color: COLORS.gray[400], marginTop: SPACING.md, lineHeight: 15 },

  footer:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  testBtn:    { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  testBtnTxt: { color: COLORS.gray[700], fontWeight: '700', fontSize: FONTS.sm },
  cancelBtn:  { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:  { color: COLORS.gray[600], fontWeight: '600' },
  saveBtn:    { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveTxt:    { color: COLORS.white, fontWeight: '700' },
});
