import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { setCompanyTheme } from '../../services/authService';
import { COLORS, FONTS, SPACING, RADIUS, THEME_DEFAULTS } from '../../constants/theme';

// Paleta de atalho — escuros (sidebar), claros (texto) e cores de marca (primária).
const PRESETS = [
  '#0f172a', '#111827', '#1e293b', '#0b1324', '#1a202c', '#312e81',
  '#3b82f6', '#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#dc2626',
  '#f59e0b', '#ffffff', '#e2e8f0', '#94a3b8',
];

const norm = (v: string) => {
  const s = (v || '').trim();
  return s && !s.startsWith('#') ? `#${s}` : s;
};
const isHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(norm(v));

function ColorField({ label, hint, value, onChange }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text style={st.label}>{label}</Text>
      {!!hint && <Text style={st.hint}>{hint}</Text>}
      <View style={st.fieldRow}>
        <View style={[st.swatch, { backgroundColor: isHex(value) ? norm(value) : COLORS.gray[100] }]} />
        <TextInput
          style={st.input}
          value={value}
          onChangeText={(t) => onChange(t)}
          placeholder="#1e293b"
          placeholderTextColor={COLORS.gray[400]}
          autoCapitalize="none"
        />
      </View>
      <View style={st.presets}>
        {PRESETS.map((c) => (
          <Pressable key={c} onPress={() => onChange(c)}>
            <View style={[st.presetSwatch, { backgroundColor: c }, norm(value).toLowerCase() === c && st.presetOn]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function AparenciaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const t = user?.theme || {};
  const [sidebarBg, setSidebarBg]     = useState<string>(t.sidebarBg   || THEME_DEFAULTS.sidebarBg);
  const [sidebarText, setSidebarText] = useState<string>(t.sidebarText || THEME_DEFAULTS.sidebarText);
  const [primary, setPrimary]         = useState<string>(t.primary     || THEME_DEFAULTS.primary);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  const valid = isHex(sidebarBg) && isHex(sidebarText) && isHex(primary);

  const handleSave = async () => {
    if (!user || !valid) { setMsg({ ok: false, text: 'Cores inválidas — use hex, ex.: #1e293b.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await setCompanyTheme(user.companyId, { sidebarBg: norm(sidebarBg), sidebarText: norm(sidebarText), primary: norm(primary) });
      // setCompanyTheme recarrega a página ao aplicar; a msg abaixo raramente é vista.
      setMsg({ ok: true, text: 'Tema salvo. Aplicando…' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Falha ao salvar o tema.' });
      setBusy(false);
    }
  };
  const handleReset = async () => {
    if (!user) return;
    setBusy(true); setMsg(null);
    try { await setCompanyTheme(user.companyId, null); }
    catch (e: any) { setMsg({ ok: false, text: e?.message || 'Falha ao restaurar.' }); setBusy(false); }
  };

  const pBg = isHex(sidebarBg) ? norm(sidebarBg) : THEME_DEFAULTS.sidebarBg;
  const pTx = isHex(sidebarText) ? norm(sidebarText) : THEME_DEFAULTS.sidebarText;
  const pPr = isHex(primary) ? norm(primary) : THEME_DEFAULTS.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={st.overlayBg} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.header}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>Aparência (tema)</Text>
              <Text style={st.sub}>Cores da interface desta empresa — aplicadas a todos os usuários dela</Text>
            </View>
            <Pressable style={st.closeBtn} onPress={onClose}><Text style={st.closeTxt}>✕</Text></Pressable>
          </View>

          <View style={{ flexDirection: 'row' }}>
            {/* Editor */}
            <View style={{ flex: 1, padding: SPACING.lg }}>
              <ColorField label="Cor da sidebar" hint="Fundo da barra lateral" value={sidebarBg} onChange={setSidebarBg} />
              <ColorField label="Texto da sidebar" hint="Cor das letras e ícones da barra lateral" value={sidebarText} onChange={setSidebarText} />
              <ColorField label="Cor primária" hint="Destaque do sistema — botões, links e itens ativos" value={primary} onChange={setPrimary} />
            </View>

            {/* Preview ao vivo da sidebar */}
            <View style={st.previewCol}>
              <Text style={st.previewTitle}>Pré-visualização</Text>
              <View style={[st.preview, { backgroundColor: pBg }]}>
                <Text style={[st.pvLogo, { color: pPr }]}>CRM</Text>
                <View style={[st.pvItem, { backgroundColor: pPr + '22' }]}>
                  <Text style={[st.pvItemTxt, { color: pPr }]}>● Item ativo</Text>
                </View>
                <Text style={[st.pvItemTxtIdle, { color: pTx }]}>○ Dashboard</Text>
                <Text style={[st.pvItemTxtIdle, { color: pTx }]}>○ Contatos</Text>
                <Text style={[st.pvItemTxtIdle, { color: pTx, opacity: 0.6 }]}>○ Configurações</Text>
              </View>
              <View style={[st.pvBtn, { backgroundColor: pPr }]}><Text style={st.pvBtnTxt}>Botão primário</Text></View>
            </View>
          </View>

          {msg && <Text style={[st.msg, msg.ok ? st.msgOk : st.msgErr]}>{msg.text}</Text>}

          <View style={st.footer}>
            <Pressable style={st.resetBtn} onPress={handleReset} disabled={busy}>
              <Text style={st.resetTxt}>Restaurar padrão</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable style={st.cancelBtn} onPress={onClose}><Text style={st.cancelTxt}>Fechar</Text></Pressable>
            <Pressable style={[st.saveBtn, (busy || !valid) && { opacity: 0.6 }]} onPress={handleSave} disabled={busy || !valid}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.saveTxt}>Salvar tema</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { width: '100%', maxWidth: 640, backgroundColor: '#fff', borderRadius: RADIUS.lg, overflow: 'hidden' },
  header:    { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:     { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900] },
  sub:       { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  closeBtn:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeTxt:  { fontSize: FONTS.lg, color: COLORS.gray[500] },

  label:  { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[800] },
  hint:   { fontSize: FONTS.xs, color: COLORS.gray[400], marginBottom: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  swatch: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200] },
  input:  { flex: 1, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 38, color: COLORS.gray[900] },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  presetSwatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: COLORS.gray[200] },
  presetOn: { borderWidth: 2, borderColor: COLORS.gray[900] },

  previewCol:   { width: 200, padding: SPACING.lg, borderLeftWidth: 1, borderLeftColor: COLORS.gray[100] },
  previewTitle: { fontSize: FONTS.xs, color: COLORS.gray[400], marginBottom: SPACING.sm, fontWeight: '600' },
  preview:      { borderRadius: RADIUS.md, padding: SPACING.md, gap: 8 },
  pvLogo:       { fontSize: FONTS.xl, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  pvItem:       { borderRadius: RADIUS.md, paddingVertical: 6, paddingHorizontal: 8 },
  pvItemTxt:    { fontSize: FONTS.sm, fontWeight: '700' },
  pvItemTxtIdle:{ fontSize: FONTS.sm, paddingHorizontal: 8, paddingVertical: 4 },
  pvBtn:        { marginTop: SPACING.md, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center' },
  pvBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: FONTS.sm },

  msg:    { paddingHorizontal: SPACING.lg, fontSize: FONTS.sm },
  msgOk:  { color: COLORS.success },
  msgErr: { color: COLORS.danger },

  footer:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  resetBtn:  { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200] },
  resetTxt:  { color: COLORS.gray[600], fontWeight: '600', fontSize: FONTS.sm },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt: { color: COLORS.gray[600], fontWeight: '600' },
  saveBtn:   { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, minWidth: 110, alignItems: 'center' },
  saveTxt:   { color: '#fff', fontWeight: '700' },
});
