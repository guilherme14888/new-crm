import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useMarketIntelStore } from '../../stores/marketIntelStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

// Configurações → Inteligência Artificial (por tenant)
//   Lista suspensa de provedores (Anthropic, OpenAI, Gemini, Grok, Groq, DeepSeek).
//   Ao colar a chave, o sistema busca os modelos disponíveis para ela e o usuário
//   seleciona um na lista. O provedor/modelo escolhido é usado para classificar
//   licitações por contexto e sugerir contexto/exclusões de palavras-chave.

type Opt = { value: string; label: string };

// Lista suspensa simples (expande logo abaixo do cabeçalho).
function Dropdown({ value, options, placeholder, onChange, disabled, loading }: {
  value: string; options: Opt[]; placeholder: string;
  onChange: (v: string) => void; disabled?: boolean; loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.value === value);
  return (
    <View>
      <Pressable
        style={[st.input, st.ddHeader, disabled && { opacity: 0.55 }]}
        onPress={() => { if (!disabled) setOpen((o) => !o); }}
      >
        <Text style={[st.ddVal, !sel && { color: COLORS.gray[400] }]} numberOfLines={1}>
          {loading ? 'Carregando modelos…' : (sel ? sel.label : placeholder)}
        </Text>
        <Text style={st.ddChev}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && !disabled && (
        <View style={st.ddList}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable key={o.value || '__default'} style={[st.ddItem, on && st.ddItemOn]} onPress={() => { onChange(o.value); setOpen(false); }}>
                  <Text style={[st.ddItemTxt, on && st.ddItemTxtOn]} numberOfLines={1}>{o.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export function InteligenciaArtificialModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const cfg         = useMarketIntelStore((s) => s.aiConfig);
  const loading     = useMarketIntelStore((s) => s.aiConfigLoading);
  const load        = useMarketIntelStore((s) => s.loadAiConfig);
  const save        = useMarketIntelStore((s) => s.saveAiConfig);
  const test        = useMarketIntelStore((s) => s.testAiConfig);
  const fetchModels = useMarketIntelStore((s) => s.fetchAiModels);
  const captchaHasKey = useMarketIntelStore((s) => s.captchaHasKey);
  const loadCaptcha   = useMarketIntelStore((s) => s.loadCaptcha);
  const saveCaptcha   = useMarketIntelStore((s) => s.saveCaptcha);

  const [captchaKey, setCaptchaKey] = useState('');
  const [savingCaptcha, setSavingCaptcha] = useState(false);

  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey]     = useState('');
  const [model, setModel]       = useState('');
  const [models, setModels]     = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsErr, setModelsErr] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testMsg, setTestMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  const providers = cfg?.providers || [];
  const selDef = providers.find((p) => p.key === provider);

  useEffect(() => { if (visible) { load(); loadCaptcha(); setCaptchaKey(''); } }, [visible]);

  const handleSaveCaptcha = async () => {
    setSavingCaptcha(true);
    try { await saveCaptcha(captchaKey.trim()); setCaptchaKey(''); } catch { /* toast */ } finally { setSavingCaptcha(false); }
  };

  // reflete a config carregada; se há chave salva, busca os modelos dela
  useEffect(() => {
    if (!cfg) return;
    setProvider(cfg.provider); setModel(cfg.model || ''); setApiKey(''); setTestMsg(null); setModelsErr(null); setModels([]);
    if (cfg.hasKey) doFetchModels(cfg.provider, '');
  }, [cfg]);

  // ao digitar/colar a chave, busca os modelos automaticamente (com debounce)
  useEffect(() => {
    const key = apiKey.trim();
    if (!key) return;
    const h = setTimeout(() => doFetchModels(provider, key), 700);
    return () => clearTimeout(h);
  }, [apiKey, provider]);

  async function doFetchModels(prov: string, key: string) {
    setLoadingModels(true); setModelsErr(null);
    try {
      const m = await fetchModels({ provider: prov, apiKey: key || undefined });
      setModels(m);
    } catch (e: any) {
      setModels([]);
      setModelsErr(e?.message ?? 'Não foi possível listar os modelos para esta chave.');
    } finally {
      setLoadingModels(false);
    }
  }

  const onProviderChange = (p: string) => {
    setProvider(p); setModel(''); setModels([]); setModelsErr(null); setTestMsg(null);
    // usa a chave salva quando voltamos ao provedor já configurado
    if (!apiKey.trim() && cfg?.hasKey && cfg.provider === p) doFetchModels(p, '');
  };

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

  // opções da lista de modelos: "Padrão" + os buscados (+ o atual, se fora da lista)
  const modelOptions: Opt[] = [{ value: '', label: `Padrão${selDef ? ` — ${selDef.defaultModel}` : ''}` }];
  const seen = new Set<string>(['']);
  if (model && !models.includes(model)) { modelOptions.push({ value: model, label: model }); seen.add(model); }
  for (const m of models) if (!seen.has(m)) { modelOptions.push({ value: m, label: m }); seen.add(m); }

  // Só consideramos "chave salva" se o provedor selecionado for o mesmo já salvo
  // (trocar de provedor exige nova chave — a antiga é limpa ao salvar).
  const savedHere = !!cfg?.hasKey && provider === cfg?.provider;

  const statusTxt = !cfg ? ''
    : (cfg.hasKey && provider !== cfg.provider) ? 'Você trocou de provedor — cole a chave deste provedor e clique em Salvar (a chave anterior será substituída).'
    : savedHere && cfg.source === 'tenant' ? 'Ativo: usando a chave salva aqui (criptografada no servidor).'
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

          <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
            {loading && !cfg ? (
              <View style={{ padding: SPACING.xl, alignItems: 'center' }}><ActivityIndicator color={COLORS.primary} /></View>
            ) : (
              <>
                <Text style={st.label}>Provedor de IA</Text>
                <Text style={st.hint}>Selecione qual IA usar para a captação de licitações.</Text>
                <Dropdown
                  value={provider}
                  options={providers.map((p) => ({ value: p.key, label: p.label }))}
                  placeholder="Selecione o provedor"
                  onChange={onProviderChange}
                />

                <Text style={[st.label, { marginTop: SPACING.md }]}>Chave da API</Text>
                <Text style={st.hint}>{savedHere ? 'Já existe uma chave salva (criptografada). Preencha apenas se quiser substituir.' : 'Cole a chave deste provedor — os modelos serão buscados automaticamente.'}</Text>
                <TextInput
                  style={st.input}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder={savedHere ? '•••••••••• (chave salva)' : 'cole a chave da API aqui'}
                  placeholderTextColor={COLORS.gray[400]}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <Text style={[st.label, { marginTop: SPACING.md }]}>Modelo</Text>
                <Text style={st.hint}>
                  {loadingModels ? 'Buscando modelos para esta chave…'
                    : models.length ? `${models.length} modelo(s) disponível(is) para esta chave.`
                    : 'Cole a chave para listar os modelos. “Padrão” usa o modelo recomendado do provedor.'}
                </Text>
                <Dropdown
                  value={model}
                  options={modelOptions}
                  placeholder="Padrão do provedor"
                  onChange={setModel}
                  loading={loadingModels}
                />
                {!!modelsErr && <Text style={st.testErr}>⛔ {modelsErr}</Text>}

                {!!statusTxt && <Text style={st.statusTxt}>{statusTxt}</Text>}
                {!!testMsg && <Text style={[st.testTxt, testMsg.ok ? st.testOk : st.testErr]}>{testMsg.ok ? '✓ ' : '⛔ '}{testMsg.text}</Text>}
                <Text style={st.foot}>A chave é gravada no servidor e nunca é devolvida à tela. O “Testar conexão” usa a configuração já salva.</Text>

                {/* ── CAPTCHA (2Captcha) — para portais com reCAPTCHA (ex.: BEC-SP) ── */}
                <View style={st.divider} />
                <Text style={st.label}>Resolução de CAPTCHA (2Captcha)</Text>
                <Text style={st.hint}>
                  {captchaHasKey ? 'Chave salva (criptografada). Preencha apenas para substituir.'
                    : 'Cole a chave da sua conta 2Captcha — usada pelo coletor (scrape-worker) nos portais com reCAPTCHA.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
                  <TextInput
                    style={[st.input, { flex: 1 }]}
                    value={captchaKey}
                    onChangeText={setCaptchaKey}
                    placeholder={captchaHasKey ? '•••••••••• (chave salva)' : 'cole a chave do 2Captcha'}
                    placeholderTextColor={COLORS.gray[400]}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Pressable style={[st.saveBtn, (savingCaptcha || !captchaKey.trim()) && { opacity: 0.5 }]} onPress={handleSaveCaptcha} disabled={savingCaptcha || !captchaKey.trim()}>
                    <Text style={st.saveTxt}>{savingCaptcha ? '...' : 'Salvar'}</Text>
                  </Pressable>
                </View>
                <Text style={st.foot}>Necessária só para scrapear portais protegidos por CAPTCHA. Tem custo por resolução (cobrado pelo 2Captcha).</Text>
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

  ddHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  ddVal:      { flex: 1, fontSize: FONTS.base, color: COLORS.gray[900] },
  ddChev:     { fontSize: 12, color: COLORS.gray[500], marginLeft: SPACING.sm },
  ddList:     { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, marginTop: 4, backgroundColor: COLORS.white, overflow: 'hidden' },
  ddItem:     { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  ddItemOn:   { backgroundColor: COLORS.primary + '12' },
  ddItemTxt:  { fontSize: FONTS.base, color: COLORS.gray[700] },
  ddItemTxtOn:{ color: COLORS.primary, fontWeight: '700' },

  statusTxt:  { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: SPACING.md, lineHeight: 18 },
  testTxt:    { fontSize: FONTS.sm, marginTop: SPACING.sm, fontWeight: '700' },
  testOk:     { color: '#16a34a' },
  testErr:    { color: '#dc2626', fontSize: FONTS.sm, marginTop: 4, fontWeight: '600' },
  foot:       { fontSize: 11, color: COLORS.gray[400], marginTop: SPACING.md, lineHeight: 15 },
  divider:    { height: 1, backgroundColor: COLORS.gray[100], marginVertical: SPACING.lg },

  footer:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  testBtn:    { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  testBtnTxt: { color: COLORS.gray[700], fontWeight: '700', fontSize: FONTS.sm },
  cancelBtn:  { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:  { color: COLORS.gray[600], fontWeight: '600' },
  saveBtn:    { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveTxt:    { color: COLORS.white, fontWeight: '700' },
});
