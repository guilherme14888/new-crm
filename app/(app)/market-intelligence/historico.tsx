import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useMarketIntelStore } from '../../../src/stores/marketIntelStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';

const BRAND = '#7b2d8e';
const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const fmtNum = (n: number) => (n || 0).toLocaleString('pt-BR');

// Estilo do selo de status de cada dia.
function statusBadge(status: string, erros: number) {
  if (erros > 0) return { bg: '#f59e0b22', fg: '#b45309', label: `${erros} erro(s)` };
  if (status === 'sem execução') return { bg: '#ef444418', fg: '#dc2626', label: 'Sem execução' };
  if (status === 'catchup') return { bg: COLORS.gray[100], fg: COLORS.gray[500], label: 'Catch-up' };
  if (status === 'parcial') return { bg: '#f59e0b22', fg: '#b45309', label: 'Parcial' };
  return { bg: '#16a34a18', fg: '#16a34a', label: 'OK' };
}

/** Histórico de Mineração: monitoria DIÁRIA da coleta (varridas/inseridas/erros por
 *  dia, incluindo dias zerados e sem execução) + detalhe por palavra-chave.
 *  Master vê todos os tenants (com filtro); demais veem o seu. */
export default function HistoricoMineracao() {
  const mining      = useMarketIntelStore((s) => s.mining);
  const loading     = useMarketIntelStore((s) => s.miningLoading);
  const loadMining  = useMarketIntelStore((s) => s.loadMining);
  const [company, setCompany] = useState('all');
  const [open, setOpen] = useState(false);

  useEffect(() => { loadMining(company); }, [company]);

  const isMaster = !!mining?.isMaster;
  const showAll = isMaster && company === 'all';
  const daily = mining?.daily ?? [];

  // ── Pivot da seção "detalhe por palavra-chave" (dias × termos) ──────────────
  const { days, columns, matrix } = useMemo(() => {
    const rows = mining?.rows ?? [];
    const dSet = new Set<string>();
    const colMap = new Map<string, { key: string; termo: string; companyName: string | null }>();
    const mtx = new Map<string, Map<string, number>>();
    for (const r of rows) {
      dSet.add(r.date);
      const key = showAll ? `${r.companyId}|${r.termo}` : r.termo;
      if (!colMap.has(key)) colMap.set(key, { key, termo: r.termo, companyName: showAll ? r.companyName : null });
      if (!mtx.has(r.date)) mtx.set(r.date, new Map());
      mtx.get(r.date)!.set(key, (mtx.get(r.date)!.get(key) ?? 0) + r.count);
    }
    const cols = Array.from(colMap.values()).sort((a, b) =>
      (a.companyName || '').localeCompare(b.companyName || '') || a.termo.localeCompare(b.termo));
    return { days: Array.from(dSet).sort().reverse(), columns: cols, matrix: mtx };
  }, [mining, showAll]);

  const companyOptions = useMemo(() => [{ id: 'all', name: 'Todas as empresas' }, ...(mining?.companies ?? [])], [mining]);
  const selName = companyOptions.find((c) => c.id === company)?.name ?? 'Todas as empresas';

  // Totais do período (cabeçalho de resumo).
  const totals = useMemo(() => daily.reduce((a, d) => ({
    varridas: a.varridas + d.varridas, inseridas: a.inseridas + d.inseridas, erros: a.erros + d.erros,
  }), { varridas: 0, inseridas: 0, erros: 0 }), [daily]);

  return (
    <ScrollView style={st.screen} contentContainerStyle={{ padding: SPACING.lg }}>
      <Text style={st.title}>Histórico de Mineração</Text>
      <Text style={st.sub}>Monitoria diária da coleta: quantas oportunidades foram varridas, quantas entraram novas e se houve erro — todos os dias (inclusive os zerados).</Text>

      {/* Filtro de tenant (só master) */}
      {isMaster && (
        <View style={{ zIndex: 10, marginBottom: SPACING.md }}>
          <Text style={st.label}>Empresa (tenant)</Text>
          <View style={{ position: 'relative' as any, maxWidth: 320 }}>
            <Pressable style={st.ddTrigger} onPress={() => setOpen((v) => !v)}>
              <Text style={st.ddVal} numberOfLines={1}>{selName}</Text>
              <Text style={st.ddChev}>{open ? '▴' : '▾'}</Text>
            </Pressable>
            {open && (
              <View style={st.ddList}>
                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                  {companyOptions.map((c) => (
                    <Pressable key={c.id} style={[st.ddItem, c.id === company && st.ddItemOn]} onPress={() => { setCompany(c.id); setOpen(false); }}>
                      <Text style={[st.ddItemTxt, c.id === company && st.ddItemTxtOn]} numberOfLines={1}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      )}

      {loading && !mining ? (
        <View style={{ padding: SPACING.xl, alignItems: 'center' }}><ActivityIndicator color={BRAND} /></View>
      ) : (
        <>
          {/* Resumo do período */}
          <View style={st.kpis}>
            <View style={st.kpi}><Text style={st.kpiVal}>{fmtNum(totals.varridas)}</Text><Text style={st.kpiLbl}>varridas (30d)</Text></View>
            <View style={st.kpi}><Text style={[st.kpiVal, { color: BRAND }]}>{fmtNum(totals.inseridas)}</Text><Text style={st.kpiLbl}>inseridas (30d)</Text></View>
            <View style={st.kpi}><Text style={[st.kpiVal, { color: totals.erros > 0 ? '#dc2626' : COLORS.gray[700] }]}>{fmtNum(totals.erros)}</Text><Text style={st.kpiLbl}>erros (30d)</Text></View>
          </View>

          {/* ── Tabela de monitoria diária ── */}
          <Text style={st.section}>Monitoria diária</Text>
          <View style={st.table}>
            <View style={[st.row, st.headRow]}>
              <Text style={[st.cDay, st.h]}>Dia</Text>
              <Text style={[st.cNum, st.h]}>Varridas</Text>
              <Text style={[st.cNum, st.h]}>Pré-filtr.</Text>
              <Text style={[st.cNum, st.h]}>Inseridas</Text>
              <Text style={[st.cNum, st.h]}>Atualiz.</Text>
              <Text style={[st.cStatus, st.h]}>Status</Text>
            </View>
            {daily.map((d, i) => {
              const b = statusBadge(d.status, d.erros);
              return (
                <View key={d.date} style={[st.row, i % 2 === 1 && st.rowAlt]}>
                  <Text style={st.cDay}>{fmtDate(d.date)}</Text>
                  <Text style={[st.cNum, d.varridas > 0 && st.strong]}>{d.varridas > 0 ? fmtNum(d.varridas) : '—'}</Text>
                  <Text style={st.cNum}>{d.preFiltradas > 0 ? fmtNum(d.preFiltradas) : '—'}</Text>
                  <Text style={[st.cNum, d.inseridas > 0 && st.insStrong]}>{d.inseridas > 0 ? fmtNum(d.inseridas) : '0'}</Text>
                  <Text style={st.cNum}>{d.atualizadas > 0 ? fmtNum(d.atualizadas) : '—'}</Text>
                  <View style={st.cStatus}>
                    <View style={[st.badge, { backgroundColor: b.bg }]}><Text style={[st.badgeTxt, { color: b.fg }]}>{b.label}</Text></View>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={st.legend}>“Varridas” = contratações enumeradas pela varredura (PNCP). “Inseridas” = registros novos no dia. “—” = não houve varredura naquele dia. Dias “Sem execução” indicam lacuna na coleta.</Text>

          {/* ── Detalhe por palavra-chave (o que cada termo trouxe) ── */}
          {days.length > 0 && (
            <>
              <Text style={[st.section, { marginTop: SPACING.xl }]}>Detalhe por palavra-chave (novos por dia)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator style={st.kwWrap}>
                <View>
                  <View style={[st.kwRow, st.headRow]}>
                    <View style={[st.kwDay, st.kwHeadCell]}><Text style={st.h}>Dia</Text></View>
                    {columns.map((c) => (
                      <View key={c.key} style={[st.kwCell, st.kwHeadCell]}>
                        <Text style={st.kwTermo} numberOfLines={2}>{c.termo}</Text>
                        {showAll && <Text style={st.kwTenant} numberOfLines={1}>{c.companyName}</Text>}
                      </View>
                    ))}
                  </View>
                  {days.map((d, i) => {
                    const dm = matrix.get(d);
                    return (
                      <View key={d} style={[st.kwRow, i % 2 === 1 && st.rowAlt]}>
                        <View style={st.kwDay}><Text style={st.cDay}>{fmtDate(d)}</Text></View>
                        {columns.map((c) => {
                          const v = dm?.get(c.key) ?? 0;
                          return (
                            <View key={c.key} style={st.kwCell}>
                              <Text style={[st.kwTxt, v > 0 ? st.strong : st.zero]}>{v > 0 ? v : '·'}</Text>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: COLORS.gray[50] },
  title:   { fontSize: FONTS['2xl'], fontWeight: '900', color: COLORS.gray[900] },
  sub:     { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2, marginBottom: SPACING.lg },
  label:   { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '700', marginBottom: 4 },
  section: { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.gray[800], marginBottom: SPACING.sm },
  legend:  { fontSize: 11, color: COLORS.gray[400], marginTop: SPACING.sm },

  ddTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  ddVal:   { flex: 1, fontSize: FONTS.sm, color: COLORS.gray[800], fontWeight: '600' },
  ddChev:  { fontSize: 11, color: COLORS.gray[500], marginLeft: SPACING.sm },
  ddList:  { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, marginTop: 4, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, zIndex: 30, overflow: 'hidden', ...(Platform.OS === 'web' ? { boxShadow: '0 8px 22px rgba(0,0,0,0.14)' } as any : { elevation: 8 }) },
  ddItem:  { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  ddItemOn:{ backgroundColor: BRAND + '12' },
  ddItemTxt:{ fontSize: FONTS.sm, color: COLORS.gray[700] },
  ddItemTxtOn:{ color: BRAND, fontWeight: '700' },

  kpis:    { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  kpi:     { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, minWidth: 130 },
  kpiVal:  { fontSize: FONTS.xl, fontWeight: '900', color: COLORS.gray[900] },
  kpiLbl:  { fontSize: FONTS.xs, color: COLORS.gray[500], marginTop: 2 },

  table:   { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: SPACING.sm },
  rowAlt:  { backgroundColor: COLORS.gray[50] },
  headRow: { backgroundColor: COLORS.white, borderBottomWidth: 2, borderBottomColor: COLORS.gray[200] },
  h:       { fontSize: 11, fontWeight: '800', color: COLORS.gray[600] },
  cDay:    { width: 92, fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '600' },
  cNum:    { flex: 1, textAlign: 'right', fontSize: FONTS.sm, color: COLORS.gray[600], paddingRight: SPACING.sm },
  cStatus: { width: 120, alignItems: 'flex-end' },
  strong:  { color: COLORS.gray[900], fontWeight: '700' },
  insStrong: { color: BRAND, fontWeight: '800' },
  badge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt:{ fontSize: 11, fontWeight: '800' },

  kwWrap:  { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100] },
  kwRow:   { flexDirection: 'row', alignItems: 'stretch' },
  kwHeadCell:{ minHeight: 52, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: COLORS.gray[200] },
  kwDay:   { width: 92, paddingHorizontal: SPACING.sm, paddingVertical: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.gray[100] },
  kwCell:  { width: 92, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.gray[50] },
  kwTermo: { fontSize: 11, fontWeight: '800', color: COLORS.gray[700], textAlign: 'center' },
  kwTenant:{ fontSize: 9, color: COLORS.gray[400], textAlign: 'center', marginTop: 2 },
  kwTxt:   { fontSize: FONTS.sm },
  zero:    { color: COLORS.gray[300] },
});
