import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, ScrollView, Modal, TextInput } from 'react-native';
import { useUIStore } from '../../../stores/uiStore';
import { apiFetch, apiFetchBlob } from '../../../services/api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

interface DealFile {
  id: string; fileName: string; mimeType: string | null; fileSize: number;
  kind: string; viewable: boolean; url?: string | null; source?: string; createdAt: string | null;
}

// Categorias para o seletor (e rótulos). Aceita também categorias livres (fallback).
const CATEGORIES = [
  { key: 'edital',   label: '📄 Edital' },
  { key: 'ata',      label: '📜 Ata' },
  { key: 'proposta', label: '📝 Proposta' },
  { key: 'contrato', label: '📑 Contrato' },
  { key: 'outro',    label: '📎 Outros' },
];
const kindLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label || `📎 ${k.charAt(0).toUpperCase()}${k.slice(1)}`;
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Lista suspensa simples (expande abaixo do cabeçalho).
function Dropdown({ value, options, onChange, placeholder }: {
  value: string; options: { key: string; label: string }[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.key === value);
  return (
    <View style={{ position: 'relative', zIndex: 20 }}>
      <Pressable style={dd.header} onPress={() => setOpen((o) => !o)}>
        <Text style={dd.val} numberOfLines={1}>{sel ? sel.label : (placeholder || 'Selecione')}</Text>
        <Text style={dd.chev}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <View style={dd.list}>
          {options.map((o) => (
            <Pressable key={o.key} style={[dd.item, o.key === value && dd.itemOn]} onPress={() => { onChange(o.key); setOpen(false); }}>
              <Text style={[dd.itemTxt, o.key === value && dd.itemTxtOn]} numberOfLines={1}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Aba de arquivos da negociação: edital/ata do PNCP sempre presentes + uploads/links,
 *  com filtro por categoria e leitor de PDF embutido. */
export function DealFilesTab({ dealId }: { dealId: string }) {
  const showToast = useUIStore((s) => s.showToast);
  const [files, setFiles]     = useState<DealFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer]   = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy]       = useState(false);
  const [filter, setFilter]   = useState('');     // categoria selecionada p/ visualizar ('' = todas)

  // modal de anexar
  const [showUpload, setShowUpload] = useState(false);
  const [upCat, setUpCat]   = useState('edital');
  const [upName, setUpName] = useState('');
  const [upMode, setUpMode] = useState<'file' | 'link'>('file');
  const [upUrl, setUpUrl]   = useState('');
  const [upFile, setUpFile] = useState<{ data: string; name: string; mime: string } | null>(null);
  const fileInput = useRef<any>(null);

  const load = async () => {
    setLoading(true);
    try { setFiles(await apiFetch<DealFile[]>(`/api/deals/${dealId}/files`)); }
    catch { setFiles([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [dealId]);

  // abre: link externo → nova aba; PDF → leitor embutido; demais → download
  const open = async (f: DealFile) => {
    if (f.url) { if (Platform.OS === 'web') (window as any).open(f.url, '_blank'); return; }
    setBusy(true);
    try {
      const blob = await apiFetchBlob(`/api/deals/${dealId}/files/${f.id}/content`);
      const url = URL.createObjectURL(blob);
      if (blob.type === 'application/pdf') setViewer({ url, name: f.fileName });
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

  const resetUpload = () => { setUpCat('edital'); setUpName(''); setUpMode('file'); setUpUrl(''); setUpFile(null); };
  const pickModalFile = () => { if (Platform.OS === 'web' && fileInput.current) fileInput.current.click(); };
  const onModalFile = (e: any) => {
    const file = e.target?.files?.[0]; if (!file) return;
    if (file.size > 3.6 * 1048576) { showToast('Arquivo muito grande (máx. ~3,5 MB no upload).'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      setUpFile({ data: String(reader.result), name: file.name, mime: file.type });
      if (!upName.trim()) setUpName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const submitUpload = async () => {
    setBusy(true);
    try {
      if (upMode === 'link') {
        if (!upUrl.trim()) { showToast('Informe o link externo.'); return; }
        await apiFetch(`/api/deals/${dealId}/files`, {
          method: 'POST',
          body: JSON.stringify({ kind: upCat, name: upName.trim() || upUrl.trim(), url: upUrl.trim() }),
        });
      } else {
        if (!upFile) { showToast('Escolha um arquivo do computador.'); return; }
        await apiFetch(`/api/deals/${dealId}/files`, {
          method: 'POST',
          body: JSON.stringify({ kind: upCat, name: upName.trim() || upFile.name, mime: upFile.mime, dataBase64: upFile.data }),
        });
      }
      setShowUpload(false); resetUpload(); await load();
    } catch (e: any) { showToast(e?.message ?? 'Erro ao anexar'); }
    finally { setBusy(false); }
  };

  if (loading) return <View style={st.center}><ActivityIndicator color={COLORS.primary} /></View>;

  // agrupa por categoria, respeitando o filtro
  const shown = filter ? files.filter((f) => f.kind === filter) : files;
  const groups: Record<string, DealFile[]> = {};
  for (const f of shown) (groups[f.kind] = groups[f.kind] || []).push(f);
  const order = [...CATEGORIES.map((c) => c.key), ...Object.keys(groups).filter((k) => !CATEGORIES.some((c) => c.key === k))]
    .filter((k) => groups[k]?.length);

  const filterOptions = [{ key: '', label: 'Todas as categorias' }, ...CATEGORIES];

  return (
    <View style={{ flex: 1 }}>
      <View style={st.toolbar}>
        <View style={{ width: 200 }}>
          <Dropdown value={filter} options={filterOptions} onChange={setFilter} placeholder="Todas as categorias" />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={st.count}>{shown.length} arquivo(s)</Text>
        <Pressable style={st.uploadBtn} onPress={() => { resetUpload(); setShowUpload(true); }} disabled={busy}>
          <Text style={st.uploadTxt}>📎 Anexar</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: SPACING.lg }}>
        {shown.length === 0 && <Text style={st.empty}>Nenhum arquivo nesta categoria.</Text>}
        {order.map((k) => (
          <View key={k} style={{ marginBottom: SPACING.md }}>
            <Text style={st.groupTitle}>{kindLabel(k)}</Text>
            {groups[k].map((f) => (
              <View key={f.id} style={st.row}>
                <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => open(f)}>
                  <Text style={st.name} numberOfLines={1}>{f.fileName}</Text>
                  <Text style={st.sub} numberOfLines={1}>
                    {f.source === 'pncp' ? 'PNCP' : f.url ? '🔗 link externo' : fmtSize(f.fileSize)}
                    {f.viewable ? ' · PDF' : ''}
                  </Text>
                </Pressable>
                <Pressable style={st.act} onPress={() => open(f)}>
                  <Text style={st.actTxt}>{f.url ? '🔗 Abrir' : f.viewable ? '👁 Ver' : '⬇ Baixar'}</Text>
                </Pressable>
                {f.source !== 'pncp' && (
                  <Pressable style={st.act} onPress={() => remove(f)}><Text style={[st.actTxt, { color: COLORS.danger }]}>🗑</Text></Pressable>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Modal: anexar arquivo (categoria + nome + arquivo OU link) */}
      <Modal visible={showUpload} transparent animationType="fade" onRequestClose={() => setShowUpload(false)}>
        <View style={st.mOverlay}>
          <Pressable style={st.mBackdrop} onPress={() => setShowUpload(false)} />
          <View style={st.mSheet}>
            <Text style={st.mTitle}>Anexar arquivo</Text>

            <Text style={st.label}>Categoria do documento</Text>
            <Dropdown value={upCat} options={CATEGORIES} onChange={setUpCat} />

            <Text style={[st.label, { marginTop: SPACING.md }]}>Nome do arquivo</Text>
            <TextInput style={st.input} value={upName} onChangeText={setUpName} placeholder="ex.: Edital nº 002482/2026" placeholderTextColor={COLORS.gray[400]} />

            <Text style={[st.label, { marginTop: SPACING.md }]}>Origem</Text>
            <View style={st.segment}>
              {(['file', 'link'] as const).map((m) => (
                <Pressable key={m} style={[st.segBtn, upMode === m && st.segBtnOn]} onPress={() => setUpMode(m)}>
                  <Text style={[st.segTxt, upMode === m && st.segTxtOn]}>{m === 'file' ? '💻 Do computador' : '🔗 Link externo'}</Text>
                </Pressable>
              ))}
            </View>

            {upMode === 'file' ? (
              <View style={{ marginTop: SPACING.sm }}>
                <Pressable style={st.pickBtn} onPress={pickModalFile}>
                  <Text style={st.pickTxt}>{upFile ? `✓ ${upFile.name}` : 'Escolher arquivo…'}</Text>
                </Pressable>
                <Text style={st.hint}>Máx. ~3,5 MB. PDFs abrem no leitor embutido.</Text>
                {Platform.OS === 'web' && React.createElement('input', { ref: fileInput, type: 'file', style: { display: 'none' }, onChange: onModalFile })}
              </View>
            ) : (
              <View style={{ marginTop: SPACING.sm }}>
                <TextInput style={st.input} value={upUrl} onChangeText={setUpUrl} placeholder="https://…" placeholderTextColor={COLORS.gray[400]} autoCapitalize="none" />
                <Text style={st.hint}>O arquivo abre direto no link informado.</Text>
              </View>
            )}

            <View style={st.mBtns}>
              <Pressable style={st.cancelBtn} onPress={() => setShowUpload(false)}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
              <Pressable style={[st.saveBtn, busy && { opacity: 0.5 }]} onPress={submitUpload} disabled={busy}>
                <Text style={st.saveTxt}>{busy ? 'Anexando…' : 'Anexar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

const dd = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 6, backgroundColor: COLORS.white, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  val:  { flex: 1, fontSize: FONTS.sm, color: COLORS.gray[800] },
  chev: { fontSize: 11, color: COLORS.gray[500], marginLeft: SPACING.sm },
  list: { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, marginTop: 4, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, backgroundColor: COLORS.white, overflow: 'hidden', zIndex: 30, ...(Platform.OS === 'web' ? { boxShadow: '0 6px 18px rgba(0,0,0,0.12)' } as any : { elevation: 6 }) },
  item: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  itemOn: { backgroundColor: COLORS.primary + '12' },
  itemTxt: { fontSize: FONTS.sm, color: COLORS.gray[700] },
  itemTxtOn: { color: COLORS.primary, fontWeight: '700' },
});

const st = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  toolbar:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], marginBottom: SPACING.sm, zIndex: 20 },
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

  mOverlay:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mBackdrop:  { position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' } as any,
  mSheet:     { width: 460, maxWidth: '92%' as any, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl },
  mTitle:     { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900], marginBottom: SPACING.md },
  label:      { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: 4 },
  hint:       { fontSize: 11, color: COLORS.gray[400], marginTop: 4 },
  input:      { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white },
  segment:    { flexDirection: 'row', gap: SPACING.sm },
  segBtn:     { flex: 1, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  segBtnOn:   { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  segTxt:     { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
  segTxtOn:   { color: COLORS.primary, fontWeight: '800' },
  pickBtn:    { borderWidth: 1, borderStyle: 'dashed' as any, borderColor: COLORS.gray[300], borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  pickTxt:    { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '600' },
  mBtns:      { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn:  { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:  { color: COLORS.gray[600], fontWeight: '600' },
  saveBtn:    { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveTxt:    { color: COLORS.white, fontWeight: '700' },

  viewerOverlay: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, zIndex: 50, flexDirection: 'column' } as any,
  viewerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  viewerName: { flex: 1, fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[800] },
  viewerClose:{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  viewerCloseTxt: { fontSize: 14, color: COLORS.gray[600], fontWeight: '700' },
});
