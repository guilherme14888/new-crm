import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, Platform, TextInput } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { useMarketIntelStore, MarketIntelRow } from '../../../src/stores/marketIntelStore';
import { useAuthStore } from '../../../src/stores/authStore';

// ════════════════════════════════════════════════════════════════════════════
//  Inteligência de Mercado — Portfólio de Compras Governamentais
//  Dados espelhados da tabela `market_intelligence` (base Licitações Tracker).
// ════════════════════════════════════════════════════════════════════════════

const ACCENT = '#c9a227';
const BRAND  = '#7b2d8e';
const TODOS  = 'Todos';

// Cores fixas por produto candidato (com fallback determinístico).
const PRODUCT_COLORS: Record<string, string> = {
  CALQUENCE: '#1d4ed8',
  FASENRA:   '#ef6c4d',
  LOKELMA:   '#6b21a8',
  LYNPARZA:  '#d6329a',
  TAGRISSO:  '#e0322f',
  TEZSPIRE:  '#0d8a8a',
  ZOLADEX:   '#2fae4f',
};
const FALLBACK_PALETTE = ['#7c3aed', '#e0b400', '#0891b2', '#db2777', '#65a30d', '#ea580c'];
function colorFor(name: string, idx: number) {
  return PRODUCT_COLORS[name] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  'Novo':         { color: '#1d4ed8', bg: '#eff6ff' },
  'Em Andamento': { color: '#b45309', bg: '#fffbeb' },
  'Encerrado':    { color: '#16a34a', bg: '#f0fdf4' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = iso.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 7); // YYYY-MM
}
function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTH_LABELS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
const fmtInt = (n: number) => Math.round(n).toLocaleString('pt-BR');

// Chave única de processo.
function procKey(r: MarketIntelRow) {
  return r.processoKey || `${r.licitador}|${r.nEdital}|${r.nProcesso}`;
}

