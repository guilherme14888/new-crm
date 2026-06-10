import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  useWindowDimensions, Platform, TextInput,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { useMarketIntelStore, MarketIntelRow } from '../../../src/stores/marketIntelStore';
import { useAuthStore } from '../../../src/stores/authStore';

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
const TABLE_W = COLUMNS.reduce((s, c) => s + c.w, 0) + 16;

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

// ─── Drawer de multi-seleção (lista com checkboxes + busca interna) ────────────
function MultiSelect({
  label, options, selected, onToggle,
}: {
  label: string; options: string[]; selected: Set<string>; onToggle: (v: string) => void;
}) {
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(false);
  const CAP = 100;
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const filtered = matches.slice(0, CAP);

  return (
    <View style={dw.group}>
      <Pressable style={dw.groupHead} onPress={() => setExpanded((v) => !v)}>
        <Text style={dw.groupTitle}>{label}</Text>
        <Text style={dw.groupCount}>
          {selected.size > 0 ? `${selected.size} selec.` : `${options.length}`} {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>
      {expanded && (
        <>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={`Buscar ${label.toLowerCase()}…`}
            placeholderTextColor={COLORS.gray[400]}
            style={dw.search}
          />
          <View style={dw.optList}>
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
          </View>
        </>
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

  useEffect(() => { loadRows(); }, [companyId]);

  // Busca ao vivo (aplicada imediatamente).
  const [search, setSearch] = useState('');

  // Página atual da listagem (20 registros por página).
  const [page, setPage] = useState(1);

  // Drawer aberto/fechado.
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // ── Paginação (20 por página) ────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // volta à 1ª página sempre que a busca/filtros mudam o conjunto de resultados
  useEffect(() => { setPage(1); }, [search, applied]);
  // mantém a página dentro do intervalo válido se o total diminuir
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
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
  const dateWebStyle: any = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.gray[200]}`, borderRadius: 6, padding: '7px 9px', fontSize: 13, color: COLORS.gray[700], outline: 'none' };
  const isWeb = Platform.OS === 'web';

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
            {COLUMNS.map((c) => (
              <Text key={String(c.key)} style={[s.th, { width: c.w }, c.right && { textAlign: 'right' as any }]} numberOfLines={1}>
                {c.label}
              </Text>
            ))}
          </View>
          {/* corpo — apenas os 20 registros da página atual */}
          {filtered.length === 0 ? (
            <Text style={s.empty}>Nenhuma linha para a busca/filtros selecionados.</Text>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
              {pageRows.map((r, index) => (
                <View key={r.id} style={[s.row, index % 2 === 1 && s.rowAlt]}>
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
                      ? <WebInput type="date" value={dFrom} onChange={(e: any) => setDFrom(e.target.value)} style={dateWebStyle} />
                      : <TextInput value={dFrom} onChangeText={setDFrom} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.gray[400]} style={dw.dateInput} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dw.dateLbl}>Até</Text>
                    {isWeb
                      ? <WebInput type="date" value={dTo} onChange={(e: any) => setDTo(e.target.value)} style={dateWebStyle} />
                      : <TextInput value={dTo} onChangeText={setDTo} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.gray[400]} style={dw.dateInput} />}
                  </View>
                </View>
                {(dFrom || dTo) ? (
                  <Text style={dw.dateHint}>
                    {dFrom && dTo ? `${fmtBRdate(dFrom)} – ${fmtBRdate(dTo)}` : dFrom ? `≥ ${fmtBRdate(dFrom)}` : `≤ ${fmtBRdate(dTo)}`}
                  </Text>
                ) : null}
              </View>

              <MultiSelect label="Cidade"  options={options.cidade}  selected={dCidade}  onToggle={toggle(setDCidade)} />
              <MultiSelect label="UF"      options={options.uf}      selected={dUf}      onToggle={toggle(setDUf)} />
              <MultiSelect label="Órgão"   options={options.orgao}   selected={dOrgao}   onToggle={toggle(setDOrgao)} />
              <MultiSelect label="Processo" options={options.proc}   selected={dProc}    onToggle={toggle(setDProc)} />
              <MultiSelect label="Produto" options={options.produto} selected={dProduto} onToggle={toggle(setDProduto)} />

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
  th:       { fontSize: 11, fontWeight: '800', color: COLORS.gray[600], paddingHorizontal: 4 },
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
});

// ─── Estilos do drawer (grupos de filtro) ─────────────────────────────────────
const dw = StyleSheet.create({
  group:      { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  groupHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: FONTS.base, fontWeight: '800', color: COLORS.gray[800] },
  groupCount: { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600' },
  search:     { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 7, fontSize: FONTS.sm, marginTop: SPACING.sm, color: COLORS.gray[900], ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  optList:    { marginTop: SPACING.sm, maxHeight: 260 },
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
