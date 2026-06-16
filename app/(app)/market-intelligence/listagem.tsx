import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  useWindowDimensions, Platform, TextInput,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { useMarketIntelStore, MarketIntelRow } from '../../../src/stores/marketIntelStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { apiFetch, apiFetchBlob } from '../../../src/services/api';

/** Um snapshot da linha do tempo da licitação (transição de status/vencedor/preço). */
interface HistoryEntry {
  status: string | null; encerramento: string | null; etapaSessao: string | null;
  posicao: number | null; concorrente: string | null; cnpjConcorrente: string | null;
  precoFinalUnit: number | null; precoFinalTotal: number | null;
  snapshotAt: string | null; runDate: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
//  Inteligência de Mercado — Listagem
//  Lista TODAS as licitações da empresa (tabela market_intelligence) com busca
//  ao vivo em todas as colunas e um drawer lateral de filtros multi-seleção.
// ════════════════════════════════════════════════════════════════════════════

const BRAND = '#7b2d8e';
const ACCENT = '#c9a227';
const PAGE_SIZE = 20;   // registros por página na listagem

// ─── Helpers de formatação ────────────────────────────────────────────────────
const fmtBRL = (n: number | null) =>
  n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(iso: string | null) {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

// dd/mm/aaaa a partir de "aaaa-mm-dd"
function fmtBRdate(d: string) {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

// ─── Colunas da tabela (todas as colunas relevantes de market_intelligence) ───
type Col = { key: keyof MarketIntelRow; label: string; w: number; fmt?: (r: MarketIntelRow) => string; right?: boolean };
const COLUMNS: Col[] = [
  { key: 'status',            label: 'Status',              w: 120 },
  { key: 'uf',                label: 'UF',                  w: 48 },
  { key: 'municipio',         label: 'Cidade',              w: 150 },
  { key: 'regiao',            label: 'Região',              w: 110 },
  { key: 'licitador',         label: 'Órgão / Licitador',   w: 260 },
  { key: 'cnpj',              label: 'CNPJ Órgão',          w: 150 },
  { key: 'nEdital',           label: 'Nº Edital',           w: 110 },
  { key: 'nProcesso',         label: 'Nº Processo',         w: 170 },
  { key: 'modalidade',        label: 'Modalidade',          w: 150 },
  { key: 'tipoContratacao',   label: 'Tipo',                w: 150 },
  { key: 'dataHoraCertame',   label: 'Data Certame',        w: 120, fmt: (r) => fmtDate(r.dataHoraCertame) },
  { key: 'prazoEdital',       label: 'Prazo Edital',        w: 120, fmt: (r) => fmtDate(r.prazoEdital) },
  { key: 'etapaSessao',       label: 'Etapa Sessão',        w: 150 },
  { key: 'etapaItem',         label: 'Etapa Item',          w: 150 },
  { key: 'encerramento',      label: 'Situação Abertura',   w: 180 },
  { key: 'lote',              label: '#Lote',               w: 60, fmt: (r) => (r.lote == null ? '' : String(r.lote)), right: true },
  { key: 'item',              label: '#Item',               w: 60, fmt: (r) => (r.item == null ? '' : String(r.item)), right: true },
  { key: 'produtoCandidato',  label: 'Produto Candidato',   w: 150 },
  { key: 'produto',           label: 'Produto (termo)',     w: 150 },
  { key: 'produtoLicitado',   label: 'Produto Licitado',    w: 320 },
  { key: 'quantidade',        label: 'Qtde',                w: 80, fmt: (r) => (r.quantidade == null ? '' : r.quantidade.toLocaleString('pt-BR')), right: true },
  { key: 'unidadeOriginal',   label: 'Unidade',             w: 90 },
  { key: 'meEpp',             label: 'ME/EPP',              w: 80 },
  { key: 'mandadoJudicial',   label: 'MJ?',                 w: 60 },
  { key: 'precoEstimadoUnit', label: 'Preço Est. Unit.',    w: 130, fmt: (r) => fmtBRL(r.precoEstimadoUnit), right: true },
  { key: 'precoEstimadoTotal',label: 'Preço Est. Total',    w: 140, fmt: (r) => fmtBRL(r.precoEstimadoTotal), right: true },
  { key: 'posicao',           label: '#Pos.',               w: 60, fmt: (r) => (r.posicao == null ? '' : String(r.posicao)), right: true },
  { key: 'concorrente',       label: 'Concorrente',         w: 250 },
  { key: 'cnpjConcorrente',   label: 'CNPJ Concorrente',    w: 150 },
  { key: 'ufConcorrente',     label: 'UF Conc.',            w: 70 },
  { key: 'precoFinalUnit',    label: 'Preço Final Unit.',   w: 130, fmt: (r) => fmtBRL(r.precoFinalUnit), right: true },
  { key: 'precoFinalTotal',   label: 'Preço Final Total',   w: 140, fmt: (r) => fmtBRL(r.precoFinalTotal), right: true },
  { key: 'nomeSite',          label: 'Portal',              w: 90 },
  { key: 'urlSite',           label: 'URL',                 w: 260 },
];
const ACTION_W = 76;   // coluna de ações por linha (🕑 histórico + 📄 documentos)
const TABLE_W = COLUMNS.reduce((s, c) => s + c.w, 0) + 16 + ACTION_W;

const cellText = (r: MarketIntelRow, c: Col) => (c.fmt ? c.fmt(r) : (r[c.key] == null ? '' : String(r[c.key])));

// Texto pesquisável de uma linha = concatenação de TODAS as colunas da tabela.
function searchBlob(r: MarketIntelRow): string {
  const parts: string[] = [];
  for (const k in r) {
    const v = (r as any)[k];
    if (v != null && v !== '') parts.push(String(v));
  }
  return parts.join(' ').toLowerCase();
}

// ─── Drawer de multi-seleção (dropdown accordion: só um aberto por vez) ────────
function MultiSelect({
  label, options, selected, onToggle, open, onToggleOpen,
}: {
  label: string; options: string[]; selected: Set<string>; onToggle: (v: string) => void;
  open: boolean; onToggleOpen: () => void;
}) {
  const [q, setQ] = useState('');
  const CAP = 100;
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const filtered = matches.slice(0, CAP);
  // limpa a busca ao fechar o grupo
  useEffect(() => { if (!open) setQ(''); }, [open]);

  return (
    <View style={[dw.group, open && dw.groupOpen]}>
      <Pressable style={dw.groupHead} onPress={onToggleOpen}>
        <Text style={dw.groupTitle}>{label}</Text>
        <Text style={[dw.groupCount, selected.size > 0 && dw.groupCountActive]}>
          {selected.size > 0 ? `${selected.size} selec.` : `${options.length}`} {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open && (
        <View style={dw.panel}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={`Buscar ${label.toLowerCase()}…`}
            placeholderTextColor={COLORS.gray[400]}
            style={dw.search}
          />
          {/* ScrollView com altura limitada → rola dentro do dropdown, sem cobrir os filtros abaixo */}
          <ScrollView style={dw.optList} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            {filtered.length === 0 && <Text style={dw.emptyOpt}>Nenhuma opção.</Text>}
            {filtered.map((o) => {
              const on = selected.has(o);
              return (
                <Pressable key={o} style={dw.optRow} onPress={() => onToggle(o)}>
                  <View style={[dw.checkbox, on && dw.checkboxOn]}>{on && <Text style={dw.checkTxt}>✓</Text>}</View>
                  <Text style={[dw.optTxt, on && dw.optTxtOn]} numberOfLines={1}>{o}</Text>
                </Pressable>
              );
            })}
            {matches.length > CAP && (
              <Text style={dw.moreHint}>+{matches.length - CAP} — use a busca acima para refinar</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function MarketIntelligenceListagem() {
  const { width, height } = useWindowDimensions();
  const narrow = width < 760;
  const rows      = useMarketIntelStore((s) => s.rows);
  const isLoading = useMarketIntelStore((s) => s.isLoading);
  const loaded    = useMarketIntelStore((s) => s.loaded);
  const loadRows  = useMarketIntelStore((s) => s.loadRows);
  const companyId = useAuthStore((s) => s.user?.companyId);

  useEffect(() => { loadRows(companyId); }, [companyId]);

  // Busca ao vivo (aplicada imediatamente).
  const [search, setSearch] = useState('');

  // Página atual da listagem (20 registros por página).
  const [page, setPage] = useState(1);

  // Ordenação por coluna (clique no cabeçalho alterna crescente/decrescente).
  const [sort, setSort] = useState<{ key: keyof MarketIntelRow; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (key: keyof MarketIntelRow) =>
    setSort((prev) => (prev && prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }));

  // Drawer aberto/fechado.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Qual grupo de filtro está aberto no drawer (accordion: só um por vez).
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Histórico (linha do tempo) de uma licitação — modal sob demanda.
  const [histRow, setHistRow] = useState<MarketIntelRow | null>(null);
  const [hist, setHist] = useState<HistoryEntry[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const openHistory = async (r: MarketIntelRow) => {
    setHistRow(r); setHist(null); setHistLoading(true);
    try { setHist(await apiFetch<HistoryEntry[]>(`/api/market-intelligence/${r.id}/history`)); }
    catch { setHist([]); }
    finally { setHistLoading(false); }
  };

  // Documentos (edital/ata) — modal com leitor de PDF embutido.
  type DocFile = { idx: number; name: string; size: number; mime: string; viewable: boolean };
  const [docRow, setDocRow]       = useState<MarketIntelRow | null>(null);
  const [docAvail, setDocAvail]   = useState<{ edital: boolean; ata: boolean } | null>(null);
  const [docTab, setDocTab]       = useState<'edital' | 'ata'>('edital');
  const [docFiles, setDocFiles]   = useState<DocFile[]>([]);
  const [docFileIdx, setDocFileIdx] = useState(0);
  const [docUrl, setDocUrl]       = useState<string | null>(null);
  const [docIsPdf, setDocIsPdf]   = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError]   = useState('');

  // libera o object URL anterior (evita vazamento de memória)
  const revokeDocUrl = () => setDocUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });

  // baixa e exibe um arquivo específico (idx) do documento
  const loadFile = async (row: MarketIntelRow, tipo: 'edital' | 'ata', idx: number) => {
    setDocFileIdx(idx); setDocError(''); setDocLoading(true); revokeDocUrl();
    try {
      const blob = await apiFetchBlob(`/api/market-intelligence/${row.id}/doc/${tipo}/file/${idx}`);
      setDocIsPdf(blob.type === 'application/pdf');
      setDocUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setDocError(e?.message ?? 'Não foi possível carregar o documento.');
    } finally { setDocLoading(false); }
  };

  // lista os arquivos de um documento (edital/ata) e abre o principal
  const loadDoc = async (row: MarketIntelRow, tipo: 'edital' | 'ata') => {
    setDocTab(tipo); setDocError(''); setDocLoading(true); setDocFiles([]); revokeDocUrl();
    try {
      const { files } = await apiFetch<{ files: DocFile[] }>(`/api/market-intelligence/${row.id}/doc/${tipo}`);
      setDocFiles(files);
      if (!files.length) { setDocError('Documento indisponível no PNCP.'); setDocLoading(false); return; }
      // escolhe o principal: nome que parece o edital/ata; senão o 1º PDF; senão o 1º
      const pref = files.find((f) => new RegExp(tipo, 'i').test(f.name)) || files.find((f) => f.viewable) || files[0];
      await loadFile(row, tipo, pref.idx);
    } catch (e: any) {
      setDocError(e?.message ?? 'Erro ao carregar documentos.'); setDocLoading(false);
    }
  };

  const openDocs = async (r: MarketIntelRow) => {
    setDocRow(r); setDocAvail(null); setDocFiles([]); setDocError(''); revokeDocUrl();
    try {
      const avail = await apiFetch<{ edital: boolean; ata: boolean }>(`/api/market-intelligence/${r.id}/docs`);
      setDocAvail(avail);
      if (avail.edital) loadDoc(r, 'edital');
      else if (avail.ata) loadDoc(r, 'ata');
    } catch { setDocAvail({ edital: false, ata: false }); }
  };

  const closeDocs = () => { revokeDocUrl(); setDocRow(null); setDocAvail(null); setDocFiles([]); setDocError(''); };

  // Estado de RASCUNHO dos filtros (editado no drawer, comitado em "Filtrar").
  const [dFrom, setDFrom]       = useState('');
  const [dTo, setDTo]           = useState('');
  const [dCidade, setDCidade]   = useState<Set<string>>(new Set());
  const [dUf, setDUf]           = useState<Set<string>>(new Set());
  const [dOrgao, setDOrgao]     = useState<Set<string>>(new Set());
  const [dProc, setDProc]       = useState<Set<string>>(new Set());
  const [dProduto, setDProduto] = useState<Set<string>>(new Set());

  // Estado APLICADO (o que de fato filtra a tabela).
  const [applied, setApplied] = useState({
    from: '', to: '',
    cidade: new Set<string>(), uf: new Set<string>(), orgao: new Set<string>(),
    proc: new Set<string>(), produto: new Set<string>(),
  });

  // ── Opções de filtro (distintas, vindas da base carregada) ──────────────────
  const options = useMemo(() => {
    const uniq = (sel: (r: MarketIntelRow) => string | null) =>
      Array.from(new Set(rows.map(sel).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      cidade:  uniq((r) => r.municipio),
      uf:      uniq((r) => r.uf),
      orgao:   uniq((r) => r.licitador),
      proc:    uniq((r) => r.nProcesso),
      produto: uniq((r) => r.produtoCandidato ?? r.produto),
    };
  }, [rows]);

  // ── Linhas filtradas (busca + filtros aplicados) ────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to, cidade, uf, orgao, proc, produto } = applied;
    return rows.filter((r) => {
      if (uf.size && !(r.uf && uf.has(r.uf))) return false;
      if (cidade.size && !(r.municipio && cidade.has(r.municipio))) return false;
      if (orgao.size && !(r.licitador && orgao.has(r.licitador))) return false;
      if (proc.size && !(r.nProcesso && proc.has(r.nProcesso))) return false;
      if (produto.size) {
        const p = r.produtoCandidato ?? r.produto;
        if (!(p && produto.has(p))) return false;
      }
      if (from || to) {
        const d = (r.dataHoraCertame || '').slice(0, 10);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (q && !searchBlob(r).includes(q)) return false;
      return true;
    });
  }, [rows, search, applied]);

  const activeFilterCount =
    (applied.from || applied.to ? 1 : 0) +
    applied.cidade.size + applied.uf.size + applied.orgao.size + applied.proc.size + applied.produto.size;

  // ── Ordenação (colunas right=numéricas; vazios sempre por último) ────────────
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = COLUMNS.find((c) => c.key === sort.key);
    const num = !!col?.right;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      const ae = av == null || av === '', be = bv == null || bv === '';
      if (ae && be) return 0;
      if (ae) return 1;     // vazios no fim, independentemente da direção
      if (be) return -1;
      const cmp = num
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
      return cmp * dir;
    });
  }, [filtered, sort]);

  // ── Paginação (20 por página) ────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // volta à 1ª página sempre que a busca/filtros/ordem mudam o conjunto de resultados
  useEffect(() => { setPage(1); }, [search, applied, sort]);
  // mantém a página dentro do intervalo válido se o total diminuir
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage]
  );

  // ── Ações ────────────────────────────────────────────────────────────────────
  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (v: string) =>
    setter((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });

  // abre o drawer carregando o rascunho com o que está aplicado
  const openDrawer = () => {
    setDFrom(applied.from); setDTo(applied.to);
    setDCidade(new Set(applied.cidade)); setDUf(new Set(applied.uf));
    setDOrgao(new Set(applied.orgao)); setDProc(new Set(applied.proc));
    setDProduto(new Set(applied.produto));
    setOpenFilter(null);
    setDrawerOpen(true);
  };

  const applyFilters = () => {
    setApplied({
      from: dFrom, to: dTo,
      cidade: new Set(dCidade), uf: new Set(dUf), orgao: new Set(dOrgao),
      proc: new Set(dProc), produto: new Set(dProduto),
    });
    setDrawerOpen(false);
  };

  // zera todos os filtros (rascunho + aplicado)
  const clearFilters = () => {
    setDFrom(''); setDTo('');
    setDCidade(new Set()); setDUf(new Set()); setDOrgao(new Set());
    setDProc(new Set()); setDProduto(new Set());
    setApplied({ from: '', to: '', cidade: new Set(), uf: new Set(), orgao: new Set(), proc: new Set(), produto: new Set() });
  };

  // ── Loading / vazio ──────────────────────────────────────────────────────────
  if (isLoading && !loaded) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={s.centerTxt}>Carregando licitações…</Text>
      </View>
    );
  }
  if (loaded && rows.length === 0) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48, marginBottom: SPACING.md }}>📋</Text>
        <Text style={s.centerTxt}>Nenhuma licitação cadastrada para esta empresa.</Text>
      </View>
    );
  }

  const WebInput: any = 'input';
  const dateWebStyle: any = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.gray[200]}`, borderRadius: 6, padding: '7px 9px', fontSize: 13, color: COLORS.gray[700], outline: 'none', cursor: 'pointer' };
  const isWeb = Platform.OS === 'web';
  // abre o calendário nativo ao clicar em qualquer parte do campo de data
  const openPicker = (e: any) => { try { e.currentTarget.showPicker && e.currentTarget.showPicker(); } catch { /* ignora */ } };

  return (
    <View style={s.screen}>
      {/* ─── Cabeçalho: título + busca + botão de filtro ───────────────────── */}
      <View style={[s.header, narrow && s.headerNarrow]}>
        <View style={s.titleBlock}>
          <Text style={s.kicker}>INTELIGÊNCIA DE MERCADO</Text>
          <Text style={s.title}>Listagem de Licitações</Text>
        </View>

        <View style={[s.searchWrap, narrow && { flexBasis: '100%' as any }]}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Pesquisar em todas as colunas…"
            placeholderTextColor={COLORS.gray[400]}
            style={s.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={s.searchClear}>
              <Text style={s.searchClearTxt}>✕</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]} onPress={openDrawer}>
          <Text style={s.filterBtnIcon}>⚙</Text>
          <Text style={[s.filterBtnTxt, activeFilterCount > 0 && s.filterBtnTxtActive]}>Filtros</Text>
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeTxt}>{activeFilterCount}</Text></View>
          )}
        </Pressable>
      </View>

      {/* ─── Barra de contagem ─────────────────────────────────────────────── */}
      <View style={s.countBar}>
        <Text style={s.countTxt}>
          {filtered.length.toLocaleString('pt-BR')} de {rows.length.toLocaleString('pt-BR')} linhas
          {activeFilterCount > 0 || search ? ' (filtrado)' : ''}
        </Text>
        {(activeFilterCount > 0 || search) && (
          <Pressable onPress={() => { clearFilters(); setSearch(''); }}>
            <Text style={s.countClear}>Limpar tudo</Text>
          </Pressable>
        )}
      </View>

      {/* ─── Tabela (scroll horizontal + virtualização vertical) ───────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={s.tableScroll} contentContainerStyle={{ minWidth: TABLE_W }}>
        <View style={{ minWidth: TABLE_W, flex: 1 }}>
          {/* header */}
          <View style={s.headRow}>
            <Text style={[s.th, { width: ACTION_W, textAlign: 'center' as any }]}>Ações</Text>
            {COLUMNS.map((c) => {
              const active = sort?.key === c.key;
              const arrow = active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕';
              return (
                <Pressable
                  key={String(c.key)}
                  onPress={() => toggleSort(c.key)}
                  style={[s.thCell, { width: c.w }, c.right && { justifyContent: 'flex-end' as any }]}
                  {...({ title: `Ordenar por ${c.label}` } as any)}
                >
                  <Text style={[s.th, active && s.thActive]} numberOfLines={1}>{c.label}</Text>
                  <Text style={active ? s.thArrowActive : s.thArrow}>{arrow}</Text>
                </Pressable>
              );
            })}
          </View>
          {/* corpo — apenas os 20 registros da página atual */}
          {filtered.length === 0 ? (
            <Text style={s.empty}>Nenhuma linha para a busca/filtros selecionados.</Text>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
              {pageRows.map((r, index) => (
                <View key={r.id} style={[s.row, index % 2 === 1 && s.rowAlt]}>
                  <View style={s.actionsCell}>
                    <Pressable onPress={() => openHistory(r)} style={s.actionBtn} {...({ title: 'Histórico' } as any)}>
                      <Text style={s.histIcon}>🕑</Text>
                    </Pressable>
                    <Pressable onPress={() => openDocs(r)} style={s.actionBtn} {...({ title: 'Edital / Ata (PDF)' } as any)}>
                      <Text style={s.histIcon}>📄</Text>
                    </Pressable>
                  </View>
                  {COLUMNS.map((c) => {
                    const txt = cellText(r, c);
                    const isUrl = c.key === 'urlSite' && !!txt;
                    return (
                      <Text
                        key={String(c.key)}
                        style={[s.td, { width: c.w }, c.right && { textAlign: 'right' as any }, isUrl && s.tdLink]}
                        numberOfLines={1}
                        {...(isUrl ? ({ onPress: () => Platform.OS === 'web' && (window as any).open(txt, '_blank') } as any) : {})}
                      >
                        {txt || '—'}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* ─── Paginação ─────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <View style={s.pagination}>
          <Text style={s.pageInfo}>
            {((safePage - 1) * PAGE_SIZE + 1).toLocaleString('pt-BR')}–
            {Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString('pt-BR')} de {filtered.length.toLocaleString('pt-BR')}
          </Text>
          <View style={s.pageControls}>
            <Pressable
              style={[s.pageBtn, safePage <= 1 && s.pageBtnDisabled]}
              disabled={safePage <= 1}
              onPress={() => setPage(1)}
            >
              <Text style={[s.pageBtnTxt, safePage <= 1 && s.pageBtnTxtDisabled]}>«</Text>
            </Pressable>
            <Pressable
              style={[s.pageBtn, safePage <= 1 && s.pageBtnDisabled]}
              disabled={safePage <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Text style={[s.pageBtnTxt, safePage <= 1 && s.pageBtnTxtDisabled]}>‹ Anterior</Text>
            </Pressable>
            <Text style={s.pageCurrent}>Página {safePage} de {totalPages}</Text>
            <Pressable
              style={[s.pageBtn, safePage >= totalPages && s.pageBtnDisabled]}
              disabled={safePage >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={[s.pageBtnTxt, safePage >= totalPages && s.pageBtnTxtDisabled]}>Próxima ›</Text>
            </Pressable>
            <Pressable
              style={[s.pageBtn, safePage >= totalPages && s.pageBtnDisabled]}
              disabled={safePage >= totalPages}
              onPress={() => setPage(totalPages)}
            >
              <Text style={[s.pageBtnTxt, safePage >= totalPages && s.pageBtnTxtDisabled]}>»</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Drawer lateral direito de filtros ─────────────────────────────── */}
      {drawerOpen && (
        <>
          <Pressable style={s.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          <View style={[s.drawer, { width: narrow ? Math.min(width - 40, 360) : 380 }]}>
            <View style={s.drawerHead}>
              <Text style={s.drawerTitle}>Filtros</Text>
              <Pressable onPress={() => setDrawerOpen(false)} style={s.drawerClose}>
                <Text style={s.drawerCloseTxt}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={s.drawerBody} showsVerticalScrollIndicator>
              {/* Data (range) */}
              <View style={dw.group}>
                <Text style={dw.groupTitle}>Data do Certame</Text>
                <View style={dw.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={dw.dateLbl}>De</Text>
                    {isWeb
                      ? <WebInput type="date" value={dFrom} onChange={(e: any) => setDFrom(e.target.value)} onClick={openPicker} onFocus={openPicker} style={dateWebStyle} />
                      : <TextInput value={dFrom} onChangeText={setDFrom} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.gray[400]} style={dw.dateInput} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dw.dateLbl}>Até</Text>
                    {isWeb
                      ? <WebInput type="date" value={dTo} onChange={(e: any) => setDTo(e.target.value)} onClick={openPicker} onFocus={openPicker} style={dateWebStyle} />
                      : <TextInput value={dTo} onChangeText={setDTo} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.gray[400]} style={dw.dateInput} />}
                  </View>
                </View>
                {(dFrom || dTo) ? (
                  <Text style={dw.dateHint}>
                    {dFrom && dTo ? `${fmtBRdate(dFrom)} – ${fmtBRdate(dTo)}` : dFrom ? `≥ ${fmtBRdate(dFrom)}` : `≤ ${fmtBRdate(dTo)}`}
                  </Text>
                ) : null}
              </View>

              {([
                ['cidade', 'Cidade', options.cidade, dCidade, setDCidade],
                ['uf', 'UF', options.uf, dUf, setDUf],
                ['orgao', 'Órgão', options.orgao, dOrgao, setDOrgao],
                ['proc', 'Processo', options.proc, dProc, setDProc],
                ['produto', 'Produto', options.produto, dProduto, setDProduto],
              ] as const).map(([key, lbl, opts, sel, setter]) => (
                <MultiSelect
                  key={key}
                  label={lbl}
                  options={opts}
                  selected={sel}
                  onToggle={toggle(setter as React.Dispatch<React.SetStateAction<Set<string>>>)}
                  open={openFilter === key}
                  onToggleOpen={() => setOpenFilter((o) => (o === key ? null : key))}
                />
              ))}

              <View style={{ height: 80 }} />
            </ScrollView>

            {/* Botões fixos no rodapé */}
            <View style={s.drawerFooter}>
              <Pressable style={s.clearBtn} onPress={clearFilters}>
                <Text style={s.clearBtnTxt}>Limpar</Text>
              </Pressable>
              <Pressable style={s.applyBtn} onPress={applyFilters}>
                <Text style={s.applyBtnTxt}>Filtrar</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* ─── Modal: histórico (linha do tempo) da licitação ─────────────────── */}
      {histRow && (
        <>
          <Pressable style={s.drawerBackdrop} onPress={() => setHistRow(null)} />
          <View style={[s.histModal, { maxWidth: Math.min(width - 32, 560) }]}>
            <View style={s.drawerHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.histTitle}>Histórico da licitação</Text>
                <Text style={s.histSub} numberOfLines={2}>
                  {histRow.produtoLicitado || histRow.produto || '—'} · {histRow.licitador || ''} {histRow.nProcesso ? `· ${histRow.nProcesso}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setHistRow(null)} style={s.drawerClose}>
                <Text style={s.drawerCloseTxt}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: SPACING.lg }}>
              {histLoading && <ActivityIndicator color={BRAND} style={{ marginVertical: SPACING.lg }} />}
              {!histLoading && hist && hist.length === 0 && (
                <Text style={s.centerTxt}>Sem histórico registrado ainda.</Text>
              )}
              {!histLoading && hist && hist.map((h, i) => {
                const last = i === hist.length - 1;
                const dateTxt = (h.snapshotAt || h.runDate || '').toString().slice(0, 10).split('-').reverse().join('/');
                return (
                  <View key={i} style={s.tlRow}>
                    <View style={s.tlMarker}>
                      <View style={[s.tlDot, last && { backgroundColor: BRAND }]} />
                      {i < hist.length - 1 && <View style={s.tlLine} />}
                    </View>
                    <View style={s.tlBody}>
                      <Text style={s.tlDate}>{dateTxt || '—'}</Text>
                      <Text style={s.tlStatus}>
                        {h.status ?? '—'}{h.encerramento ? ` · ${h.encerramento}` : ''}
                      </Text>
                      {h.concorrente ? (
                        <Text style={s.tlMeta}>🏆 {h.concorrente}{h.posicao != null ? ` (#${h.posicao})` : ''}</Text>
                      ) : null}
                      {h.precoFinalUnit != null ? (
                        <Text style={s.tlMeta}>Preço final unit.: {fmtBRL(h.precoFinalUnit)}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* ─── Modal: documentos (edital/ata) com leitor de PDF ──────────────── */}
      {docRow && (
        <>
          <Pressable style={s.drawerBackdrop} onPress={closeDocs} />
          <View style={s.docModal}>
            <View style={s.drawerHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.histTitle}>Documentos da licitação</Text>
                <Text style={s.histSub} numberOfLines={1}>
                  {docRow.licitador || ''} {docRow.nProcesso ? `· ${docRow.nProcesso}` : ''}
                </Text>
              </View>
              <Pressable onPress={closeDocs} style={s.drawerClose}>
                <Text style={s.drawerCloseTxt}>✕</Text>
              </Pressable>
            </View>

            {/* Abas Edital / Ata */}
            <View style={s.docTabs}>
              {(['edital', 'ata'] as const).map((t) => {
                const enabled = docAvail ? docAvail[t] : false;
                const active = docTab === t;
                return (
                  <Pressable
                    key={t}
                    disabled={!enabled}
                    style={[s.docTab, active && s.docTabActive, !enabled && s.docTabDisabled]}
                    onPress={() => loadDoc(docRow, t)}
                  >
                    <Text style={[s.docTabTxt, active && s.docTabTxtActive, !enabled && s.docTabTxtDisabled]}>
                      {t === 'edital' ? '📄 Edital' : '📄 Ata'}{!enabled && docAvail ? ' (n/d)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Seletor de arquivos (edital normalmente tem vários PDFs: edital, anexos, relação) */}
            {docFiles.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.docFiles} contentContainerStyle={{ gap: SPACING.xs, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, alignItems: 'center' }}>
                {docFiles.map((f) => {
                  const active = f.idx === docFileIdx;
                  return (
                    <Pressable key={f.idx} style={[s.docChip, active && s.docChipActive]} onPress={() => docRow && loadFile(docRow, docTab, f.idx)}>
                      <Text style={[s.docChipTxt, active && s.docChipTxtActive]} numberOfLines={1}>
                        {f.viewable ? '📄 ' : '📎 '}{f.name.replace(/\.pdf$/i, '')}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Visualizador */}
            <View style={s.docBody}>
              {!docAvail && <ActivityIndicator color={BRAND} style={{ marginTop: SPACING.xl }} />}
              {docAvail && !docAvail.edital && !docAvail.ata && (
                <Text style={s.centerTxt}>Nenhum documento disponível no PNCP para esta licitação.</Text>
              )}
              {docLoading && <ActivityIndicator color={BRAND} style={{ marginTop: SPACING.xl }} />}
              {!!docError && !docLoading && <Text style={[s.centerTxt, { color: COLORS.danger }]}>{docError}</Text>}
              {!docLoading && !docError && docUrl && (
                docIsPdf ? (
                  // leitor de PDF embutido (visualizador nativo do navegador)
                  Platform.OS === 'web'
                    ? React.createElement('iframe', { src: docUrl, style: { width: '100%', height: '100%', border: 'none' }, title: 'Documento' })
                    : <Text style={s.centerTxt}>Abra no navegador para visualizar o PDF.</Text>
                ) : (
                  <View style={{ alignItems: 'center', padding: SPACING.xl }}>
                    <Text style={s.centerTxt}>Este documento não é PDF (provavelmente arquivo compactado/Word).</Text>
                    {Platform.OS === 'web' && (
                      <Pressable style={[s.applyBtn, { marginTop: SPACING.md }]} onPress={() => (window as any).open(docUrl, '_blank')}>
                        <Text style={s.applyBtnTxt}>Baixar arquivo</Text>
                      </Pressable>
                    )}
                  </View>
                )
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Estilos da tela ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[100], padding: SPACING.md },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray[50], padding: SPACING.xl },
  centerTxt: { marginTop: SPACING.md, fontSize: FONTS.base, color: COLORS.gray[500], textAlign: 'center' },

  header:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' as any, gap: SPACING.md, marginBottom: SPACING.sm },
  headerNarrow: { alignItems: 'flex-start' },
  titleBlock:   { flexShrink: 1 },
  kicker:       { fontSize: 11, fontWeight: '700', color: COLORS.gray[400], letterSpacing: 1 },
  title:        { fontSize: 22, fontWeight: '900', color: COLORS.gray[900], marginTop: 2 },

  searchWrap:   { flexDirection: 'row', alignItems: 'center', flexGrow: 1, flexShrink: 1, flexBasis: 320, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 42 },
  searchIcon:   { fontSize: 15, marginRight: SPACING.sm, color: COLORS.gray[400] },
  searchInput:  { flex: 1, fontSize: FONTS.base, color: COLORS.gray[900], ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  searchClear:  { padding: 4 },
  searchClearTxt:{ fontSize: 13, color: COLORS.gray[400], fontWeight: '700' },

  filterBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 42 },
  filterBtnActive:  { borderColor: BRAND, backgroundColor: BRAND + '0d' },
  filterBtnIcon:    { fontSize: 15, color: COLORS.gray[600] },
  filterBtnTxt:     { fontSize: FONTS.base, color: COLORS.gray[700], fontWeight: '600' },
  filterBtnTxtActive:{ color: BRAND },
  filterBadge:      { backgroundColor: BRAND, borderRadius: RADIUS.full, minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt:   { color: COLORS.white, fontSize: 11, fontWeight: '800' },

  countBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, paddingHorizontal: 2 },
  countTxt:  { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600' },
  countClear:{ fontSize: FONTS.sm, color: BRAND, fontWeight: '700' },

  tableScroll: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100] },
  headRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: COLORS.gray[200], backgroundColor: COLORS.gray[50] },
  th:       { fontSize: 11, fontWeight: '800', color: COLORS.gray[600], flexShrink: 1 },
  thCell:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4, ...(Platform.OS === 'web' ? { cursor: 'pointer', userSelect: 'none' } as any : {}) },
  thActive: { color: BRAND },
  thArrow:      { fontSize: 11, color: COLORS.gray[400], fontWeight: '700' },
  thArrowActive:{ fontSize: 11, color: BRAND, fontWeight: '900' },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  rowAlt:   { backgroundColor: COLORS.gray[50] },
  td:       { fontSize: FONTS.sm, color: COLORS.gray[700], paddingHorizontal: 4 },
  tdLink:   { color: COLORS.primary, textDecorationLine: 'underline' as any },
  empty:    { fontSize: FONTS.sm, color: COLORS.gray[400], padding: SPACING.xl, textAlign: 'center' as any },

  pagination:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as any, gap: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: 2 },
  pageInfo:     { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600' },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  pageBtn:      { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: COLORS.white },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnTxt:   { fontSize: FONTS.sm, color: BRAND, fontWeight: '700' },
  pageBtnTxtDisabled: { color: COLORS.gray[400] },
  pageCurrent:  { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '600', paddingHorizontal: SPACING.sm },

  // Drawer
  drawerBackdrop: { position: 'fixed' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200 } as any,
  drawer:    { position: 'fixed' as any, top: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, zIndex: 201, flexDirection: 'column', shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 24 } as any,
  drawerHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  drawerTitle: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  drawerClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  drawerCloseTxt:{ fontSize: 14, color: COLORS.gray[600], fontWeight: '700' },
  drawerBody:  { flex: 1, paddingHorizontal: SPACING.lg },
  drawerFooter:{ flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100], justifyContent: 'flex-end' },
  clearBtn:    { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  clearBtnTxt: { fontSize: FONTS.base, color: COLORS.gray[600], fontWeight: '700' },
  applyBtn:    { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: BRAND },
  applyBtnTxt: { fontSize: FONTS.base, color: COLORS.white, fontWeight: '700' },

  // Ações por linha na tabela (histórico + documentos)
  actionsCell: { width: ACTION_W, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionBtn:   { paddingHorizontal: 4, paddingVertical: 2, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  histBtn:     { width: ACTION_W, alignItems: 'center', justifyContent: 'center' },
  histIcon:    { fontSize: 15 },

  // Modal de documentos (leitor de PDF)
  docModal:  { position: 'fixed' as any, top: '4%' as any, left: '50%' as any, transform: [{ translateX: '-50%' as any }] as any, width: '88%' as any, maxWidth: 1000, height: '92%' as any, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, zIndex: 201, overflow: 'hidden' as any, flexDirection: 'column', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 30 } as any,
  docTabs:   { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  docTab:    { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  docTabActive: { borderBottomColor: BRAND },
  docTabDisabled: { opacity: 0.4 },
  docTabTxt: { fontSize: FONTS.base, color: COLORS.gray[600], fontWeight: '700' },
  docTabTxtActive: { color: BRAND },
  docTabTxtDisabled: { color: COLORS.gray[400] },
  docFiles:  { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], backgroundColor: COLORS.gray[50] },
  docChip:   { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: COLORS.white, maxWidth: 240 },
  docChipActive: { borderColor: BRAND, backgroundColor: BRAND + '12' },
  docChipTxt:   { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
  docChipTxtActive: { color: BRAND, fontWeight: '700' },
  docBody:   { flex: 1, backgroundColor: COLORS.gray[100], alignItems: 'stretch', justifyContent: 'center' },

  // Modal de histórico (linha do tempo) — centralizado, não polui a tabela
  histModal: { position: 'fixed' as any, top: '50%' as any, left: '50%' as any, transform: [{ translateX: '-50%' as any }, { translateY: '-50%' as any }] as any, width: '92%' as any, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, zIndex: 201, overflow: 'hidden' as any, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 30 } as any,
  histTitle: { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.gray[900] },
  histSub:   { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  tlRow:     { flexDirection: 'row', gap: SPACING.md },
  tlMarker:  { alignItems: 'center', width: 16 },
  tlDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.gray[300], marginTop: 3 },
  tlLine:    { flex: 1, width: 2, backgroundColor: COLORS.gray[200], marginVertical: 2 },
  tlBody:    { flex: 1, paddingBottom: SPACING.lg },
  tlDate:    { fontSize: FONTS.xs, color: COLORS.gray[400], fontWeight: '700' },
  tlStatus:  { fontSize: FONTS.base, color: COLORS.gray[900], fontWeight: '700', marginTop: 1 },
  tlMeta:    { fontSize: FONTS.sm, color: COLORS.gray[600], marginTop: 2 },
});

// ─── Estilos do drawer (grupos de filtro) ─────────────────────────────────────
const dw = StyleSheet.create({
  group:      { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  groupOpen:  { backgroundColor: COLORS.gray[50], borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, marginHorizontal: -SPACING.sm },
  groupHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: FONTS.base, fontWeight: '800', color: COLORS.gray[800] },
  groupCount: { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600' },
  groupCountActive: { color: BRAND, fontWeight: '800' },
  // painel aberto do dropdown: card contido com sombra (não cobre os filtros abaixo)
  panel:      { marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, backgroundColor: COLORS.white, padding: SPACING.sm },
  search:     { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 7, fontSize: FONTS.sm, color: COLORS.gray[900], ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  optList:    { marginTop: SPACING.sm, maxHeight: 240 },
  optRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
  checkbox:   { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: COLORS.gray[300], alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: BRAND, borderColor: BRAND },
  checkTxt:   { fontSize: 10, color: COLORS.white, fontWeight: '900', lineHeight: 12 },
  optTxt:     { fontSize: FONTS.sm, color: COLORS.gray[700], flex: 1 },
  optTxtOn:   { color: BRAND, fontWeight: '700' },
  emptyOpt:   { fontSize: FONTS.sm, color: COLORS.gray[400], paddingVertical: SPACING.sm },
  moreHint:   { fontSize: FONTS.xs, color: COLORS.gray[400], paddingVertical: SPACING.sm },
  dateRow:    { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  dateLbl:    { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[600], marginBottom: 4 },
  dateInput:  { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 7, fontSize: FONTS.base },
  dateHint:   { fontSize: FONTS.xs, color: BRAND, fontWeight: '600', marginTop: SPACING.sm },
});
