import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, Image, ActivityIndicator, Platform } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { setCompanyLogo } from '../../services/authService';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const MASTER = '00000000-0000-0000-0000-000000000001';

// Abre o seletor de arquivo (web), reduz a imagem p/ no máx. 320px e devolve um
// data URL PNG leve — mantém o logo pequeno (poucos KB) p/ trafegar no /me.
function pickAndResizeWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        const img = new (window as any).Image();
        img.onload = () => {
          const max = 320;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(String(reader.result));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(String(reader.result));
        img.src = String(reader.result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export function CompanyLogoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [logo, setLogo] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setLogo(user?.companyLogo ?? null);
      setUrlInput('');
      setMsg(null);
    }
  }, [visible]);

  const isMaster = user?.companyId === MASTER;
  const companyName = user?.companyName || 'empresa';

  const handlePick = async () => {
    const data = await pickAndResizeWeb();
    if (data) { setLogo(data); setMsg(null); }
  };
  const handleUseUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) { setMsg({ ok: false, text: 'A URL deve começar com http:// ou https://' }); return; }
    setLogo(u); setMsg(null);
  };

  const handleSave = async () => {
    if (!user) return;
    setBusy(true); setMsg(null);
    try {
      await setCompanyLogo(user.companyId, logo || null);
      setMsg({ ok: true, text: 'Logo salvo. A barra lateral já foi atualizada.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Falha ao salvar o logo.' });
    } finally { setBusy(false); }
  };
  const handleRemove = async () => {
    if (!user) return;
    setBusy(true); setMsg(null);
    try {
      await setCompanyLogo(user.companyId, null);
      setLogo(null);
      setMsg({ ok: true, text: 'Logo removido.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Falha ao remover.' });
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={st.overlayBg} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.header}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>Logo da empresa</Text>
              <Text style={st.sub}>{isMaster ? 'Empresa Default — aparece na sidebar e como miniatura nas filhas' : companyName}</Text>
            </View>
            <Pressable style={st.closeBtn} onPress={onClose}><Text style={st.closeTxt}>✕</Text></Pressable>
          </View>

          <View style={{ padding: SPACING.lg }}>
            {/* Preview */}
            <View style={st.previewBox}>
              {logo ? (
                <View style={{ position: 'relative' }}>
                  <Image source={{ uri: logo }} style={st.previewImg} resizeMode="contain" />
                  {!isMaster && user?.masterLogo ? (
                    <Image source={{ uri: user.masterLogo }} style={st.previewBadge} resizeMode="contain" />
                  ) : null}
                </View>
              ) : (
                <Text style={st.previewEmpty}>Sem logo — será usado o texto padrão</Text>
              )}
            </View>
            {!isMaster && (
              <Text style={st.hint}>O logo da Default aparece como miniatura no canto superior direito.</Text>
            )}

            {/* Upload (web) */}
            {Platform.OS === 'web' && (
              <Pressable style={st.pickBtn} onPress={handlePick} disabled={busy}>
                <Text style={st.pickBtnTxt}>📁 Escolher imagem do computador</Text>
              </Pressable>
            )}

            {/* URL */}
            <Text style={st.label}>…ou cole uma URL de imagem</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <TextInput
                style={[st.input, { flex: 1 }]}
                placeholder="https://…/logo.png"
                placeholderTextColor={COLORS.gray[400]}
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
              />
              <Pressable style={st.urlBtn} onPress={handleUseUrl} disabled={busy}>
                <Text style={st.urlBtnTxt}>Usar</Text>
              </Pressable>
            </View>

            {msg && (
              <Text style={[st.msg, msg.ok ? st.msgOk : st.msgErr]}>{msg.text}</Text>
            )}

            {/* Ações */}
            <View style={st.actions}>
              <Pressable style={st.removeBtn} onPress={handleRemove} disabled={busy || !user?.companyLogo}>
                <Text style={st.removeTxt}>Remover</Text>
              </Pressable>
              <Pressable style={[st.saveBtn, busy && { opacity: 0.6 }]} onPress={handleSave} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.saveTxt}>Salvar logo</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: RADIUS.lg, overflow: 'hidden' },
  header:    { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:     { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900] },
  sub:       { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  closeBtn:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeTxt:  { fontSize: FONTS.lg, color: COLORS.gray[500] },

  // Fundo na MESMA cor da sidebar (navy) — assim o preview mostra o resultado real:
  // um PNG transparente mescla; um PNG com fundo branco aparece com a caixa branca.
  previewBox:  { minHeight: 96, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[700],
                 backgroundColor: COLORS.gray[900], alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  previewImg:  { width: 200, height: 64 },
  previewBadge:{ position: 'absolute', top: -8, left: -8, width: 34, height: 34, backgroundColor: 'transparent' },
  previewEmpty:{ fontSize: FONTS.sm, color: COLORS.gray[400] },
  hint:        { fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: SPACING.xs },

  pickBtn:    { marginTop: SPACING.lg, backgroundColor: COLORS.gray[100], borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  pickBtnTxt: { color: COLORS.gray[800], fontWeight: '600' },

  label:   { fontSize: FONTS.sm, color: COLORS.gray[600], marginTop: SPACING.lg, marginBottom: SPACING.xs },
  input:   { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 40, color: COLORS.gray[900] },
  urlBtn:  { backgroundColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, justifyContent: 'center' },
  urlBtnTxt:{ color: COLORS.gray[800], fontWeight: '600' },

  msg:     { marginTop: SPACING.md, fontSize: FONTS.sm },
  msgOk:   { color: COLORS.success ?? '#16a34a' },
  msgErr:  { color: COLORS.danger ?? '#dc2626' },

  actions:  { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  removeBtn:{ flex: 1, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[200] },
  removeTxt:{ color: COLORS.gray[600], fontWeight: '600' },
  saveBtn:  { flex: 2, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  saveTxt:  { color: '#fff', fontWeight: '700' },
});