// ─── Dropdown (single-select) ─────────────────────────────────────────────────
function Select({
  label, value, options, onChange, openId, setOpenId, id,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  openId: string | null; setOpenId: (v: string | null) => void; id: string;
}) {
  const open = openId === id;
  return (
    <View style={sel.wrap}>
      <Text style={sel.label}>{label}</Text>
      <View style={sel.anchor}>
        <Pressable style={sel.trigger} onPress={() => setOpenId(open ? null : id)}>
          <Text style={sel.triggerTxt} numberOfLines={1}>{value}</Text>
          <Text style={sel.chevron}>{open ? '▲' : '▼'}</Text>
        </Pressable>
        {open && (
          <>
            <Pressable style={sel.backdrop} onPress={() => setOpenId(null)} />
            <View style={sel.flyout}>
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator>
                {options.map((o) => {
                  const active = o === value;
                  return (
                    <Pressable key={o} style={[sel.item, active && sel.itemActive]} onPress={() => { onChange(o); setOpenId(null); }}>
                      {active && <Text style={sel.check}>✓</Text>}
                      <Text style={[sel.itemTxt, active && sel.itemTxtActive]} numberOfLines={1}>{o}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
const sel = StyleSheet.create({
  wrap:        { minWidth: 170, flex: 1 },
  label:       { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600', marginBottom: 4 },
  anchor:      { position: 'relative' as any, zIndex: 50 },
  trigger:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gray[50], borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  triggerTxt:  { flex: 1, fontSize: FONTS.base, color: COLORS.gray[600] },
  chevron:     { fontSize: 9, color: COLORS.gray[400], marginLeft: SPACING.sm },
  backdrop:    { position: 'fixed' as any, inset: 0, zIndex: 98 } as any,
  flyout:      { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, marginTop: 4, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, zIndex: 99 },
  item:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemActive:  { backgroundColor: COLORS.primary + '0d' },
  itemTxt:     { fontSize: FONTS.sm, color: COLORS.gray[700], flex: 1 },
  itemTxtActive:{ color: COLORS.primary, fontWeight: '700' },
  check:       { fontSize: 11, color: COLORS.primary, fontWeight: '800', width: 14 },
});

// ─── Section card ──────────────────────────────────────────────────────────────
function Panel({ title, children, style }: { title: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[pn.card, style]}>
      <Text style={pn.title}>{title}</Text>
      {children}
    </View>
  );
}
const pn = StyleSheet.create({
  card:  { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], padding: SPACING.md, marginBottom: SPACING.md },
  title: { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.gray[800], marginBottom: SPACING.sm },
});

// ─── Stacked columns by month ──────────────────────────────────────────────────
function StreamChart({
  months, byMonthProduct, products,
}: {
  months: string[];
  byMonthProduct: Record<string, Record<string, number>>;
  products: { name: string; color: string }[];
}) {
  const totals = months.map((mk) =>
    products.reduce((s, p) => s + (byMonthProduct[mk]?.[p.name] ?? 0), 0)
  );
  const max = Math.max(1, ...totals);
  const CHART_H = 180;

  if (months.length === 0) {
    return <Text style={tbl.empty}>Sem dados para os filtros selecionados.</Text>;
  }

  return (
    <View>
      <View style={[cht.area, { height: CHART_H }]}>
        {/* gridlines + y labels — alinhadas à mesma base das colunas */}
        {[1, 0.5, 0].map((g) => (
          <View key={g} style={[cht.grid, { top: (1 - g) * CHART_H }]}>
            <Text style={cht.gridLabel}>{fmtInt(max * g)}</Text>
            <View style={cht.gridLine} />
          </View>
        ))}
        {/* colunas empilhadas */}
        <View style={[cht.cols, { height: CHART_H }]}>
          {months.map((mk) => (
            <View key={mk} style={cht.colWrap}>
              <View style={cht.col}>
                {products.map((p) => {
                  const v = byMonthProduct[mk]?.[p.name] ?? 0;
                  const h = (v / max) * CHART_H;
                  if (h <= 0) return null;
                  return <View key={p.name} style={{ height: h, backgroundColor: p.color, opacity: 0.9 }} />;
                })}
              </View>
            </View>
          ))}
        </View>
      </View>
      {/* labels do eixo X */}
      <View style={cht.xRow}>
        {months.map((mk) => (
          <Text key={mk} style={cht.xLabel} numberOfLines={1}>{monthLabel(mk)}</Text>
        ))}
      </View>
    </View>
  );
}
const Y_AXIS_W = 44;
const cht = StyleSheet.create({
  area:      { position: 'relative' as any, marginLeft: Y_AXIS_W },
  grid:      { position: 'absolute' as any, left: -Y_AXIS_W, right: 0, flexDirection: 'row', alignItems: 'center' },
  gridLabel: { fontSize: 9, color: COLORS.gray[400], width: Y_AXIS_W - 6, textAlign: 'right' as any, marginRight: 6 },
  gridLine:  { flex: 1, height: 1, backgroundColor: COLORS.gray[100] },
  cols:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  colWrap:   { flex: 1, height: '100%' as any, justifyContent: 'flex-end', alignItems: 'center' },
  col:       { width: '72%' as any, maxWidth: 48, flexDirection: 'column-reverse', borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden' as any },
  xRow:      { flexDirection: 'row', marginLeft: Y_AXIS_W, marginTop: 6, columnGap: 8 },
  xLabel:    { flex: 1, fontSize: 9, color: COLORS.gray[500], textAlign: 'center' as any },
});

// ─── Product checkbox list with magnitude bars ─────────────────────────────────
function ProductFilter({
  products, totals, active, onToggle,
}: {
  products: { name: string; color: string }[];
  totals: Record<string, number>;
  active: Set<string>;
  onToggle: (name: string) => void;
}) {
  const max = Math.max(1, ...products.map((p) => totals[p.name] ?? 0));
  return (
    <View>
      {products.map((p) => {
        const on = active.has(p.name);
        const total = totals[p.name] ?? 0;
        return (
          <Pressable key={p.name} style={lg.row} onPress={() => onToggle(p.name)}>
            <View style={[lg.checkbox, on && { backgroundColor: p.color, borderColor: p.color }]}>
              {on && <Text style={lg.checkTxt}>✓</Text>}
            </View>
            <Text style={[lg.name, { color: p.color }, !on && { opacity: 0.45 }]} numberOfLines={1}>{p.name}</Text>
            <View style={lg.barTrack}>
              <View style={[lg.barFill, { width: `${(total / max) * 100}%`, backgroundColor: on ? ACCENT : COLORS.gray[200] }]} />
            </View>
            <Text style={[lg.count, !on && { opacity: 0.45 }]}>{total.toLocaleString('pt-BR')}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const lg = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: SPACING.sm },
  checkbox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: COLORS.gray[300], alignItems: 'center', justifyContent: 'center' },
  checkTxt: { fontSize: 10, color: COLORS.white, fontWeight: '900', lineHeight: 12 },
  name:     { fontSize: FONTS.sm, fontWeight: '700', width: 110 },
  barTrack: { flex: 1, height: 8, backgroundColor: COLORS.gray[100], borderRadius: 2, overflow: 'hidden' },
  barFill:  { height: '100%' },
  count:    { width: 44, textAlign: 'right' as any, fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[600] },
});

// ─── Table primitives ───────────────────────────────────────────────────────────
function Th({ children, w, right }: { children: React.ReactNode; w: number; right?: boolean }) {
  return <Text style={[tbl.th, { width: w }, right && { textAlign: 'right' as any }]} numberOfLines={1}>{children}</Text>;
}
function Td({ children, w, right, color, bold }: { children: React.ReactNode; w: number; right?: boolean; color?: string; bold?: boolean }) {
  return (
    <Text style={[tbl.td, { width: w }, right && { textAlign: 'right' as any }, color ? { color } : undefined, bold && { fontWeight: '700' }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

// Envolve uma tabela larga: rola na horizontal só quando o espaço aperta.
function TableScroll({ minWidth, children }: { minWidth: number; children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ minWidth, flex: 1 }}>{children}</View>
    </ScrollView>
  );
}

// ─── Tooltip estilo Power BI (balão que segue o cursor) ───────────────────────
/** Coordenadas do cursor a partir de um evento de mouse (RN Web). */
const evPos = (e: any) => ({
  x: e?.nativeEvent?.clientX ?? e?.clientX ?? 0,
  y: e?.nativeEvent?.clientY ?? e?.clientY ?? 0,
});

/** Balão de detalhamento (label → valor) posicionado junto ao cursor. */
function HoverCard({ x, y, vw, vh, fields }: {
  x: number; y: number; vw: number; vh: number;
  fields: { label: string; value: any }[];
}) {
  const W = 360;
  const estH = fields.length * 22 + 20;
  const left = x + 18 + W > vw ? Math.max(8, x - W - 18) : x + 18;
  const top = Math.max(8, Math.min(y + 18, vh - estH - 12));
  return (
    <View style={[hc.card, { left, top, width: W }]} pointerEvents="none">
      {fields.map((f, i) => (
        <View key={i} style={hc.row}>
          <Text style={hc.label} numberOfLines={1}>{f.label}</Text>
          <Text style={hc.value}>{f.value == null || f.value === '' ? '(Em branco)' : String(f.value)}</Text>
        </View>
      ))}
    </View>
  );
}
const hc = StyleSheet.create({
  card:  { position: 'fixed' as any, zIndex: 9999, backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[200], shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } } as any,
  row:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 2, gap: SPACING.sm },
  label: { width: 150, textAlign: 'right' as any, fontSize: FONTS.sm, color: COLORS.gray[500] },
  value: { flex: 1, fontSize: FONTS.sm, color: COLORS.gray[900], fontWeight: '500' },
});

// dd/mm/aaaa a partir de "aaaa-mm-dd"
function fmtBRdate(d: string) {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

// ─── Filtro de Data (dia específico ou intervalo) ─────────────────────────────
function DateRangeFilter({ from, to, setFrom, setTo, openId, setOpenId }: {
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
  openId: string | null; setOpenId: (v: string | null) => void;
}) {
  const open = openId === 'data';
  const WebInput: any = 'input';
  const webStyle: any = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.gray[200]}`, borderRadius: 6, padding: '6px 8px', fontSize: 13, color: COLORS.gray[700], marginTop: 4, outline: 'none' };

  const label = !from && !to ? TODOS
    : from && to ? (from === to ? fmtBRdate(from) : `${fmtBRdate(from)} – ${fmtBRdate(to)}`)
    : from ? `≥ ${fmtBRdate(from)}` : `≤ ${fmtBRdate(to)}`;

  const isWeb = Platform.OS === 'web';
  return (
    <View style={sel.wrap}>
      <Text style={sel.label}>Data</Text>
      <View style={sel.anchor}>
        <Pressable style={sel.trigger} onPress={() => setOpenId(open ? null : 'data')}>
          <Text style={sel.triggerTxt} numberOfLines={1}>{label}</Text>
          <Text style={sel.chevron}>{open ? '▲' : '▼'}</Text>
        </Pressable>
        {open && (
          <>
            <Pressable style={sel.backdrop} onPress={() => setOpenId(null)} />
            <View style={[sel.flyout, { padding: SPACING.md }]}>
              <Text style={drf.lbl}>De</Text>
              {isWeb
                ? <WebInput type="date" value={from} onChange={(e: any) => setFrom(e.target.value)} style={webStyle} />
                : <TextInput value={from} onChangeText={setFrom} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.gray[400]} style={drf.input} />}
              <Text style={[drf.lbl, { marginTop: SPACING.sm }]}>Até</Text>
              {isWeb
                ? <WebInput type="date" value={to} onChange={(e: any) => setTo(e.target.value)} style={webStyle} />
                : <TextInput value={to} onChangeText={setTo} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.gray[400]} style={drf.input} />}
              <Pressable style={drf.clear} onPress={() => { setFrom(''); setTo(''); }}>
                <Text style={drf.clearTxt}>Limpar</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
const drf = StyleSheet.create({
  lbl:      { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[600] },
  input:    { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, fontSize: FONTS.base, marginTop: 4 },
  clear:    { marginTop: SPACING.md, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  clearTxt: { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
});

// ════════════════════════════════════════════════════════════════════════════
export default function MarketIntelligenceScreen() {
  const { width, height } = useWindowDimensions();
  const narrow = width < 1000;
  const rows      = useMarketIntelStore((s) => s.rows);
  const isLoading = useMarketIntelStore((s) => s.isLoading);
  const loaded    = useMarketIntelStore((s) => s.loaded);
  const loadRows  = useMarketIntelStore((s) => s.loadRows);
  const companyId = useAuthStore((s) => s.user?.companyId);

  // recarrega ao trocar de tenant (a empresa ativa muda → backend re-escopa)
  useEffect(() => { loadRows(); }, [companyId]);

  const [openId, setOpenId]           = useState<string | null>(null);
  const [empresa, setEmpresa]         = useState(TODOS);
  const [etapaSessao, setEtapaSessao] = useState(TODOS);
  const [licitador, setLicitador]     = useState(TODOS);
  const [concorrente, setConcorrente] = useState(TODOS);
  const [dateFrom, setDateFrom]       = useState('');   // AAAA-MM-DD
  const [dateTo, setDateTo]           = useState('');
  const [hover, setHover]             = useState<{ kind: 'proc' | 'rank'; row: MarketIntelRow; x: number; y: number } | null>(null);
  const [uf, setUf]                   = useState(TODOS);
  const [regiao, setRegiao]           = useState(TODOS);
  const [activeProducts, setActiveProducts] = useState<Set<string> | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState(0);

  // ── Catálogo de produtos (da base) ───────────────────────────────────────────
  const products = useMemo(() => {
    const names = Array.from(new Set(rows.map((r) => r.produtoCandidato).filter(Boolean) as string[])).sort();
    return names.map((name, i) => ({ name, color: colorFor(name, i) }));
  }, [rows]);

  // inicia com todos os produtos ativos quando a base carrega
  useEffect(() => {
    if (products.length && activeProducts === null) {
      setActiveProducts(new Set(products.map((p) => p.name)));
    }
  }, [products, activeProducts]);
  const active = activeProducts ?? new Set(products.map((p) => p.name));

  // ── Empresas presentes (filtro só faz sentido no Default/master, com várias) ──
  const companyOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.companyId) map.set(r.companyId, r.companyName || r.companyId);
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const showEmpresa = companyOpts.length > 1;
  const empresaOpts = useMemo(() => [TODOS, ...companyOpts], [companyOpts]);

  // ── Opções de filtro ─────────────────────────────────────────────────────────
  const opts = useMemo(() => {
    const u = (sel: (r: MarketIntelRow) => string | null) =>
      [TODOS, ...Array.from(new Set(rows.map(sel).filter(Boolean) as string[])).sort()];
    return {
      etapa: u((r) => r.etapaSessao),
      lic:   u((r) => r.licitador),
      conc:  u((r) => r.concorrente),
      uf:    u((r) => r.uf),
      reg:   u((r) => r.regiao),
    };
  }, [rows]);

  // ── Linhas filtradas ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (empresa     !== TODOS && (r.companyName || '') !== empresa) return false;
      if (etapaSessao !== TODOS && r.etapaSessao !== etapaSessao) return false;
      if (licitador   !== TODOS && r.licitador   !== licitador)   return false;
      if (concorrente !== TODOS && r.concorrente !== concorrente) return false;
      if (uf          !== TODOS && r.uf          !== uf)          return false;
      if (regiao      !== TODOS && r.regiao      !== regiao)      return false;
      if (dateFrom || dateTo) {
        const d = (r.dataHoraCertame || '').slice(0, 10);
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo)     return false;
      }
      if (r.produtoCandidato && !active.has(r.produtoCandidato))  return false;
      return true;
    });
  }, [rows, empresa, etapaSessao, licitador, concorrente, uf, regiao, dateFrom, dateTo, active]);

  // ── Agrupa em processos ─────────────────────────────────────────────────────────
  const processes = useMemo(() => {
    const map = new Map<string, MarketIntelRow[]>();
    for (const r of filtered) {
      const k = procKey(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, head: items[0], items }));
  }, [filtered]);

  // mantém uma seleção válida
  const selected = useMemo(
    () => processes.find((p) => p.key === selectedKey) ?? processes[0] ?? null,
    [processes, selectedKey]
  );
  const selItems = selected?.items ?? [];
  const descItem = selItems[selectedItem] ?? selItems[0] ?? null;

  // ── Ranking (uma linha por item/concorrente) ────────────────────────────────────
  const ranking = useMemo(
    () => [...filtered].sort((a, b) => (b.precoEstimadoUnit ?? 0) - (a.precoEstimadoUnit ?? 0)),
    [filtered]
  );
  const rankingTotal = ranking.reduce((s, r) => s + (r.precoEstimadoUnit ?? 0), 0);

  // ── Série mensal por produto ────────────────────────────────────────────────────
  const { months, byMonthProduct } = useMemo(() => {
    const by: Record<string, Record<string, number>> = {};
    const set = new Set<string>();
    for (const r of filtered) {
      const mk = monthKey(r.dataHoraCertame);
      if (!mk || !r.produtoCandidato) continue;
      set.add(mk);
      by[mk] = by[mk] ?? {};
      by[mk][r.produtoCandidato] = (by[mk][r.produtoCandidato] ?? 0) + (r.quantidade ?? 0);
    }
    return { months: Array.from(set).sort(), byMonthProduct: by };
  }, [filtered]);

  // ── Contagem de ocorrências por produto (nº de vezes que aparece) ───────────────
  const productTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of filtered) {
      if (!r.produtoCandidato) continue;
      t[r.produtoCandidato] = (t[r.produtoCandidato] ?? 0) + 1;
    }
    return t;
  }, [filtered]);

  const toggleProduct = (name: string) => {
    setActiveProducts((prev) => {
      const base = prev ?? new Set(products.map((p) => p.name));
      const next = new Set(base);
      if (next.has(name)) next.delete(name); else next.add(name);
      if (next.size === 0) return base; // nunca esvazia
      return next;
    });
  };

  // ── Loading / vazio ──────────────────────────────────────────────────────────────
  if (isLoading && !loaded) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={s.centerTxt}>Carregando inteligência de mercado…</Text>
      </View>
    );
  }
  if (loaded && rows.length === 0) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48, marginBottom: SPACING.md }}>🧠</Text>
        <Text style={s.centerTxt}>Nenhum dado de inteligência de mercado cadastrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.scrollContent}>
        <View style={s.canvas}>
          {/* ─── Header ───────────────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.brandBox}>
              <Text style={s.brandMark}>BR4</Text>
              <Text style={s.brandSub}>LICITAÇÕES</Text>
            </View>
            <View style={s.titleBlock}>
              <Text style={s.kicker}>STATUS REPORT / INTELIGÊNCIA DE MERCADO</Text>
              <Text style={s.title}>Portfólio de Compras Governamentais</Text>
            </View>
            <View style={[s.topFilters, narrow && s.topFiltersNarrow]}>
              {showEmpresa && (
                <Select id="empresa" label="Empresa" value={empresa} options={empresaOpts} onChange={setEmpresa} openId={openId} setOpenId={setOpenId} />
              )}
              <Select id="etapa" label="Etapa da Sessão" value={etapaSessao} options={opts.etapa} onChange={setEtapaSessao} openId={openId} setOpenId={setOpenId} />
              <Select id="lic"   label="Licitador"        value={licitador}   options={opts.lic}   onChange={setLicitador}   openId={openId} setOpenId={setOpenId} />
              <Select id="conc"  label="Concorrente"      value={concorrente} options={opts.conc}  onChange={setConcorrente} openId={openId} setOpenId={setOpenId} />
              <DateRangeFilter from={dateFrom} to={dateTo} setFrom={setDateFrom} setTo={setDateTo} openId={openId} setOpenId={setOpenId} />
            </View>
          </View>

          {/* ─── Body ──────────────────────────────────────────────────────── */}
          <View style={[s.body, narrow && { flexDirection: 'column' as any }]}>
            {/* LEFT */}
            <View style={[s.left, narrow && s.fullW]}>
              <Panel title={`Todos Processos (${processes.length})`}>
                <TableScroll minWidth={888}>
                <View style={tbl.headerRow}>
                  <View style={tbl.accentSpacer} />
                  <Th w={110}>Status</Th>
                  <Th w={40}>UF</Th>
                  <Th w={240}>Licitador - Nome Longo</Th>
                  <Th w={90}>No. Edital</Th>
                  <Th w={160}>No. Processo</Th>
                  <Th w={120}>Data do Certame</Th>
                  <Th w={120}>Site</Th>
                </View>
                <ScrollView style={{ maxHeight: 210 }} showsVerticalScrollIndicator>
                  {processes.length === 0 && <Text style={tbl.empty}>Nenhum processo para os filtros selecionados.</Text>}
                  {processes.map(({ key, head }, idx) => {
                    const on = selected?.key === key;
                    const st = STATUS_STYLE[head.status ?? ''] ?? { color: COLORS.gray[600], bg: COLORS.gray[100] };
                    return (
                      <Pressable key={key} onPress={() => { setSelectedKey(key); setSelectedItem(0); }}
                        {...({ onMouseMove: (e: any) => setHover({ kind: 'proc', row: head, ...evPos(e) }), onMouseLeave: () => setHover((h) => (h && h.row === head ? null : h)) } as any)}
                        style={[tbl.row, idx % 2 === 1 && tbl.rowAlt, on && tbl.rowSel]}>
                        <View style={[tbl.accent, { backgroundColor: on ? ACCENT : 'transparent' }]} />
                        <View style={{ width: 110 }}>
                          <View style={[tbl.statusPill, { backgroundColor: st.bg }]}>
                            <Text style={[tbl.statusTxt, { color: st.color }]}>{head.status ?? '—'}</Text>
                          </View>
                        </View>
                        <Td w={40}>{head.uf ?? '—'}</Td>
                        <Td w={240} bold>{head.licitador ?? '—'}</Td>
                        <Td w={90}>{head.nEdital ?? '—'}</Td>
                        <Td w={160}>{head.nProcesso ?? '—'}</Td>
                        <Td w={120}>{fmtDate(head.dataHoraCertame)}</Td>
                        <Td w={120} color={COLORS.primary}>{head.nomeSite ?? '—'}</Td>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                </TableScroll>
              </Panel>

              <Panel title="Ranking">
                <TableScroll minWidth={918}>
                <View style={tbl.headerRow}>
                  <View style={tbl.accentSpacer} />
                  <Th w={46}>#Lote</Th>
                  <Th w={46}>#Item</Th>
                  <Th w={150}>Etapa da Sessão</Th>
                  <Th w={120}>Produto</Th>
                  <Th w={48}>#Pos.</Th>
                  <Th w={230}>Concorrente</Th>
                  <Th w={150}>CNPJ Concorrente</Th>
                  <Th w={120} right>Preço Est. Unit.</Th>
                </View>
                <ScrollView style={{ maxHeight: 210 }} showsVerticalScrollIndicator>
                  {ranking.map((r) => (
                    <View key={r.id} style={tbl.row}
                      {...({ onMouseMove: (e: any) => setHover({ kind: 'rank', row: r, ...evPos(e) }), onMouseLeave: () => setHover((h) => (h && h.row === r ? null : h)) } as any)}>
                      <View style={[tbl.accent, { backgroundColor: 'transparent' }]} />
                      <Td w={46}>{r.lote ?? '—'}</Td>
                      <Td w={46}>{r.item ?? '—'}</Td>
                      <Td w={150}>{r.etapaSessao ?? '—'}</Td>
                      <View style={{ width: 120, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={[tbl.dot, { backgroundColor: colorFor(r.produtoCandidato ?? '', 0) }]} />
                        <Td w={98} color={colorFor(r.produtoCandidato ?? '', 0)} bold>{r.produtoCandidato ?? '—'}</Td>
                      </View>
                      <Td w={48}>{r.posicao ?? '—'}</Td>
                      <Td w={230}>{r.concorrente ?? '—'}</Td>
                      <Td w={150}>{r.cnpjConcorrente ?? '—'}</Td>
                      <Td w={120} right bold>{fmtBRL(r.precoEstimadoUnit)}</Td>
                    </View>
                  ))}
                  <View style={[tbl.row, tbl.totalRow]}>
                    <View style={[tbl.accent, { backgroundColor: ACCENT }]} />
                    <Td w={46} bold>Total</Td>
                    <Td w={46}> </Td>
                    <Td w={150}> </Td>
                    <Td w={120}> </Td>
                    <Td w={48}> </Td>
                    <Td w={230}> </Td>
                    <Td w={150}> </Td>
                    <Td w={120} right bold>{fmtBRL(rankingTotal)}</Td>
                  </View>
                </ScrollView>
                </TableScroll>
              </Panel>

              <Panel title="Produto Candidato — quantidade por mês">
                <View style={s.legendWrap}>
                  {products.map((p) => (
                    <View key={p.name} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: p.color, opacity: active.has(p.name) ? 1 : 0.3 }]} />
                      <Text style={[s.legendTxt, !active.has(p.name) && { opacity: 0.4 }]}>{p.name}</Text>
                    </View>
                  ))}
                </View>
                <StreamChart months={months} byMonthProduct={byMonthProduct} products={products.filter((p) => active.has(p.name))} />
              </Panel>
            </View>

            {/* RIGHT */}
            <View style={[s.right, narrow && s.fullW]}>
              <Panel title="Item(ns) do Processo">
                {selected ? (
                  <TableScroll minWidth={414}>
                    <View style={tbl.headerRow}>
                      <Th w={150}>Etapa do Item</Th>
                      <Th w={42}>#Lote</Th>
                      <Th w={42}>#Item</Th>
                      <Th w={120}>Produto</Th>
                      <Th w={60} right>Qtde</Th>
                    </View>
                    {selItems.map((it, idx) => {
                      const on = idx === selectedItem;
                      return (
                        <Pressable key={it.id} onPress={() => setSelectedItem(idx)} style={[tbl.row, idx % 2 === 1 && tbl.rowAlt, on && tbl.rowSel]}>
                          <Td w={150}>{it.etapaItem ?? '—'}</Td>
                          <Td w={42}>{it.lote ?? '—'}</Td>
                          <Td w={42}>{it.item ?? '—'}</Td>
                          <View style={{ width: 120, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={[tbl.dot, { backgroundColor: colorFor(it.produtoCandidato ?? '', 0) }]} />
                            <Td w={98} color={colorFor(it.produtoCandidato ?? '', 0)} bold>{it.produtoCandidato ?? '—'}</Td>
                          </View>
                          <Td w={60} right>{it.quantidade ?? '—'}</Td>
                        </Pressable>
                      );
                    })}
                  </TableScroll>
                ) : <Text style={tbl.empty}>Selecione um processo.</Text>}
              </Panel>

              <Panel title="Descrição Completa do Item Selecionado">
                <View style={s.descBox}>
                  {descItem ? (
                    <>
                      <View style={s.descHeader}>
                        <View style={[tbl.dot, { backgroundColor: colorFor(descItem.produtoCandidato ?? '', 0) }]} />
                        <Text style={[s.descProduct, { color: colorFor(descItem.produtoCandidato ?? '', 0) }]}>
                          {descItem.produtoCandidato ?? '—'} · {descItem.produto ?? ''}
                        </Text>
                      </View>
                      <Text style={s.descTxt}>{descItem.produtoLicitado ?? 'Sem descrição.'}</Text>
                    </>
                  ) : <Text style={tbl.empty}>Nenhum item selecionado.</Text>}
                </View>
              </Panel>

              <View style={s.ufRow}>
                <Select id="uf"  label="UF"     value={uf}     options={opts.uf}  onChange={setUf}     openId={openId} setOpenId={setOpenId} />
                <Select id="reg" label="Região" value={regiao} options={opts.reg} onChange={setRegiao} openId={openId} setOpenId={setOpenId} />
              </View>

              <Panel title="Produto Candidato">
                <ProductFilter products={products} totals={productTotals} active={active} onToggle={toggleProduct} />
              </Panel>
            </View>
          </View>

          {/* ─── Footer ───────────────────────────────────────────────────── */}
          <View style={s.footer}>
            <View style={s.footerBadge}>
              <Text style={s.footerTxt}>ESCALE SEUS NEGÓCIOS COM A </Text>
              <Text style={s.footerBrand}>BR4 LICITAÇÕES</Text>
            </View>
          </View>
        </View>

        {/* Tooltip estilo Power BI (segue o cursor sobre Processos/Ranking) */}
        {hover && (
          <HoverCard
            x={hover.x} y={hover.y} vw={width} vh={height}
            fields={hover.kind === 'proc' ? [
              { label: 'Status', value: hover.row.status },
              { label: 'UF', value: hover.row.uf },
              { label: 'Licitador - Nome Longo', value: hover.row.licitador },
              { label: 'No. Edital', value: hover.row.nEdital },
              { label: 'No. Processo', value: hover.row.nProcesso },
              { label: 'Data do Certame', value: fmtDate(hover.row.dataHoraCertame) },
              { label: 'Url Site', value: hover.row.urlSite },
              { label: 'Situação da Abertura', value: hover.row.encerramento },
              { label: 'MJ?', value: hover.row.mandadoJudicial },
              { label: 'Nome Site', value: hover.row.nomeSite },
              { label: 'ID PNCP', value: hover.row.idSite },
              { label: 'Link Edital', value: hover.row.linkEdital },
              { label: 'Link Ata', value: hover.row.linkAta },
            ] : [
              { label: '#Lote', value: hover.row.lote },
              { label: '#Item', value: hover.row.item },
              { label: 'Etapa da Sessão', value: hover.row.etapaSessao },
              { label: 'Produto Candidato', value: hover.row.produtoCandidato },
              { label: '#Posição', value: hover.row.posicao },
              { label: 'Concorrente', value: hover.row.concorrente },
              { label: 'CNPJ Concorrente', value: hover.row.cnpjConcorrente },
              { label: 'Data Posição', value: fmtDate(hover.row.dataPosicao) },
              { label: 'Preço Estimado Unit.', value: fmtBRL(hover.row.precoEstimadoUnit) },
              { label: 'Link Doc Concorrente', value: hover.row.linkDocConcorrente },
            ]}
          />
        )}
    </ScrollView>
  );
}

// ─── Table styles ─────────────────────────────────────────────────────────────
const tbl = StyleSheet.create({
  headerRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: COLORS.gray[200] },
  th:           { fontSize: 11, fontWeight: '800', color: COLORS.gray[600], paddingHorizontal: 4 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  rowAlt:       { backgroundColor: COLORS.gray[50] },
  rowSel:       { backgroundColor: ACCENT + '1a' },
  td:           { fontSize: FONTS.sm, color: COLORS.gray[700], paddingHorizontal: 4 },
  accent:       { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 4 },
  accentSpacer: { width: 8 },
  statusPill:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusTxt:    { fontSize: 11, fontWeight: '700' },
  dot:          { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  totalRow:     { borderTopWidth: 2, borderTopColor: COLORS.gray[300], backgroundColor: COLORS.gray[50] },
  empty:        { fontSize: FONTS.sm, color: COLORS.gray[400], padding: SPACING.md, textAlign: 'center' as any },
});

// ─── Screen styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: COLORS.gray[100] },
  scrollContent: { padding: SPACING.md },
  canvas:        { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray[50], padding: SPACING.xl },
  centerTxt: { marginTop: SPACING.md, fontSize: FONTS.base, color: COLORS.gray[500], textAlign: 'center' },

  header:    { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' as any, rowGap: SPACING.md, columnGap: SPACING.lg, paddingBottom: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], zIndex: 60 },
  titleBlock:{ flexShrink: 1, flexGrow: 1, minWidth: 260 },
  brandBox:  { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  brandMark: { fontSize: 30, fontWeight: '900', color: BRAND, letterSpacing: 1 },
  brandSub:  { fontSize: 9, fontWeight: '800', color: ACCENT, letterSpacing: 3 },
  kicker:    { fontSize: 11, fontWeight: '700', color: COLORS.gray[400], letterSpacing: 1 },
  title:     { fontSize: 26, fontWeight: '900', color: COLORS.gray[900], marginTop: 2 },
  topFilters:{ flexDirection: 'row', flexWrap: 'wrap' as any, gap: SPACING.md, flexGrow: 1, flexShrink: 1, flexBasis: 520, zIndex: 60 },
  topFiltersNarrow: { flexBasis: '100%' as any },

  body:  { flexDirection: 'row', gap: SPACING.lg, paddingTop: SPACING.lg, alignItems: 'flex-start' },
  left:  { flex: 1.7, minWidth: 0 },
  right: { flex: 1, minWidth: 300 },
  fullW: { flexGrow: 0, flexShrink: 1, flexBasis: 'auto' as any, width: '100%' as any, minWidth: 0 },

  legendWrap: { flexDirection: 'row', flexWrap: 'wrap' as any, gap: SPACING.md, marginBottom: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 9, height: 9, borderRadius: 5 },
  legendTxt:  { fontSize: 11, color: COLORS.gray[600], fontWeight: '600' },

  descBox:     { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 110, backgroundColor: COLORS.gray[50] },
  descHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  descProduct: { fontSize: FONTS.base, fontWeight: '800', flex: 1 },
  descTxt:     { fontSize: FONTS.sm, color: COLORS.gray[700], lineHeight: 20 },

  ufRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md, zIndex: 40 },

  footer:      { alignItems: 'flex-end', paddingTop: SPACING.md },
  footerBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: ACCENT, borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  footerTxt:   { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600', fontStyle: 'italic' as any },
  footerBrand: { fontSize: FONTS.sm, color: BRAND, fontWeight: '900' },
});
