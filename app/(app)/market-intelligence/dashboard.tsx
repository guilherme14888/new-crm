import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, Platform, TextInput } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { useMarketIntelStore, MarketIntelRow } from '../../../src/stores/marketIntelStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { BR_VIEW, BR_UF } from '../../../src/constants/brazilUf';
import { BR_CITIES } from '../../../src/constants/brazilCities';

// ════════════════════════════════════════════════════════════════════════════
//  Inteligência de Mercado — Portfólio de Compras Governamentais
//  Dados espelhados da tabela `market_intelligence` (base Licitações Tracker).
// ════════════════════════════════════════════════════════════════════════════

const ACCENT = '#c9a227';
const BRAND  = '#7b2d8e';
const TODOS  = 'Todos';
// Limite de linhas renderizadas nas tabelas do dashboard (visão analítica).
// Os totais/agregados usam o conjunto COMPLETO; a navegação linha a linha é na Listagem.
const DASH_ROWS = 100;

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
  const webStyle: any = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.gray[200]}`, borderRadius: 6, padding: '6px 8px', fontSize: 13, color: COLORS.gray[700], marginTop: 4, outline: 'none', cursor: 'pointer' };
  const openPicker = (e: any) => { try { e.currentTarget.showPicker && e.currentTarget.showPicker(); } catch { /* ignora */ } };

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
                ? <WebInput type="date" value={from} onChange={(e: any) => setFrom(e.target.value)} onClick={openPicker} onFocus={openPicker} style={webStyle} />
                : <TextInput value={from} onChangeText={setFrom} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.gray[400]} style={drf.input} />}
              <Text style={[drf.lbl, { marginTop: SPACING.sm }]}>Até</Text>
              {isWeb
                ? <WebInput type="date" value={to} onChange={(e: any) => setTo(e.target.value)} onClick={openPicker} onFocus={openPicker} style={webStyle} />
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

// ─── Mapa do Brasil (SVG web, geometria real por UF — ver src/constants/brazilUf) ─
// Centróide projetado (x,y no viewBox) de cada UF — para posicionar os pontos.
const UF_XY: Record<string, [number, number]> = Object.fromEntries(BR_UF.map((u) => [u.uf, [u.cx, u.cy]]));
const UF_BB: Record<string, number[]> = Object.fromEntries(BR_UF.map((u) => [u.uf, u.bb]));
const UF_BY: Record<string, typeof BR_UF[number]> = Object.fromEntries(BR_UF.map((u) => [u.uf, u]));
/** Normaliza nome de cidade para casar com a chave de BR_CITIES ("UF|nome"). */
const normCity = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Rótulos deslocados (UFs pequenas/apertadas) com linha-guia, igual aos mapas usuais.
const LABEL_OVERRIDE: Record<string, [number, number]> = {
  RN: [592, 170], PB: [592, 190], PE: [592, 210], AL: [592, 230], SE: [592, 250],
  ES: [566, 388], RJ: [560, 432], DF: [432, 314],
};

const h = (tag: string, props: any, ...kids: any[]) => React.createElement(tag, props, ...kids);

/** Gráfico de linhas (uma linha por produto, ao longo dos meses) — SVG web. */
function LineChart({ months, byMonthProduct, products }: {
  months: string[]; byMonthProduct: Record<string, Record<string, number>>; products: { name: string; color: string }[];
}) {
  if (Platform.OS !== 'web') return <Text style={tbl.empty}>Disponível na versão web.</Text>;
  if (!months.length) return <Text style={tbl.empty}>Sem dados para os filtros.</Text>;
  const W = 900, H = 220, padL = 44, padB = 26, padT = 10, padR = 10;
  const max = Math.max(1, ...months.flatMap((mk) => products.map((p) => byMonthProduct[mk]?.[p.name] ?? 0)));
  const x = (i: number) => padL + (months.length === 1 ? (W - padL - padR) / 2 : (i / (months.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  return h('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 220 } },
    [0, 0.5, 1].map((g, i) => h('g', { key: `g${i}` },
      h('line', { x1: padL, x2: W - padR, y1: y(max * g), y2: y(max * g), stroke: '#e5e7eb', strokeWidth: 1 }),
      h('text', { x: 4, y: y(max * g) + 3, fontSize: 9, fill: '#9ca3af' }, fmtInt(max * g)),
    )),
    months.map((mk, i) => h('text', { key: `x${mk}`, x: x(i), y: H - 8, fontSize: 9, fill: '#6b7280', textAnchor: 'middle' }, monthLabel(mk))),
    products.map((p) => {
      const pts = months.map((mk, i) => `${x(i)},${y(byMonthProduct[mk]?.[p.name] ?? 0)}`).join(' ');
      return h('g', { key: p.name },
        h('polyline', { points: pts, fill: 'none', stroke: p.color, strokeWidth: 2 }),
        months.map((mk, i) => h('circle', { key: `c${mk}`, cx: x(i), cy: y(byMonthProduct[mk]?.[p.name] ?? 0), r: 2.5, fill: p.color })),
      );
    }),
  );
}

/** Mapa do Brasil com pontos coloridos por produto + filtros locais (produto/UF/tempo). */
function BrazilMap({ rows, products, narrow }: { rows: MarketIntelRow[]; products: { name: string; color: string }[]; narrow: boolean }) {
  const [fProd, setFProd] = useState<Set<string>>(new Set());
  const [fUf, setFUf]     = useState<Set<string>>(new Set());
  const [mFrom, setMFrom] = useState('');
  const [mTo, setMTo]     = useState('');
  const [zoomUf, setZoomUf] = useState<string | null>(null);   // estado em zoom (drill-down)
  const colorOf = (name: string) => products.find((p) => p.name === name)?.color ?? '#7c3aed';

  const ufOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.uf).filter(Boolean) as string[])).sort(), [rows]);
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) =>
    set((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });

  const pts = useMemo(() => {
    const dup: Record<string, number> = {};   // dispersa pontos sobre o MESMO local
    const out: { x: number; y: number; color: string; city: string; prod: string }[] = [];
    for (const r of rows) {
      const uf = r.uf || '';
      if (!UF_XY[uf]) continue;
      if (zoomUf && uf !== zoomUf) continue;                       // em zoom: só o estado
      if (!zoomUf && fUf.size && !fUf.has(uf)) continue;           // no Brasil: filtro de UF
      const prod = r.produtoCandidato || r.produto || '—';
      if (fProd.size && !fProd.has(prod)) continue;
      if (mFrom || mTo) { const d = (r.dataHoraCertame || '').slice(0, 10); if (!d) continue; if (mFrom && d < mFrom) continue; if (mTo && d > mTo) continue; }
      // coordenada EXATA da cidade; se não achar, cai no centróide do estado
      const city = r.municipio ? BR_CITIES[`${uf}|${normCity(r.municipio)}`] : null;
      const base = city || UF_XY[uf];
      const exact = !!city;
      const key = `${base[0]},${base[1]}`;
      const k = dup[key] = (dup[key] ?? 0) + 1;
      // espiral pequena para separar pontos coincidentes (raio menor quando é cidade exata)
      const ang = k * 2.399963; const rad = k === 1 ? 0 : (exact ? 1.6 : 3) + Math.sqrt(k) * (exact ? 1.2 : 2.4);
      out.push({ x: base[0] + Math.cos(ang) * rad, y: base[1] + Math.sin(ang) * rad, color: colorOf(prod), city: r.municipio || uf, prod });
      if (out.length > 2500) break;
    }
    return out;
  }, [rows, fProd, fUf, mFrom, mTo, products, zoomUf]);

  const isWeb = Platform.OS === 'web';
  const WebInput: any = 'input';
  const dateStyle: any = { border: `1px solid ${COLORS.gray[200]}`, borderRadius: 6, padding: '6px 8px', fontSize: 12, color: COLORS.gray[700], outline: 'none', cursor: 'pointer' };
  // abre o calendário nativo ao clicar em qualquer parte do campo
  const openPicker = (e: any) => { try { e.currentTarget.showPicker && e.currentTarget.showPicker(); } catch { /* ignora */ } };

  return (
    <View style={[s.body, narrow && { flexDirection: 'column' as any }]}>
      {/* Filtros do mapa */}
      <View style={mp.filters}>
        <Text style={mp.fTitle}>Filtros do mapa</Text>
        <Text style={mp.fLabel}>Período (data do certame)</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
          {isWeb
            ? <><WebInput type="date" value={mFrom} onChange={(e: any) => setMFrom(e.target.value)} onClick={openPicker} onFocus={openPicker} style={dateStyle} />
                <WebInput type="date" value={mTo} onChange={(e: any) => setMTo(e.target.value)} onClick={openPicker} onFocus={openPicker} style={dateStyle} /></>
            : <Text style={tbl.empty}>web</Text>}
        </View>

        <Text style={mp.fLabel}>Produto</Text>
        <View style={mp.chips}>
          {products.map((p) => {
            const on = fProd.has(p.name);
            return (
              <Pressable key={p.name} style={[mp.chip, on && { backgroundColor: p.color, borderColor: p.color }]} onPress={() => toggle(setFProd, p.name)}>
                <View style={[mp.dot, { backgroundColor: on ? COLORS.white : p.color }]} />
                <Text style={[mp.chipTxt, on && { color: COLORS.white }]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={mp.fLabel}>UF</Text>
        <View style={mp.chips}>
          {ufOpts.map((u) => {
            const on = fUf.has(u);
            return (
              <Pressable key={u} style={[mp.ufChip, on && mp.ufChipOn]} onPress={() => toggle(setFUf, u)}>
                <Text style={[mp.ufChipTxt, on && { color: COLORS.white }]}>{u}</Text>
              </Pressable>
            );
          })}
        </View>
        {(fProd.size || fUf.size || mFrom || mTo) ? (
          <Pressable style={mp.clear} onPress={() => { setFProd(new Set()); setFUf(new Set()); setMFrom(''); setMTo(''); }}>
            <Text style={mp.clearTxt}>Limpar filtros do mapa</Text>
          </Pressable>
        ) : null}
        <Text style={mp.count}>{pts.length.toLocaleString('pt-BR')} ponto(s)</Text>
      </View>

      {/* Mapa */}
      <View style={mp.mapWrap}>
        {/* cabeçalho: voltar / dica de clique */}
        <View style={mp.mapHead}>
          {zoomUf ? (
            <>
              <Pressable style={mp.backBtn} onPress={() => setZoomUf(null)}><Text style={mp.backTxt}>← Brasil</Text></Pressable>
              <Text style={mp.zoomTitle}>{zoomUf} · clique nas bolinhas para ver a cidade</Text>
            </>
          ) : (
            <Text style={mp.hint}>Clique em um estado para ampliar e ver as cidades</Text>
          )}
        </View>
        {(() => {
          if (!isWeb) return <Text style={tbl.empty}>Mapa disponível na versão web.</Text>;
          // viewBox: estado em zoom (bbox com folga) ou Brasil inteiro
          let vb = `0 0 ${BR_VIEW.w} ${BR_VIEW.h}`, vw = BR_VIEW.w;
          if (zoomUf && UF_BB[zoomUf]) {
            const b = UF_BB[zoomUf]; const padX = (b[2] - b[0]) * 0.08, padY = (b[3] - b[1]) * 0.08;
            const x = b[0] - padX, y = b[1] - padY, w = (b[2] - b[0]) + 2 * padX, ht = (b[3] - b[1]) + 2 * padY;
            vb = `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${ht.toFixed(1)}`; vw = Math.max(w, ht);
          }
          const r = Math.max(1.1, (3.4 * vw) / 560);   // mantém tamanho ~constante na tela
          const sw = Math.max(0.3, (0.8 * vw) / 560);
          const statesToDraw = zoomUf ? BR_UF.filter((u) => u.uf === zoomUf) : BR_UF;
          return h('svg', { viewBox: vb, style: { width: '100%', maxWidth: 620, maxHeight: 560 } },
            statesToDraw.map((u) => h('path', {
              key: u.uf, d: u.d, fill: zoomUf ? '#f8fafc' : '#ffffff', stroke: '#4b5563', strokeWidth: sw, fillRule: 'evenodd',
              ...(zoomUf ? {} : { onClick: () => setZoomUf(u.uf), style: { cursor: 'pointer' } }),
            })),
            // rótulos das UFs só no Brasil inteiro
            zoomUf ? null : BR_UF.map((u) => {
              const ov = LABEL_OVERRIDE[u.uf];
              if (ov) return h('g', { key: `t${u.uf}`, onClick: () => setZoomUf(u.uf), style: { cursor: 'pointer' } },
                h('line', { x1: u.cx, y1: u.cy, x2: ov[0] - 1, y2: ov[1] - 3, stroke: '#9ca3af', strokeWidth: 0.6 }),
                h('text', { x: ov[0], y: ov[1], fontSize: 11, fontWeight: 700, fill: '#374151', textAnchor: 'start' }, u.uf),
              );
              return h('text', { key: `t${u.uf}`, x: u.cx, y: u.cy + 3, fontSize: 11, fontWeight: 700, fill: '#374151', textAnchor: 'middle', onClick: () => setZoomUf(u.uf), style: { cursor: 'pointer' } }, u.uf);
            }),
            // pontos coloridos por produto, na coordenada da cidade
            pts.map((p, i) => h('circle', { key: i, cx: p.x.toFixed(1), cy: p.y.toFixed(1), r, fill: p.color, fillOpacity: 0.85, stroke: '#fff', strokeWidth: sw },
              h('title', null, `${p.city} — ${p.prod}`))),
          );
        })()}
      </View>
    </View>
  );
}

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
  useEffect(() => { loadRows(companyId); }, [companyId]);

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

  // Isola um produto no gráfico (clique no legend): deixa só ele visível;
  // clicar de novo no produto já isolado reverte para todos (igual ao mapa).
  const soloProduct = (name: string) => {
    setActiveProducts((prev) => {
      const all = new Set(products.map((p) => p.name));
      const cur = prev ?? all;
      if (cur.size === 1 && cur.has(name)) return all; // já isolado → reverte
      return new Set([name]);
    });
  };

  // ── Visão (padrão / executiva) ────────────────────────────────────────────────
  const [view, setView] = useState<'padrao' | 'executivo'>('padrao');

  // ── KPIs executivos (reagem aos filtros do topo) ──────────────────────────────
  const kpis = useMemo(() => {
    const estimado = filtered.reduce((acc, r) => acc + (r.precoEstimadoTotal ?? 0), 0);
    const final    = filtered.reduce((acc, r) => acc + (r.precoFinalTotal ?? 0), 0);
    const nProc = processes.length;
    // "Venceu AZ" — processos cujo vencedor (posição 1) é a AstraZeneca
    const azProc = new Set<string>();
    for (const r of filtered) {
      if (r.posicao === 1 && /astrazeneca|astra ?zeneca/i.test(r.concorrente || '')) azProc.add(procKey(r));
    }
    return {
      nProc, estimado, final,
      economia: estimado - final,
      venceuAZ: azProc.size,
      ticket: nProc ? final / nProc : 0,
    };
  }, [filtered, processes]);

  // ── Valor por licitador (top) ─────────────────────────────────────────────────
  const valorPorLicitador = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of filtered) {
      const k = r.licitador || '—';
      t[k] = (t[k] ?? 0) + (r.precoEstimadoTotal ?? 0);
    }
    return Object.entries(t).map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total).slice(0, 8);
  }, [filtered]);

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
              <View style={s.viewToggle}>
                {([['padrao', '📊 Padrão'], ['executivo', '📈 Executivo']] as const).map(([v, lbl]) => (
                  <Pressable key={v} style={[s.viewBtn, view === v && s.viewBtnActive]} onPress={() => setView(v)}>
                    <Text style={[s.viewBtnTxt, view === v && s.viewBtnTxtActive]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
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
          {view === 'padrao' ? (
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
                  {processes.slice(0, DASH_ROWS).map(({ key, head }, idx) => {
                    const on = selected?.key === key;
                    const st = STATUS_STYLE[head.status ?? ''] ?? { color: COLORS.gray[600], bg: COLORS.gray[100] };
                    return (
                      <Pressable key={key} onPress={() => { setSelectedKey(key); setSelectedItem(0); }}
                        {...({ onMouseEnter: (e: any) => setHover({ kind: 'proc', row: head, ...evPos(e) }), onMouseLeave: () => setHover((h) => (h && h.row === head ? null : h)) } as any)}
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
                  {processes.length > DASH_ROWS && (
                    <Text style={tbl.more}>
                      mostrando {DASH_ROWS} de {processes.length} processos — use a Listagem para ver todos
                    </Text>
                  )}
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
                  {ranking.slice(0, DASH_ROWS).map((r) => (
                    <View key={r.id} style={tbl.row}
                      {...({ onMouseEnter: (e: any) => setHover({ kind: 'rank', row: r, ...evPos(e) }), onMouseLeave: () => setHover((h) => (h && h.row === r ? null : h)) } as any)}>
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
                  {ranking.length > DASH_ROWS && (
                    <Text style={tbl.more}>
                      mostrando os {DASH_ROWS} maiores de {ranking.length} — Total abaixo considera todos
                    </Text>
                  )}
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
                {active.size < products.length && (
                  <Pressable onPress={() => setActiveProducts(new Set(products.map((p) => p.name)))} style={s.legendReset}>
                    <Text style={s.legendResetTxt}>↩ Mostrar todos ({products.length})</Text>
                  </Pressable>
                )}
                <View style={s.legendWrap}>
                  {products.map((p) => {
                    const on = active.has(p.name);
                    return (
                      <Pressable
                        key={p.name}
                        onPress={() => soloProduct(p.name)}
                        style={[s.legendItem, s.legendItemBtn]}
                        {...({ title: `Isolar ${p.name} no gráfico` } as any)}
                      >
                        <View style={[s.legendDot, { backgroundColor: p.color, opacity: on ? 1 : 0.3 }]} />
                        <Text style={[s.legendTxt, on ? s.legendTxtOn : { opacity: 0.4 }]}>{p.name}</Text>
                      </Pressable>
                    );
                  })}
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
          ) : (
          /* ─── Visão Executiva ─────────────────────────────────────────── */
          <View>
            {/* KPIs */}
            <View style={s.kpiRow}>
              {[
                { label: 'Total de Processos', value: fmtInt(kpis.nProc) },
                { label: 'Valor Estimado Total', value: `R$ ${fmtBRL(kpis.estimado)}`, accent: true },
                { label: 'Valor Final Total', value: `R$ ${fmtBRL(kpis.final)}`, accent: true },
                { label: 'Economia Total', value: `R$ ${fmtBRL(kpis.economia)}`, accent: true },
                { label: 'Venceu AZ', value: fmtInt(kpis.venceuAZ) },
                { label: 'Ticket Médio Final', value: `R$ ${fmtBRL(kpis.ticket)}`, accent: true },
              ].map((k) => (
                <View key={k.label} style={s.kpiCard} {...(Platform.OS === 'web' ? ({ title: `${k.label}: ${k.value}` } as any) : {})}>
                  <Text
                    style={[s.kpiValue, k.accent && { color: BRAND }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                    {...(Platform.OS === 'web' ? ({ title: k.value } as any) : {})}
                  >{k.value}</Text>
                  <Text style={s.kpiLabel}>{k.label}</Text>
                </View>
              ))}
            </View>

            <View style={[s.body, narrow && { flexDirection: 'column' as any }]}>
              {/* Valor por Licitador + linha por produto */}
              <View style={[s.left, narrow && s.fullW]}>
                <Panel title="Valor por Licitador">
                  {valorPorLicitador.length === 0 && <Text style={tbl.empty}>Sem dados.</Text>}
                  {valorPorLicitador.map((l) => {
                    const max = valorPorLicitador[0]?.total || 1;
                    return (
                      <View key={l.name} style={s.licRow}>
                        <Text style={s.licName} numberOfLines={1}>{l.name}</Text>
                        <View style={s.licBarTrack}>
                          <View style={[s.licBarFill, { width: `${(l.total / max) * 100}%` }]} />
                        </View>
                        <Text style={s.licVal}>R$ {fmtBRL(l.total)}</Text>
                      </View>
                    );
                  })}
                </Panel>

                <Panel title="Produto Candidato — quantidade por mês">
                  {active.size < products.length && (
                    <Pressable onPress={() => setActiveProducts(new Set(products.map((p) => p.name)))} style={s.legendReset}>
                      <Text style={s.legendResetTxt}>↩ Mostrar todos ({products.length})</Text>
                    </Pressable>
                  )}
                  <View style={s.legendWrap}>
                    {products.map((p) => {
                      const on = active.has(p.name);
                      return (
                        <Pressable
                          key={p.name}
                          onPress={() => toggleProduct(p.name)}
                          style={[s.legendItem, s.legendItemBtn]}
                          {...({ title: `${on ? 'Ocultar' : 'Mostrar'} ${p.name} no gráfico` } as any)}
                        >
                          <View style={[s.legendDot, { backgroundColor: p.color, opacity: on ? 1 : 0.3 }]} />
                          <Text style={[s.legendTxt, on ? s.legendTxtOn : { opacity: 0.4 }]}>{p.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <LineChart months={months} byMonthProduct={byMonthProduct} products={products.filter((p) => active.has(p.name))} />
                </Panel>
              </View>

              {/* Ranking */}
              <View style={[s.right, narrow && s.fullW]}>
                <Panel title="Ranking de Itens">
                  <TableScroll minWidth={640}>
                    <View style={tbl.headerRow}>
                      <Th w={40}>#L</Th><Th w={40}>#I</Th><Th w={130}>Etapa</Th><Th w={110}>Produto</Th>
                      <Th w={40}>#P</Th><Th w={150}>Concorrente</Th><Th w={100} right>Est. Unit.</Th><Th w={110} right>Est. Total</Th>
                    </View>
                    <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator>
                      {ranking.slice(0, DASH_ROWS).map((r) => (
                        <View key={r.id} style={tbl.row}>
                          <Td w={40}>{r.lote ?? '—'}</Td><Td w={40}>{r.item ?? '—'}</Td>
                          <Td w={130}>{r.etapaSessao ?? '—'}</Td>
                          <Td w={110} color={colorFor(r.produtoCandidato ?? '', 0)} bold>{r.produtoCandidato ?? '—'}</Td>
                          <Td w={40}>{r.posicao ?? '—'}</Td>
                          <Td w={150}>{r.concorrente ?? '—'}</Td>
                          <Td w={100} right>{fmtBRL(r.precoEstimadoUnit)}</Td>
                          <Td w={110} right bold>{fmtBRL(r.precoEstimadoTotal)}</Td>
                        </View>
                      ))}
                      {ranking.length > DASH_ROWS && (
                        <Text style={tbl.more}>mostrando {DASH_ROWS} de {ranking.length}</Text>
                      )}
                      <View style={[tbl.row, tbl.totalRow]}>
                        <Td w={40} bold>Tot</Td><Td w={40}> </Td><Td w={130}> </Td><Td w={110}> </Td>
                        <Td w={40}> </Td><Td w={150}> </Td>
                        <Td w={100} right bold>{fmtBRL(kpis.estimado && ranking.reduce((a, r) => a + (r.precoEstimadoUnit ?? 0), 0))}</Td>
                        <Td w={110} right bold>{fmtBRL(kpis.estimado)}</Td>
                      </View>
                    </ScrollView>
                  </TableScroll>
                </Panel>
              </View>
            </View>

            {/* Mapa do Brasil */}
            <Panel title="Processos no Brasil — pontos por produto">
              <BrazilMap rows={filtered} products={products} narrow={narrow} />
            </Panel>
          </View>
          )}

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
  more:         { fontSize: FONTS.xs, color: COLORS.gray[400], paddingVertical: SPACING.sm, textAlign: 'center' as any, fontStyle: 'italic' as any },
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
  legendItemBtn: { ...(Platform.OS === 'web' ? { cursor: 'pointer', userSelect: 'none' } as any : {}) },
  legendDot:  { width: 9, height: 9, borderRadius: 5 },
  legendTxt:  { fontSize: 11, color: COLORS.gray[600], fontWeight: '600' },
  legendTxtOn:{ color: COLORS.gray[800], fontWeight: '700' },
  legendReset:{ alignSelf: 'flex-start', backgroundColor: COLORS.gray[100], borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, marginBottom: SPACING.sm, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  legendResetTxt: { fontSize: 11, color: BRAND, fontWeight: '800' },

  descBox:     { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 110, backgroundColor: COLORS.gray[50] },
  descHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  descProduct: { fontSize: FONTS.base, fontWeight: '800', flex: 1 },
  descTxt:     { fontSize: FONTS.sm, color: COLORS.gray[700], lineHeight: 20 },

  ufRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md, zIndex: 40 },

  footer:      { alignItems: 'flex-end', paddingTop: SPACING.md },
  footerBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: ACCENT, borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  footerTxt:   { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600', fontStyle: 'italic' as any },
  footerBrand: { fontSize: FONTS.sm, color: BRAND, fontWeight: '900' },

  // Toggle de visão
  viewToggle:   { flexDirection: 'row', gap: 4, marginTop: SPACING.sm, backgroundColor: COLORS.gray[100], borderRadius: RADIUS.full, padding: 3, alignSelf: 'flex-start' },
  viewBtn:      { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full },
  viewBtnActive:{ backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  viewBtnTxt:   { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '700' },
  viewBtnTxtActive: { color: BRAND },

  // KPIs
  kpiRow:   { flexDirection: 'row', flexWrap: 'wrap' as any, gap: SPACING.md, paddingTop: SPACING.lg },
  kpiCard:  { flexGrow: 1, flexBasis: 170, minWidth: 150, backgroundColor: '#f1f8f3', borderWidth: 1, borderColor: '#d6e9db', borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, alignItems: 'center' },
  kpiValue: { fontSize: 19, fontWeight: '900', color: COLORS.gray[900], width: '100%' as any, textAlign: 'center' as any },
  kpiLabel: { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600', marginTop: 2, textAlign: 'center' as any },

  // Valor por licitador
  licRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
  licName:     { width: 150, fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '600' },
  licBarTrack: { flex: 1, height: 16, backgroundColor: COLORS.gray[100], borderRadius: 3, overflow: 'hidden' },
  licBarFill:  { height: '100%', backgroundColor: '#2e9e5b', borderRadius: 3 },
  licVal:      { width: 110, textAlign: 'right' as any, fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[700] },
});

// Estilos do mapa
const mp = StyleSheet.create({
  filters:  { width: 280, flexShrink: 0, paddingRight: SPACING.md },
  fTitle:   { fontSize: FONTS.base, fontWeight: '800', color: COLORS.gray[800], marginBottom: SPACING.sm },
  fLabel:   { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[600], marginTop: SPACING.md, marginBottom: 4 },
  chips:    { flexDirection: 'row', flexWrap: 'wrap' as any, gap: 6 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: COLORS.white },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  chipTxt:  { fontSize: FONTS.xs, color: COLORS.gray[700], fontWeight: '600' },
  ufChip:   { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: COLORS.white },
  ufChipOn: { backgroundColor: BRAND, borderColor: BRAND },
  ufChipTxt:{ fontSize: 11, color: COLORS.gray[600], fontWeight: '700' },
  clear:    { marginTop: SPACING.md, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  clearTxt: { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
  count:    { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600', marginTop: SPACING.md },
  mapWrap:  { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  mapHead:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, alignSelf: 'stretch', marginBottom: SPACING.sm, flexWrap: 'wrap' as any },
  backBtn:  { backgroundColor: COLORS.gray[100], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  backTxt:  { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '700' },
  zoomTitle:{ fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
  hint:     { fontSize: FONTS.xs, color: COLORS.gray[400], fontStyle: 'italic' as any },
});
