import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useMarketIntelStore } from '../../../src/stores/marketIntelStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';

const BRAND = '#7b2d8e';
const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** Histórico de Mineração: tabela dias × palavras-chave do que foi coletado NOVO
 *  em cada ingestão. Master vê todos os tenants (com filtro); demais veem o seu. */
export default function HistoricoMineracao() {
  const mining      = useMarketIntelStore((s) => s.mining);
  const loading     = useMarketIntelStore((s) => s.miningLoading);
  const loadMining  = useMarketIntelStore((s) => s.loadMining);
  const [company, setCompany] = useState('all');
  const [open, setOpen] = useState(false);

  useEffect(() => { loadMining(company); }, [company]);

  const isMaster = !!mining?.isMaster;
  const showAll = isMaster && company === 'all';

  // ── Pivot: dias (linhas) × colunas (termo, ou termo×tenant quando "todas") ──
  const { days, columns, matrix, totalByCol } = useMemo(() => {
    const rows = mining?.rows ?? [];
    const dSet = new Set<string>();
    const colMap = new Map<string, { key: string; termo: string; companyName: string | null }>();
    const mtx = new Map<string, Map<string, number>>();
    const totals: Record<string, number> = {};
    for (const r of rows) {
      dSet.add(r.date);
      const key = showAll ? `${r.companyId}|${r.termo}` : r.termo;
      if (!colMap.has(key)) colMap.set(key, { key, termo: r.termo, companyName: showAll ? r.companyName : null });
      if (!mtx.has(r.date)) mtx.set(r.date, new Map());
      mtx.get(r.date)!.set(key, (mtx.get(r.date)!.get(key) ?? 0) + r.count);
      totals[key] = (totals[key] ?? 0) + r.count;
    }
    const cols = Array.from(colMap.values()).sort((a, b) =>
      (a.companyName || '').localeCompare(b.companyName || '') || a.termo.localeCompare(b.termo));
    return { days: Array.from(dSet).sort().reverse(), columns: cols, matrix: mtx, totalByCol: totals };
  }, [mining, showAll]);

  const companyOptions = useMemo(() => [{ id: 'all', name: 'Todas as empresas' }, ...(mining?.companies ?? [])], [mining]);
  const selName = companyOptions.find((c) => c.id === company)?.name ?? 'Todas as empresas';

  return (
    <ScrollView style={st.screen} contentContainerStyle={{ padding: SPACING.lg }}>
      <Text style={st.title}>Histórico de Mineração</Text>
      <Text style={st.sub}>Itens novos coletados por dia, separados por palavra-chave (o que cada ingestão trouxe de novo).</Text>

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
      ) : days.length === 0 ? (
        <Text style={st.empty}>Nenhuma mineração registrada ainda para este filtro.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={st.tableWrap}>
          <View>
            {/* Cabeçalho */}
            <View style={[st.row, st.headRow]}>
              <View style={[st.cellDay, st.headCell]}><Text style={st.headDayTxt}>Dia</Text></View>
              {columns.map((c) => (
                <View key={c.key} style={[st.cell, st.headCell]}>
                  <Text style={st.headTermo} numberOfLines={2}>{c.termo}</Text>
                  {showAll && <Text style={st.headTenant} numberOfLines={1}>{c.companyName}</Text>}
                </View>
              ))}
            </View>
            {/* Linhas por dia */}
            {days.map((d, i) => {
              const dm = matrix.get(d);
              return (
                <View key={d} style={[st.row, i % 2 === 1 && st.rowAlt]}>
                  <View style={st.cellDay}><Text style={st.dayTxt}>{fmtDate(d)}</Text></View>
                  {columns.map((c) => {
                    const v = dm?.get(c.key) ?? 0;
                    return (
                      <View key={c.key} style={st.cell}>
                        <Text style={[st.cellTxt, v > 0 ? st.cellTxtOn : st.cellZero]}>{v > 0 ? v : '·'}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
            {/* Total por coluna */}
            <View style={[st.row, st.totalRow]}>
              <View style={st.cellDay}><Text style={[st.dayTxt, { fontWeight: '800' }]}>Total</Text></View>
              {columns.map((c) => (
                <View key={c.key} style={st.cell}><Text style={[st.cellTxt, { fontWeight: '800', color: BRAND }]}>{totalByCol[c.key] ?? 0}</Text></View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: COLORS.gray[50] },
  title:   { fontSize: FONTS['2xl'], fontWeight: '900', color: COLORS.gray[900] },
  sub:     { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2, marginBottom: SPACING.lg },
  label:   { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '700', marginBottom: 4 },
  empty:   { fontSize: FONTS.sm, color: COLORS.gray[400], padding: SPACING.xl, textAlign: 'center' },

  ddTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  ddVal:   { flex: 1, fontSize: FONTS.sm, color: COLORS.gray[800], fontWeight: '600' },
  ddChev:  { fontSize: 11, color: COLORS.gray[500], marginLeft: SPACING.sm },
  ddList:  { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, marginTop: 4, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, zIndex: 30, overflow: 'hidden', ...(Platform.OS === 'web' ? { boxShadow: '0 8px 22px rgba(0,0,0,0.14)' } as any : { elevation: 8 }) },
  ddItem:  { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  ddItemOn:{ backgroundColor: BRAND + '12' },
  ddItemTxt:{ fontSize: FONTS.sm, color: COLORS.gray[700] },
  ddItemTxtOn:{ color: BRAND, fontWeight: '700' },

  tableWrap: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100] },
  row:     { flexDirection: 'row', alignItems: 'stretch' },
  rowAlt:  { backgroundColor: COLORS.gray[50] },
  headRow: { borderBottomWidth: 2, borderBottomColor: COLORS.gray[200], backgroundColor: COLORS.white },
  totalRow:{ borderTopWidth: 2, borderTopColor: COLORS.gray[300], backgroundColor: COLORS.gray[50] },
  cellDay: { width: 96, paddingHorizontal: SPACING.sm, paddingVertical: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.gray[100] },
  cell:    { width: 96, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.gray[50] },
  headCell:{ minHeight: 52, justifyContent: 'center' },
  headDayTxt: { fontSize: 11, fontWeight: '800', color: COLORS.gray[600] },
  headTermo:  { fontSize: 11, fontWeight: '800', color: COLORS.gray[700], textAlign: 'center' },
  headTenant: { fontSize: 9, color: COLORS.gray[400], textAlign: 'center', marginTop: 2 },
  dayTxt:  { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '600' },
  cellTxt: { fontSize: FONTS.sm },
  cellTxtOn: { color: COLORS.gray[900], fontWeight: '700' },
  cellZero:  { color: COLORS.gray[300] },
});
