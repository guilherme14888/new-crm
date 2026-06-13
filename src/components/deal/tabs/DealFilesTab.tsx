import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useUIStore } from '../../../stores/uiStore';
import { apiFetch, apiFetchBlob } from '../../../services/api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

interface DealFile { id: string; fileName: string; mimeType: string | null; fileSize: number; kind: string; viewable: boolean; createdAt: string; }

const KIND_LABEL: Record<string, string> = { edital: '📄 Edital', ata: '📜 Ata', outro: '📎 Outros' };
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Aba de arquivos da negociação: lista os documentos (edital/ata/anexos) e abre o PDF no leitor embutido. */
export function DealFilesTab({ dealId }: { dealId: string }) {
  const showToast = useUIStore((s) => s.showToast);
  const [files, setFiles]     = useState<DealFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer]   = useState<{ url: string; name: string; pdf: boolean } | null>(null);
  const [busy, setBusy]       = useState(false);
  const fileInput = useRef<any>(null);

  const load = async () => {
    setLoading(true);
    try { setFiles(await apiFetch<DealFile[]>(`/api/deals/${dealId}/files`)); }
    catch { setFiles([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [dealId]);

  // baixa os bytes (com auth) e abre: PDF no leitor embutido; demais → download
  const open = async (f: DealFile) => {
    setBusy(true);
    try {
      const blob = await apiFetchBlob(`/api/deals/${dealId}/files/${f.id}/content`);
      const url = URL.createObjectURL(blob);
      if (blob.type === 'application/pdf') setViewer({ url, name: f.fileName, pdf: true });
      else if (Platform.OS === 'web') { (window as any).open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    } catch { showToast('Não foi possível abrir o arquivo'); }
    finally { setBusy(false); }
  };
  const closeViewer = () => setViewer((v) => { if (v) URL.revokeObjectURL(v.url); return null; });

  const remove = async (f: DealFile) => {
    if (Platform.OS === 'web' && !window.confirm(`Excluir "${f.fileName}"?`)) return;
    try { await apiFetch(`/api/deals/${dealId}/files/${f.id}`, { method: 'DELETE' }); setFiles((x) => x.filter((y) => y.id !== f.id)); }
    catch { showToast('Erro ao excluir'); }
  };

  // upload manual (web): arquivo → base64 → POST
  const onPick = () => { if (Platform.OS === 'web' && fileInput.current) fileInput.current.click(); };
  const onFile = (e: any) => {
    const file = e.target?.files?.[0]; if (!file) return;
    if (file.size > 3.6 * 1048576) { showToast('Arquivo muito grande (máx. ~3,5 MB no upload manual)'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        await apiFetch(`/api/deals/${dealId}/files`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mime: file.type, dataBase64: reader.result }) });
        await load();
      } catch { showToast('Erro no upload'); } finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (loading) return <View style={st.center}><ActivityIndicator color={COLORS.primary} /></View>;

  const groups: Record<string, DealFile[]> = {};
  for (const f of files) (groups[f.kind] = groups[f.kind] || []).push(f);
  const order = ['edital', 'ata', 'outro'].filter((k) => groups[k]?.length);

  return (
    <View style={{ flex: 1 }}>
      <View style={st.toolbar}>
        <Text style={st.count}>{files.length} arquivo(s)</Text>
        <Pressable style={st.uploadBtn} onPress={onPick} disabled={busy}>
          <Text style={st.uploadTxt}>📎 Anexar</Text>
        </Pressable>
        {Platform.OS === 'web' && React.createElement('input', { ref: fileInput, type: 'file', style: { display: 'none' }, onChange: onFile })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: SPACING.lg }}>
        {files.length === 0 && <Text style={st.empty}>Nenhum arquivo anexado a esta licitação.</Text>}
        {order.map((k) => (
          <View key={k} style={{ marginBottom: SPACING.md }}>
            <Text style={st.groupTitle}>{KIND_LABEL[k] || k}</Text>
            {groups[k].map((f) => (
              <View key={f.id} style={st.row}>
                <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => open(f)}>
                  <Text style={st.name} numberOfLines={1}>{f.fileName}</Text>
                  <Text style={st.sub}>{fmtSize(f.fileSize)}{f.viewable ? ' · PDF' : ''}</Text>
                </Pressable>
                <Pressable style={st.act} onPress={() => open(f)}><Text style={st.actTxt}>{f.viewable ? '👁 Ver' : '⬇ Baixar'}</Text></Pressable>
                <Pressable style={st.act} onPress={() => remove(f)}><Text style={[st.actTxt, { color: COLORS.danger }]}>🗑</Text></Pressable>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Leitor de PDF embutido */}
      {viewer && (
        <View style={st.viewerOverlay}>
          <View style={st.viewerHead}>
            <Text style={st.viewerName} numberOfLines={1}>{viewer.name}</Text>
            <Pressable onPress={closeViewer} style={st.viewerClose}><Text style={st.viewerCloseTxt}>✕</Text></Pressable>
          </View>
          {Platform.OS === 'web'
            ? React.createElement('iframe', { src: viewer.url, style: { width: '100%', height: '100%', border: 'none', flex: 1 }, title: viewer.name })
            : <Text style={st.empty}>Abra no navegador para visualizar.</Text>}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  toolbar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], marginBottom: SPACING.sm },
  count:      { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600' },
  uploadBtn:  { borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  uploadTxt:  { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sm },
  empty:      { fontSize: FONTS.sm, color: COLORS.gray[400], textAlign: 'center', padding: SPACING.xl },
  groupTitle: { fontSize: FONTS.sm, fontWeight: '800', color: COLORS.gray[700], marginBottom: SPACING.xs },
  row:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  name:       { fontSize: FONTS.sm, color: COLORS.gray[900], fontWeight: '600' },
  sub:        { fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 1 },
  act:        { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.gray[50] },
  actTxt:     { fontSize: FONTS.xs, color: COLORS.gray[700], fontWeight: '700' },
  viewerOverlay: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, zIndex: 50, flexDirection: 'column' } as any,
  viewerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  viewerName: { flex: 1, fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[800] },
  viewerClose:{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  viewerCloseTxt: { fontSize: 14, color: COLORS.gray[600], fontWeight: '700' },
});
