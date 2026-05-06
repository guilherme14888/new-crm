import React, { useEffect, useMemo } from 'react';
import { ScrollView, View, Text, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { useDealStore } from '../../../src/stores/dealStore';
import { useContactStore } from '../../../src/stores/contactStore';
import { useActivityStore } from '../../../src/stores/activityStore';
import { useFunnelStore } from '../../../src/stores/funnelStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { RecentActivityList } from '../../../src/components/dashboard/RecentActivityList';
import { Card } from '../../../src/components/ui/Card';
import { formatCurrency } from '../../../src/utils/currency';
import { startOfMonth } from '../../../src/utils/date';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, accent = COLORS.primary, bg,
}: { label: string; value: string; sub?: string; accent?: string; bg?: string }) {
  return (
    <Card style={[mc.card, bg ? { backgroundColor: bg } : undefined]}>
      <Text style={mc.label}>{label}</Text>
      <Text style={[mc.value, { color: accent }]}>{value}</Text>
      {sub ? <Text style={mc.sub}>{sub}</Text> : null}
    </Card>
  );
}
const mc = StyleSheet.create({
  card:  { flex: 1, margin: SPACING.xs, padding: SPACING.md },
  label: { fontSize: FONTS.sm, color: COLORS.gray[500], marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '800' },
  sub:   { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
});

// ─── Pipeline stage bar chart ─────────────────────────────────────────────────
function PipelineChart({
  stages, dealsByStageId,
}: {
  stages: { id: string; name: string; color: string; type?: string }[];
  dealsByStageId: Record<string, { count: number; value: number }>;
}) {
  const active = stages.filter((s) => s.type !== 'won' && s.type !== 'lost');
  const maxValue = Math.max(1, ...active.map((s) => dealsByStageId[s.id]?.value ?? 0));

  if (active.length === 0) {
    return <Text style={{ color: COLORS.gray[400], fontSize: FONTS.sm, padding: SPACING.md }}>Sem etapas configuradas.</Text>;
  }

  return (
    <View style={pc.container}>
      {active.map((stage) => {
        const data = dealsByStageId[stage.id] ?? { count: 0, value: 0 };
        const pct  = data.value / maxValue;
        return (
          <View key={stage.id} style={pc.row}>
            <View style={pc.labelWrap}>
              <View style={[pc.dot, { backgroundColor: stage.color }]} />
              <Text style={pc.stageLabel} numberOfLines={1}>{stage.name}</Text>
            </View>
            <View style={pc.barWrap}>
              <View style={[pc.bar, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: stage.color + 'dd' }]} />
            </View>
            <View style={pc.meta}>
              <Text style={pc.count}>{data.count}</Text>
              <Text style={pc.val} numberOfLines={1}>{formatCurrency(data.value)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
const pc = StyleSheet.create({
  container: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  labelWrap: { width: 110, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stageLabel: { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '500', flex: 1 },
  barWrap: { flex: 1, height: 14, backgroundColor: COLORS.gray[100], borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  meta: { width: 90, alignItems: 'flex-end' },
  count: { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '600' },
  val: { fontSize: 10, color: COLORS.gray[400] },
});

// ─── Won/Lost summary row ─────────────────────────────────────────────────────
function WonLostBar({
  wonCount, wonValue, lostCount, lostValue,
}: { wonCount: number; wonValue: number; lostCount: number; lostValue: number }) {
  return (
    <View style={wl.row}>
      <View style={[wl.half, { borderRightWidth: 1, borderRightColor: COLORS.gray[100] }]}>
        <Text style={wl.icon}>✓</Text>
        <View>
          <Text style={[wl.count, { color: '#16a34a' }]}>{wonCount} ganhos</Text>
          <Text style={wl.value}>{formatCurrency(wonValue)}</Text>
        </View>
      </View>
      <View style={wl.half}>
        <Text style={[wl.icon, { color: '#ef4444' }]}>✗</Text>
        <View>
          <Text style={[wl.count, { color: '#ef4444' }]}>{lostCount} perdidos</Text>
          <Text style={wl.value}>{formatCurrency(lostValue)}</Text>
        </View>
      </View>
    </View>
  );
}
const wl = StyleSheet.create({
  row:   { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: RADIUS.md, marginBottom: SPACING.sm, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.gray[100] },
  half:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  icon:  { fontSize: 22, color: '#16a34a', fontWeight: '800' },
  count: { fontSize: FONTS.base, fontWeight: '700' },
  value: { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 1 },
});

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const loadDeals    = useDealStore((s) => s.loadDeals);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const { recent, loadRecent } = useActivityStore();
  const deals        = useDealStore((s) => s.deals);
  const contacts     = useContactStore((s) => s.contacts);
  const funnels      = useFunnelStore((s) => s.funnels);
  const activeFunnelId = useFunnelStore((s) => s.activeFunnelId);
  const loadFunnels  = useFunnelStore((s) => s.loadFunnels);

  const companyId   = useAuthStore((s) => s.user?.companyId);
  const companyName = useAuthStore((s) => s.user?.companyName);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => { loadAll(); }, [companyId]);

  const loadAll = async () => {
    await Promise.all([loadDeals(), loadContacts(), loadRecent(), loadFunnels()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // ── Compute metrics ─────────────────────────────────────────────────────────
  const funnel = useMemo(
    () => funnels.find((f) => f.id === activeFunnelId) ?? funnels[0] ?? null,
    [funnels, activeFunnelId]
  );

  const stages = useMemo(() => funnel?.stages ?? [], [funnel]);

  const stageTypeMap = useMemo(
    () => Object.fromEntries(stages.map((s) => [s.id, s.type ?? 'active'])),
    [stages]
  );

  const active = useMemo(() => deals.filter((d) => !d.deletedAt), [deals]);

  const monthStart = useMemo(() => startOfMonth(), []);

  const {
    pipelineValue, inProgressCount,
    wonCount, wonValue, wonThisMonth, wonValueThisMonth,
    lostCount, lostValue, lostThisMonth, lostValueThisMonth,
    conversionRate, dealsByStageId,
  } = useMemo(() => {
    let pipelineValue = 0, inProgressCount = 0;
    let wonCount = 0, wonValue = 0, wonThisMonth = 0, wonValueThisMonth = 0;
    let lostCount = 0, lostValue = 0, lostThisMonth = 0, lostValueThisMonth = 0;
    const byStage: Record<string, { count: number; value: number }> = {};

    for (const d of active) {
      const stageType = stageTypeMap[d.stageId] ?? null;
      const isWon  = d.stage === 'closed_won'  || stageType === 'won';
      const isLost = d.stage === 'closed_lost' || stageType === 'lost';

      if (isWon) {
        wonCount++;
        wonValue += d.value;
        if (d.updatedAt >= monthStart) { wonThisMonth++; wonValueThisMonth += d.value; }
      } else if (isLost) {
        lostCount++;
        lostValue += d.value;
        if (d.updatedAt >= monthStart) { lostThisMonth++; lostValueThisMonth += d.value; }
      } else {
        pipelineValue += d.value;
        inProgressCount++;
        const key = d.stageId || d.stage;
        if (!byStage[key]) byStage[key] = { count: 0, value: 0 };
        byStage[key].count++;
        byStage[key].value += d.value;
      }
    }

    const closed = wonCount + lostCount;
    const conversionRate = closed > 0 ? (wonCount / closed) * 100 : 0;

    return {
      pipelineValue, inProgressCount,
      wonCount, wonValue, wonThisMonth, wonValueThisMonth,
      lostCount, lostValue, lostThisMonth, lostValueThisMonth,
      conversionRate, dealsByStageId: byStage,
    };
  }, [active, stageTypeMap, monthStart]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>Dashboard</Text>
      {companyName && <Text style={styles.companyLabel}>🏢 {companyName}</Text>}
      {funnel && <Text style={styles.funnelLabel}>{funnel.name}</Text>}

      {/* Top metrics */}
      <View style={styles.row}>
        <MetricCard label="Valor do pipeline" value={formatCurrency(pipelineValue)} />
        <MetricCard label="Em andamento" value={String(inProgressCount)} accent={COLORS.gray[800]} />
      </View>

      {/* Won / Lost this month */}
      <View style={styles.row}>
        <MetricCard
          label="Ganhos no mês"
          value={formatCurrency(wonValueThisMonth)}
          sub={`${wonThisMonth} negociações`}
          accent="#16a34a"
          bg="#f0fdf4"
        />
        <MetricCard
          label="Perdidos no mês"
          value={formatCurrency(lostValueThisMonth)}
          sub={`${lostThisMonth} negociações`}
          accent="#ef4444"
          bg="#fef2f2"
        />
      </View>

      {/* Conversion + Contacts */}
      <View style={styles.row}>
        <MetricCard
          label="Taxa de conversão"
          value={`${conversionRate.toFixed(1)}%`}
          sub={`${wonCount} ganhos / ${wonCount + lostCount} fechados`}
          accent="#f59e0b"
        />
        <MetricCard label="Órgãos" value={String(contacts.length)} accent={COLORS.primary} />
      </View>

      {/* Won/Lost totals */}
      <WonLostBar wonCount={wonCount} wonValue={wonValue} lostCount={lostCount} lostValue={lostValue} />

      {/* Pipeline by stage */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Pipeline por etapa</Text>
        <PipelineChart stages={stages} dealsByStageId={dealsByStageId} />
      </Card>

      {/* Recent activity */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Atividade recente</Text>
        <RecentActivityList activities={recent} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: COLORS.gray[50] },
  content: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  heading:      { fontSize: FONTS['2xl'], fontWeight: '800', color: COLORS.gray[900], marginBottom: 2, paddingHorizontal: SPACING.xs },
  companyLabel: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600', marginBottom: 2, paddingHorizontal: SPACING.xs },
  funnelLabel:  { fontSize: FONTS.sm, color: COLORS.gray[400], marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs },
  row:     { flexDirection: 'row', marginBottom: SPACING.xs },
  card:    { marginBottom: SPACING.sm, padding: 0, overflow: 'hidden' },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[800], padding: SPACING.md, paddingBottom: SPACING.sm },
});
