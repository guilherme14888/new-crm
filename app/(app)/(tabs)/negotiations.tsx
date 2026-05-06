import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, Modal, TextInput, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useDealStore } from '../../../src/stores/dealStore';
import { useContactStore } from '../../../src/stores/contactStore';
import { useFunnelStore } from '../../../src/stores/funnelStore';
import { useUIStore } from '../../../src/stores/uiStore';
import { useCRMUserStore } from '../../../src/stores/crmUserStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTeamStore } from '../../../src/stores/teamStore';
import { KanbanColumn } from '../../../src/components/kanban/KanbanColumn';
import { KanbanDragProvider, useDragContext } from '../../../src/components/kanban/KanbanDragContext';
import { NewDealModal } from '../../../src/components/deal/NewDealModal';
import { useCompanyStore } from '../../../src/stores/companyStore';
import { formatCurrency } from '../../../src/utils/currency';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { Deal, FunnelStage } from '../../../src/types/models';

const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

// ─── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'list' | 'kanban';
type OwnerFilter = string; // 'all' | 'mine' | 'user:{id}' | 'team:{id}'
type StatusFilter = 'all' | 'active' | 'won' | 'lost';
type SortOption = 'created_desc' | 'created_asc' | 'value_desc' | 'value_asc' | 'name_asc';

interface Filters {
  owner: OwnerFilter;
  status: StatusFilter;
  sort: SortOption;
  minValue: string;
  maxValue: string;
  search: string;
}

const DEFAULT_FILTERS: Filters = {
  owner: 'all', status: 'all', sort: 'created_desc', minValue: '', maxValue: '', search: '',
};

// ─── View toggle ───────────────────────────────────────────────────────────────
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <View style={vt.container}>
      <Pressable style={[vt.btn, mode === 'list' && vt.active]} onPress={() => onChange('list')}>
        <Text style={[vt.label, mode === 'list' && vt.activeLabel]}>☰ Lista</Text>
      </Pressable>
      <Pressable style={[vt.btn, mode === 'kanban' && vt.active]} onPress={() => onChange('kanban')}>
        <Text style={[vt.label, mode === 'kanban' && vt.activeLabel]}>🗂 Kanban</Text>
      </Pressable>
    </View>
  );
}
const vt = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: COLORS.gray[100], borderRadius: RADIUS.md, padding: 3 },
  btn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.sm - 1 },
  active: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  label: { fontSize: FONTS.sm, color: COLORS.gray[500], fontWeight: '500' },
  activeLabel: { color: COLORS.gray[900], fontWeight: '700' },
});

// ─── Filter modal ──────────────────────────────────────────────────────────────
function FilterModal({
  visible, filters, onClose, onChange,
}: {
  visible: boolean;
  filters: Filters;
  onClose: () => void;
  onChange: (f: Filters) => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);
  useEffect(() => { setLocal(filters); }, [visible]);

  const pill = (active: boolean) => [fm.pill, active && fm.pillActive] as object[];
  const pillTxt = (active: boolean) => [fm.pillText, active && fm.pillTextActive] as object[];

  const SORT_LABELS: Record<SortOption, string> = {
    created_desc: 'Mais recentes', created_asc: 'Mais antigos',
    value_desc: 'Maior valor', value_asc: 'Menor valor', name_asc: 'Nome A→Z',
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={fm.backdrop} onPress={onClose}>
        <Pressable style={fm.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={fm.header}>
            <Text style={fm.title}>Filtros avançados</Text>
            <Pressable onPress={onClose} style={fm.closeBtn}>
              <Text style={fm.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={fm.body} showsVerticalScrollIndicator={false}>
            {/* Search */}
            <Text style={fm.label}>Buscar</Text>
            <TextInput
              style={fm.input}
              value={local.search}
              onChangeText={(v) => setLocal((f) => ({ ...f, search: v }))}
              placeholder="Título ou órgão..."
            />

            {/* Value range */}
            <Text style={fm.label}>Faixa de valor (R$)</Text>
            <View style={fm.row}>
              <TextInput style={[fm.input, { flex: 1 }]} value={local.minValue} onChangeText={(v) => setLocal((f) => ({ ...f, minValue: v }))} placeholder="Mínimo" keyboardType="numeric" />
              <Text style={fm.rangeSep}>até</Text>
              <TextInput style={[fm.input, { flex: 1 }]} value={local.maxValue} onChangeText={(v) => setLocal((f) => ({ ...f, maxValue: v }))} placeholder="Máximo" keyboardType="numeric" />
            </View>

            {/* Sort */}
            <Text style={fm.label}>Ordenar por</Text>
            <View style={fm.pillRow}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <Pressable key={s} style={pill(local.sort === s)} onPress={() => setLocal((f) => ({ ...f, sort: s }))}>
                  <Text style={pillTxt(local.sort === s)}>{SORT_LABELS[s]}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={fm.footer}>
            <Pressable style={fm.clearBtn} onPress={() => setLocal(DEFAULT_FILTERS)}>
              <Text style={fm.clearTxt}>Limpar</Text>
            </Pressable>
            <Pressable style={fm.applyBtn} onPress={() => { onChange(local); onClose(); }}>
              <Text style={fm.applyTxt}>Aplicar filtros</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const fm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  sheet: {
    marginTop: Platform.OS === 'web' ? 60 : 80, marginRight: SPACING.lg,
    width: 340, backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900] },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 14, color: COLORS.gray[500] },
  body: { maxHeight: 400, padding: SPACING.lg },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs, marginTop: SPACING.sm },
  input: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.base, marginBottom: SPACING.sm, backgroundColor: COLORS.white,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rangeSep: { fontSize: FONTS.sm, color: COLORS.gray[400] },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  pill: { paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.gray[100], borderWidth: 1, borderColor: COLORS.gray[200] },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '500' },
  pillTextActive: { color: COLORS.white, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  clearBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100], alignItems: 'center' },
  clearTxt: { color: COLORS.gray[600], fontWeight: '600', fontSize: FONTS.sm },
  applyBtn: { flex: 2, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  applyTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
});

// ─── Company dropdown (master only) ───────────────────────────────────────────
function CompanyDropdown({
  companies, activeCompanyId, onSelect, isOpen, onOpenChange,
}: {
  companies: { id: string; name: string }[];
  activeCompanyId: string | null;
  onSelect: (id: string | null) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const open = isOpen;
  const active = companies.find((c) => c.id === activeCompanyId);
  const close = () => onOpenChange(false);

  return (
    <View style={cd.wrapper}>
      <Text style={cd.label}>Empresa</Text>
      <View style={cd.anchor}>
        <Pressable style={cd.trigger} onPress={() => onOpenChange(!open)}>
          <Text style={cd.triggerTxt} numberOfLines={1}>{active?.name ?? 'Todas'}</Text>
          <Text style={cd.chevron}>{open ? '▲' : '▼'}</Text>
        </Pressable>

        {open && (
          <>
            <Pressable style={cd.backdrop} onPress={close} />
            <View style={cd.flyout}>
              <Pressable
                style={[cd.item, !activeCompanyId && cd.itemActive]}
                onPress={() => { onSelect(null); close(); }}
              >
                {!activeCompanyId && <Text style={cd.check}>✓</Text>}
                <Text style={[cd.itemTxt, !activeCompanyId && cd.itemTxtActive]} numberOfLines={1}>Todas as empresas</Text>
              </Pressable>
              {companies.map((c) => {
                const isCurrent = c.id === activeCompanyId;
                return (
                  <Pressable
                    key={c.id}
                    style={[cd.item, isCurrent && cd.itemActive]}
                    onPress={() => { onSelect(c.id); close(); }}
                  >
                    {isCurrent && <Text style={cd.check}>✓</Text>}
                    <Text style={[cd.itemTxt, isCurrent && cd.itemTxtActive]} numberOfLines={1}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
const cd = StyleSheet.create({
  wrapper:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, zIndex: 100 },
  label:        { fontSize: FONTS.sm, color: COLORS.gray[400], fontWeight: '500' },
  anchor:       { position: 'relative' as any, zIndex: 100 },
  trigger:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: '#6366f1', minWidth: 140 },
  triggerTxt:   { fontSize: FONTS.sm, color: COLORS.white, fontWeight: '700', flex: 1 },
  chevron:      { fontSize: 10, color: COLORS.white, opacity: 0.8 },
  backdrop:     { position: 'fixed' as any, inset: 0, zIndex: 98 },
  flyout:       { position: 'absolute' as any, top: '100%' as any, left: 0, marginTop: 6, minWidth: 220, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 99, overflow: 'hidden' as any },
  item:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemActive:   { backgroundColor: '#6366f1' + '0d' },
  itemTxt:      { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '500', flex: 1 },
  itemTxtActive:{ color: '#6366f1', fontWeight: '700' },
  check:        { fontSize: 12, color: '#6366f1', fontWeight: '800', width: 16 },
});

// ─── Funnel dropdown ───────────────────────────────────────────────────────────
function FunnelDropdown({
  funnels, activeFunnelId, onSelect, isOpen, onOpenChange,
}: {
  funnels: { id: string; name: string }[];
  activeFunnelId: string | null;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const open = isOpen;
  const active = funnels.find((f) => f.id === activeFunnelId) ?? funnels[0];
  const close = () => onOpenChange(false);

  return (
    <View style={fd.wrapper}>
      <Text style={fd.label}>Funil</Text>
      <View style={fd.anchor}>
        <Pressable style={fd.trigger} onPress={() => onOpenChange(!open)}>
          <Text style={fd.triggerTxt} numberOfLines={1}>{active?.name ?? 'Selecionar'}</Text>
          <Text style={fd.chevron}>{open ? '▲' : '▼'}</Text>
        </Pressable>

        {open && (
          <>
            <Pressable style={fd.backdrop} onPress={close} />
            <View style={fd.flyout}>
              {funnels.map((f) => {
                const isCurrent = f.id === activeFunnelId;
                return (
                  <Pressable
                    key={f.id}
                    style={[fd.item, isCurrent && fd.itemActive]}
                    onPress={() => { onSelect(f.id); close(); }}
                  >
                    {isCurrent && <Text style={fd.check}>✓</Text>}
                    <Text style={[fd.itemTxt, isCurrent && fd.itemTxtActive]} numberOfLines={1}>{f.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
const fd = StyleSheet.create({
  wrapper:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, zIndex: 100 },
  label:        { fontSize: FONTS.sm, color: COLORS.gray[400], fontWeight: '500' },
  anchor:       { position: 'relative' as any, zIndex: 100 },
  trigger:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, minWidth: 140 },
  triggerTxt:   { fontSize: FONTS.sm, color: COLORS.white, fontWeight: '700', flex: 1 },
  chevron:      { fontSize: 10, color: COLORS.white, opacity: 0.8 },
  backdrop:     { position: 'fixed' as any, inset: 0, zIndex: 98 },
  flyout:       { position: 'absolute' as any, top: '100%' as any, left: 0, marginTop: 6, minWidth: 200, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 99, overflow: 'hidden' as any },
  item:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemActive:   { backgroundColor: COLORS.primary + '0d' },
  itemTxt:      { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '500', flex: 1 },
  itemTxtActive:{ color: COLORS.primary, fontWeight: '700' },
  check:        { fontSize: 12, color: COLORS.primary, fontWeight: '800', width: 16 },
});

// ─── Owner dropdown ────────────────────────────────────────────────────────────
function OwnerDropdown({
  value, onChange, users, teams, teamMembers, currentUserId, onLoadTeamMembers, isOpen, onOpenChange,
}: {
  value: string;
  onChange: (v: string) => void;
  users: any[];
  teams: any[];
  teamMembers: Record<string, any[]>;
  currentUserId?: string;
  onLoadTeamMembers: (teamId: string) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const open = isOpen;
  const [search, setSearch] = useState('');

  const close = () => { onOpenChange(false); setSearch(''); };
  const select = (v: string) => { onChange(v); close(); };

  const getLabel = () => {
    if (value === 'all')  return 'Todos';
    if (value === 'mine') return 'Minhas';
    if (value.startsWith('user:')) {
      const u = users.find((u) => u.id === value.slice(5));
      return u?.displayName ?? 'Usuário';
    }
    if (value.startsWith('team:')) {
      const t = teams.find((t) => t.id === value.slice(5));
      return t?.name ?? 'Equipe';
    }
    return 'Todos';
  };

  const q = search.toLowerCase();
  const filteredUsers = users.filter((u) =>
    !q || u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  );
  const filteredTeams = teams.filter((t) => !q || t.name?.toLowerCase().includes(q));
  const showFixed = !q;

  return (
    <View style={od.wrapper}>
      <Text style={od.label}>Responsável</Text>
      <View style={od.anchor}>
        <Pressable style={[od.trigger, value !== 'all' && od.triggerActive]} onPress={() => onOpenChange(!open)}>
          <Text style={[od.triggerTxt, value !== 'all' && od.triggerTxtActive]} numberOfLines={1}>{getLabel()}</Text>
          <Text style={[od.chevron, value !== 'all' && od.chevronActive]}>{open ? '▲' : '▼'}</Text>
        </Pressable>

      {open && (
        <>
          {/* Full-screen backdrop to close on outside click */}
          <Pressable style={od.backdrop} onPress={close} />

          {/* Flyout panel */}
          <View style={od.flyout}>
            {/* Search */}
            <View style={od.searchWrap}>
              <Text style={od.searchIcon}>🔍</Text>
              <TextInput
                style={od.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Pesquisar usuário ou equipe..."
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')}>
                  <Text style={od.searchClear}>✕</Text>
                </Pressable>
              )}
            </View>

            <ScrollView style={od.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Fixed options */}
              {showFixed && (
                <>
                  <Pressable style={[od.item, value === 'all' && od.itemActive]} onPress={() => select('all')}>
                    <Text style={od.itemIcon}>👥</Text>
                    <Text style={[od.itemTxt, value === 'all' && od.itemTxtActive]}>Todos</Text>
                    {value === 'all' && <Text style={od.check}>✓</Text>}
                  </Pressable>
                  <Pressable style={[od.item, value === 'mine' && od.itemActive]} onPress={() => select('mine')}>
                    <Text style={od.itemIcon}>👤</Text>
                    <Text style={[od.itemTxt, value === 'mine' && od.itemTxtActive]}>Minhas negociações</Text>
                    {value === 'mine' && <Text style={od.check}>✓</Text>}
                  </Pressable>
                </>
              )}

              {/* Teams */}
              {filteredTeams.length > 0 && (
                <>
                  <View style={od.section}><Text style={od.sectionTxt}>EQUIPES</Text></View>
                  {filteredTeams.map((team) => {
                    const sel = value === `team:${team.id}`;
                    return (
                      <Pressable
                        key={team.id}
                        style={[od.item, sel && od.itemActive]}
                        onPress={() => { onLoadTeamMembers(team.id); select(`team:${team.id}`); }}
                      >
                        <View style={[od.teamDot, { backgroundColor: team.color }]} />
                        <Text style={[od.itemTxt, sel && od.itemTxtActive]} numberOfLines={1}>{team.name}</Text>
                        {team.memberCount > 0 && (
                          <Text style={od.memberCount}>{team.memberCount} membro{team.memberCount !== 1 ? 's' : ''}</Text>
                        )}
                        {sel && <Text style={od.check}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </>
              )}

              {/* Users */}
              {filteredUsers.length > 0 && (
                <>
                  <View style={od.section}><Text style={od.sectionTxt}>USUÁRIOS</Text></View>
                  {filteredUsers.map((user) => {
                    const sel = value === `user:${user.id}`;
                    return (
                      <Pressable key={user.id} style={[od.item, sel && od.itemActive]} onPress={() => select(`user:${user.id}`)}>
                        {user.avatarUrl
                          ? <Image source={{ uri: user.avatarUrl }} style={od.avatar} />
                          : <View style={od.avatarCircle}><Text style={od.avatarInitial}>{(user.displayName ?? '?')[0].toUpperCase()}</Text></View>
                        }
                        <View style={{ flex: 1 }}>
                          <Text style={[od.itemTxt, sel && od.itemTxtActive]} numberOfLines={1}>{user.displayName}</Text>
                          <Text style={od.userEmail} numberOfLines={1}>{user.email}</Text>
                        </View>
                        {sel && <Text style={od.check}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </>
              )}

              {filteredUsers.length === 0 && filteredTeams.length === 0 && !!q && (
                <Text style={od.noResults}>Nenhum resultado para "{search}"</Text>
              )}
            </ScrollView>
          </View>
        </>
      )}
      </View>
    </View>
  );
}
const od = StyleSheet.create({
  wrapper:          { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, zIndex: 100 },
  anchor:           { position: 'relative' as any, zIndex: 100 },
  label:            { fontSize: FONTS.sm, color: COLORS.gray[400], fontWeight: '500' },
  trigger:          { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[200], minWidth: 100 },
  triggerActive:    { backgroundColor: COLORS.primary },
  triggerTxt:       { fontSize: FONTS.sm, color: COLORS.gray[800], fontWeight: '700', flex: 1 },
  triggerTxtActive: { color: COLORS.white },
  chevron:          { fontSize: 10, color: COLORS.gray[500] },
  chevronActive:    { color: COLORS.white },

  backdrop:  { position: 'fixed' as any, inset: 0, zIndex: 98 },
  flyout:    { position: 'absolute' as any, top: '100%' as any, left: 0, marginTop: 6, width: 320, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 99, overflow: 'hidden' as any },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', margin: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[50], borderWidth: 1, borderColor: COLORS.gray[200] },
  searchIcon:  { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: SPACING.sm, fontSize: FONTS.sm, color: COLORS.gray[900] },
  searchClear: { fontSize: 13, color: COLORS.gray[400], padding: 4 },

  list:        { maxHeight: 340 },
  section:     { paddingHorizontal: SPACING.lg, paddingVertical: 5, backgroundColor: COLORS.gray[50], borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  sectionTxt:  { fontSize: 11, fontWeight: '700', color: COLORS.gray[400], letterSpacing: 0.5 },

  item:          { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemActive:    { backgroundColor: COLORS.primary + '0d' },
  itemIcon:      { fontSize: 16, width: 26, textAlign: 'center' as any },
  itemTxt:       { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '500', flex: 1 },
  itemTxtActive: { color: COLORS.primary, fontWeight: '700' },
  check:         { fontSize: 12, color: COLORS.primary, fontWeight: '800' },

  teamDot:       { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  memberCount:   { fontSize: 11, color: COLORS.gray[400] },

  avatar:        { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  avatarCircle:  { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInitial: { fontSize: 11, color: COLORS.white, fontWeight: '700' },
  userEmail:     { fontSize: 11, color: COLORS.gray[400] },
  noResults:     { textAlign: 'center' as any, color: COLORS.gray[400], padding: SPACING.lg, fontSize: FONTS.sm },
});

// ─── Generic compact dropdown (Status / Sort) ─────────────────────────────────
function CompactDropdown<T extends string>({
  label, value, options, onChange, isOpen, onOpenChange, minWidth,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
  minWidth?: number;
}) {
  const active = options.find((o) => o.key === value);
  const close = () => onOpenChange(false);
  return (
    <View style={cdr.wrapper}>
      <Text style={cdr.label}>{label}</Text>
      <View style={cdr.anchor}>
        <Pressable style={[cdr.trigger, { minWidth: minWidth ?? 120 }]} onPress={() => onOpenChange(!isOpen)}>
          <Text style={cdr.triggerTxt} numberOfLines={1}>{active?.label ?? '—'}</Text>
          <Text style={cdr.chevron}>{isOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {isOpen && (
          <>
            <Pressable style={cdr.backdrop} onPress={close} />
            <View style={cdr.flyout}>
              {options.map((o) => {
                const selected = o.key === value;
                return (
                  <Pressable
                    key={o.key}
                    style={[cdr.item, selected && cdr.itemActive]}
                    onPress={() => { onChange(o.key); close(); }}
                  >
                    {selected && <Text style={cdr.check}>✓</Text>}
                    <Text style={[cdr.itemTxt, selected && cdr.itemTxtActive]} numberOfLines={1}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
const cdr = StyleSheet.create({
  wrapper:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, zIndex: 100 },
  label:        { fontSize: FONTS.sm, color: COLORS.gray[400], fontWeight: '500' },
  anchor:       { position: 'relative' as any, zIndex: 100 },
  trigger:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[200] },
  triggerTxt:   { fontSize: FONTS.sm, color: COLORS.gray[800], fontWeight: '700', flex: 1 },
  chevron:      { fontSize: 10, color: COLORS.gray[500] },
  backdrop:     { position: 'fixed' as any, inset: 0, zIndex: 98 },
  flyout:       { position: 'absolute' as any, top: '100%' as any, left: 0, marginTop: 6, minWidth: 180, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 99, overflow: 'hidden' as any },
  item:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemActive:   { backgroundColor: COLORS.primary + '0d' },
  itemTxt:      { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '500', flex: 1 },
  itemTxtActive:{ color: COLORS.primary, fontWeight: '700' },
  check:        { fontSize: 12, color: COLORS.primary, fontWeight: '800', width: 16 },
});

// ─── Filter toolbar ────────────────────────────────────────────────────────────
function FilterToolbar({
  filters, onChange, selectedCompanyId, onSelectCompany,
  onOpenAdvanced, activeFilterCount,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  selectedCompanyId: string | null;
  onSelectCompany: (id: string | null) => void;
  onOpenAdvanced: () => void;
  activeFilterCount: number;
}) {
  const allFunnels = useFunnelStore((s) => s.funnels);
  const activeFunnelId = useFunnelStore((s) => s.activeFunnelId);
  const setActiveFunnel = useFunnelStore((s) => s.setActiveFunnel);
  const users = useCRMUserStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.user);
  const teams = useTeamStore((s) => s.teams);
  const teamMembers = useTeamStore((s) => s.teamMembers);
  const loadTeams = useTeamStore((s) => s.loadTeams);
  const loadMembers = useTeamStore((s) => s.loadMembers);
  const companies = useCompanyStore((s) => s.companies);
  const loadCompanies = useCompanyStore((s) => s.loadCompanies);

  const isMaster = currentUser?.companyId === MASTER_COMPANY_ID;

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (isMaster) loadCompanies(); }, [isMaster]);

  // Don't auto-select company — show all leads by default

  // All companies share the same funnels (from Default company)
  const funnels = allFunnels;

  const [openDropdown, setOpenDropdown] = useState<'company' | 'funnel' | 'owner' | 'status' | 'sort' | null>(null);

  const STATUS_OPTS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: '⚡ Em andamento' },
    { key: 'won', label: '✓ Ganhos' },
    { key: 'lost', label: '✗ Perdidos' },
  ];

  const SORT_OPTS: { key: SortOption; label: string }[] = [
    { key: 'created_desc', label: 'Recentes' },
    { key: 'value_desc', label: 'Maior valor' },
    { key: 'value_asc', label: 'Menor valor' },
    { key: 'name_asc', label: 'Nome A→Z' },
  ];

  return (
    <View style={tb.container}>
      <View style={tb.dropdownRow}>
        {isMaster && (
          <CompanyDropdown
            companies={companies}
            activeCompanyId={selectedCompanyId}
            onSelect={onSelectCompany}
            isOpen={openDropdown === 'company'}
            onOpenChange={(v) => setOpenDropdown(v ? 'company' : null)}
          />
        )}
        <FunnelDropdown
          funnels={funnels}
          activeFunnelId={activeFunnelId}
          onSelect={setActiveFunnel}
          isOpen={openDropdown === 'funnel'}
          onOpenChange={(v) => setOpenDropdown(v ? 'funnel' : null)}
        />
        <OwnerDropdown
          value={filters.owner}
          onChange={(v) => onChange({ owner: v })}
          users={users}
          teams={teams}
          teamMembers={teamMembers}
          currentUserId={currentUser?.id}
          onLoadTeamMembers={loadMembers}
          isOpen={openDropdown === 'owner'}
          onOpenChange={(v) => setOpenDropdown(v ? 'owner' : null)}
        />
        <CompactDropdown<StatusFilter>
          label="Status"
          value={filters.status}
          options={STATUS_OPTS}
          onChange={(v) => onChange({ status: v })}
          isOpen={openDropdown === 'status'}
          onOpenChange={(v) => setOpenDropdown(v ? 'status' : null)}
          minWidth={150}
        />
        <CompactDropdown<SortOption>
          label="Ordenar"
          value={filters.sort}
          options={SORT_OPTS}
          onChange={(v) => onChange({ sort: v })}
          isOpen={openDropdown === 'sort'}
          onOpenChange={(v) => setOpenDropdown(v ? 'sort' : null)}
          minWidth={140}
        />
        <Pressable
          style={[tb.advBtn, activeFilterCount > 0 && tb.advBtnActive, { marginLeft: 'auto' as any }]}
          onPress={onOpenAdvanced}
        >
          <Text style={[tb.advBtnTxt, activeFilterCount > 0 && tb.advBtnTxtActive]}>
            ⚙ Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
const tb = StyleSheet.create({
  container: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], zIndex: 100 },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' as any, gap: SPACING.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, zIndex: 100 },
  advBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100], borderWidth: 1, borderColor: COLORS.gray[200] },
  advBtnActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  advBtnTxt: { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
  advBtnTxtActive: { color: COLORS.primary, fontWeight: '700' },
});

// ─── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ deals, stages }: { deals: Deal[]; stages: FunnelStage[] }) {
  const stageMap = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s])), [stages]);
  const active = deals.filter((d) => !d.deletedAt);
  const isWon  = (d: Deal) => stageMap[d.stageId]?.type === 'won'  || d.stage === 'closed_won';
  const isLost = (d: Deal) => stageMap[d.stageId]?.type === 'lost' || d.stage === 'closed_lost';
  const won = active.filter(isWon);
  const lost = active.filter(isLost);
  const inProgress = active.filter((d) => !isWon(d) && !isLost(d));
  const totalValue = inProgress.reduce((s, d) => s + d.value, 0);

  return (
    <View style={sb.bar}>
      <View style={sb.item}>
        <Text style={sb.value}>{formatCurrency(totalValue)}</Text>
        <Text style={sb.label}>Valor do pipeline</Text>
      </View>
      <View style={sb.divider} />
      <View style={sb.item}>
        <Text style={sb.value}>{inProgress.length}</Text>
        <Text style={sb.label}>Em andamento</Text>
      </View>
      <View style={sb.divider} />
      <View style={sb.item}>
        <Text style={[sb.value, { color: COLORS.success }]}>{won.length}</Text>
        <Text style={sb.label}>Ganhos</Text>
      </View>
      <View style={sb.divider} />
      <View style={sb.item}>
        <Text style={[sb.value, { color: COLORS.danger }]}>{lost.length}</Text>
        <Text style={sb.label}>Perdidos</Text>
      </View>
    </View>
  );
}
const sb = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: COLORS.white, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  item: { flex: 1, alignItems: 'center' },
  value: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900] },
  label: { fontSize: 11, color: COLORS.gray[400], marginTop: 2, textAlign: 'center' },
  divider: { width: 1, backgroundColor: COLORS.gray[100], marginVertical: 4 },
});

// Virtual stage IDs for won/lost columns that always appear
const VIRTUAL_WON_ID  = '__won__';
const VIRTUAL_LOST_ID = '__lost__';

const VIRTUAL_WON_STAGE: FunnelStage = {
  id: VIRTUAL_WON_ID, funnelId: '', name: 'Ganho', color: '#16a34a',
  order: 9998, probability: 100, type: 'won', rottenDays: null,
  createdAt: '', updatedAt: '',
};
const VIRTUAL_LOST_STAGE: FunnelStage = {
  id: VIRTUAL_LOST_ID, funnelId: '', name: 'Perdido', color: '#ef4444',
  order: 9999, probability: 0, type: 'lost', rottenDays: null,
  createdAt: '', updatedAt: '',
};

// ─── Kanban board ──────────────────────────────────────────────────────────────
function KanbanBoard({ stages, dealsByStageId, wonDeals, lostDeals, contactNames }: {
  stages: FunnelStage[];
  dealsByStageId: Record<string, Deal[]>;
  wonDeals: Deal[];
  lostDeals: Deal[];
  contactNames: Record<string, string>;
}) {
  const { registerColumn, onDragStart, onDragMove, onDragEnd, dragTargetStageId } = useDragContext();
  const openDeal = useUIStore((s) => s.openDeal);

  // Only show active-type stages in the main board
  const activeStages = stages.filter((s) => s.type !== 'won' && s.type !== 'lost');

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.boardContent} scrollEventThrottle={16}>
      {activeStages.map((stage) => (
        <KanbanColumn
          key={stage.id} stage={stage}
          deals={dealsByStageId[stage.id] ?? []}
          contactNames={contactNames}
          onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}
          onDealPress={(id) => openDeal(id)}
          onLayout={registerColumn}
          isDragTarget={dragTargetStageId === stage.id}
        />
      ))}
      {/* Always-visible Ganho column */}
      <KanbanColumn
        key={VIRTUAL_WON_ID} stage={VIRTUAL_WON_STAGE}
        deals={wonDeals} contactNames={contactNames}
        onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}
        onDealPress={(id) => openDeal(id)}
        onLayout={registerColumn}
        isDragTarget={false}
      />
      {/* Always-visible Perdido column */}
      <KanbanColumn
        key={VIRTUAL_LOST_ID} stage={VIRTUAL_LOST_STAGE}
        deals={lostDeals} contactNames={contactNames}
        onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}
        onDealPress={(id) => openDeal(id)}
        onLayout={registerColumn}
        isDragTarget={false}
      />
    </ScrollView>
  );
}

// ─── List view ─────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function StatusBadge({ stageType, dealStage }: { stageType?: string; dealStage: string }) {
  const isWon  = stageType === 'won'  || dealStage === 'closed_won';
  const isLost = stageType === 'lost' || dealStage === 'closed_lost';
  const label  = isWon ? 'Ganho' : isLost ? 'Perdido' : 'Em andamento';
  const color  = isWon ? '#16a34a' : isLost ? '#ef4444' : '#0891b2';
  const bg     = isWon ? '#f0fdf4' : isLost ? '#fef2f2' : '#f0f9ff';
  return (
    <View style={[lv.badge, { backgroundColor: bg, borderColor: color + '40' }]}>
      <Text style={[lv.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

function OwnerAvatar({ ownerId, users }: { ownerId: string | null; users: any[] }) {
  const owner = users.find((u) => u.id === ownerId);
  if (!owner) return <View style={lv.avatarCircle}><Text style={lv.avatarTxt}>?</Text></View>;
  if (owner.avatarUrl) return <Image source={{ uri: owner.avatarUrl }} style={lv.avatarImg} />;
  return (
    <View style={lv.avatarCircle}>
      <Text style={lv.avatarTxt}>{(owner.displayName ?? owner.email ?? '?')[0].toUpperCase()}</Text>
    </View>
  );
}

function ListView({
  deals, stages, users, contactNames, onPress,
}: {
  deals: Deal[];
  stages: FunnelStage[];
  users: any[];
  contactNames: Record<string, string>;
  onPress: (id: string) => void;
}) {
  const stageMap = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s])), [stages]);

  if (deals.length === 0) {
    return (
      <View style={lv.empty}>
        <Text style={lv.emptyIcon}>📋</Text>
        <Text style={lv.emptyTxt}>Nenhuma negociação encontrada</Text>
      </View>
    );
  }

  return (
    <ScrollView style={lv.scroll} contentContainerStyle={lv.content} showsVerticalScrollIndicator={true}>
      {/* Header row */}
      <View style={lv.headerRow}>
        <Text style={[lv.headerCell, { flex: 3 }]}>Lead</Text>
        <Text style={[lv.headerCell, { flex: 2 }]}>Responsável</Text>
        <Text style={[lv.headerCell, { flex: 2 }]}>Etapa</Text>
        <Text style={[lv.headerCell, { flex: 2, textAlign: 'right' }]}>Valor</Text>
        <Text style={[lv.headerCell, { flex: 1.5, textAlign: 'center' }]}>Criado em</Text>
        <Text style={[lv.headerCell, { flex: 2, textAlign: 'center' }]}>Status</Text>
      </View>

      {deals.map((deal, idx) => {
        const stage    = stageMap[deal.stageId];
        const contact  = contactNames[deal.contactId] ?? '—';
        return (
          <Pressable
            key={deal.id}
            style={[lv.row, idx % 2 === 1 && lv.rowAlt]}
            onPress={() => onPress(deal.id)}
          >
            {/* Lead name + contact */}
            <View style={[lv.cell, { flex: 3 }]}>
              <Text style={lv.dealTitle} numberOfLines={1}>{deal.title}</Text>
              <Text style={lv.contactName} numberOfLines={1}>{contact}</Text>
            </View>

            {/* Responsible */}
            <View style={[lv.cell, lv.ownerCell, { flex: 2 }]}>
              <OwnerAvatar ownerId={deal.ownerId} users={users} />
              <Text style={lv.ownerName} numberOfLines={1}>
                {users.find((u) => u.id === deal.ownerId)?.displayName ?? '—'}
              </Text>
            </View>

            {/* Stage */}
            <View style={[lv.cell, { flex: 2 }]}>
              {stage ? (
                <View style={lv.stageChip}>
                  <View style={[lv.stageDot, { backgroundColor: stage.color }]} />
                  <Text style={lv.stageLabel} numberOfLines={1}>{stage.name}</Text>
                </View>
              ) : <Text style={lv.stageFallback}>—</Text>}
            </View>

            {/* Value */}
            <View style={[lv.cell, { flex: 2, alignItems: 'flex-end' }]}>
              <Text style={lv.valueText}>{formatCurrency(deal.value)}</Text>
            </View>

            {/* Date */}
            <View style={[lv.cell, { flex: 1.5, alignItems: 'center' }]}>
              <Text style={lv.dateText}>{formatDate(deal.createdAt)}</Text>
            </View>

            {/* Status */}
            <View style={[lv.cell, { flex: 2, alignItems: 'center' }]}>
              <StatusBadge stageType={stage?.type} dealStage={deal.stage} />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const lv = StyleSheet.create({
  scroll:       { flex: 1 },
  content:      { paddingBottom: SPACING['2xl'] },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon:    { fontSize: 48, marginBottom: SPACING.md },
  emptyTxt:     { fontSize: FONTS.base, color: COLORS.gray[400] },

  headerRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: COLORS.gray[50], borderBottomWidth: 1, borderBottomColor: COLORS.gray[200] },
  headerCell:   { fontSize: 11, fontWeight: '700', color: COLORS.gray[400], textTransform: 'uppercase' as any, letterSpacing: 0.5 },

  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 14, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  rowAlt:       { backgroundColor: COLORS.gray[50] },
  cell:         { paddingRight: SPACING.sm },

  dealTitle:    { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[900] },
  contactName:  { fontSize: 11, color: COLORS.gray[400], marginTop: 2 },

  ownerCell:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImg:    { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  avatarTxt:    { fontSize: 11, color: COLORS.white, fontWeight: '700' },
  ownerName:    { fontSize: FONTS.sm, color: COLORS.gray[700], flex: 1 },

  stageChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' as any },
  stageDot:     { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stageLabel:   { fontSize: FONTS.sm, color: COLORS.gray[700], flex: 1 },
  stageFallback:{ fontSize: FONTS.sm, color: COLORS.gray[400] },

  valueText:    { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[900] },
  dateText:     { fontSize: 11, color: COLORS.gray[500] },

  badge:        { paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' },
});

// ─── Apply filters to deals ────────────────────────────────────────────────────
function applyFilters(
  deals: Deal[], filters: Filters, stages: FunnelStage[],
  currentUserId: string | undefined,
  teamMembers: Record<string, any[]> = {},
): Deal[] {
  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));
  let result = deals.filter((d) => !d.deletedAt);

  const owner = filters.owner;
  if (owner === 'mine' && currentUserId) {
    result = result.filter((d) => d.ownerId === currentUserId);
  } else if (owner.startsWith('user:')) {
    const userId = owner.slice(5);
    result = result.filter((d) => d.ownerId === userId);
  } else if (owner.startsWith('team:')) {
    const teamId = owner.slice(5);
    const memberIds = new Set((teamMembers[teamId] ?? []).map((m: any) => m.userId));
    result = result.filter((d) => d.ownerId != null && memberIds.has(d.ownerId));
  }
  if (filters.status !== 'all') {
    result = result.filter((d) => {
      const t = stageMap[d.stageId]?.type;
      if (filters.status === 'won')  return t === 'won'  || d.stage === 'closed_won';
      if (filters.status === 'lost') return t === 'lost' || d.stage === 'closed_lost';
      return (!t || t === 'active') && d.stage !== 'closed_won' && d.stage !== 'closed_lost';
    });
  }
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter((d) => d.title.toLowerCase().includes(q));
  }
  if (filters.minValue) {
    const min = parseFloat(filters.minValue) * 100;
    result = result.filter((d) => d.value >= min);
  }
  if (filters.maxValue) {
    const max = parseFloat(filters.maxValue) * 100;
    result = result.filter((d) => d.value <= max);
  }
  result = [...result].sort((a, b) => {
    switch (filters.sort) {
      case 'created_asc':  return a.createdAt.localeCompare(b.createdAt);
      case 'value_desc':   return b.value - a.value;
      case 'value_asc':    return a.value - b.value;
      case 'name_asc':     return a.title.localeCompare(b.title);
      default:             return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return result;
}

// ─── Search modal ─────────────────────────────────────────────────────────────
function SearchModal({
  visible, onClose, deals, contacts, funnels, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  deals: Deal[];
  contacts: ReturnType<typeof useContactStore.getState>['contacts'];
  funnels: ReturnType<typeof useFunnelStore.getState>['funnels'];
  onSelect: (dealId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (visible) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [visible]);

  const stageMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    for (const f of funnels) for (const s of f.stages ?? []) m[s.id] = { name: s.name, color: s.color ?? COLORS.primary };
    return m;
  }, [funnels]);
  const funnelMap = useMemo(
    () => Object.fromEntries(funnels.map((f) => [f.id, f.name])),
    [funnels]
  );
  const contactMap = useMemo(
    () => Object.fromEntries(contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`])),
    [contacts]
  );

  const { contactResults, dealsByContactId, titleDeals } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { contactResults: [], dealsByContactId: {} as Record<string, Deal[]>, titleDeals: [] };

    // Contacts matching query
    const matchedContacts = contacts.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q)
    ).slice(0, 6);
    const matchedContactIds = new Set(matchedContacts.map((c) => c.id));

    // Deals per matched contact
    const byContact: Record<string, Deal[]> = {};
    for (const c of matchedContacts) {
      byContact[c.id] = deals.filter((d) => !d.deletedAt && d.contactId === c.id);
    }

    // Deals matching by title (not already covered via contact)
    const byTitle = deals
      .filter((d) => !d.deletedAt && d.title.toLowerCase().includes(q) && (!d.contactId || !matchedContactIds.has(d.contactId)))
      .slice(0, 10);

    return { contactResults: matchedContacts, dealsByContactId: byContact, titleDeals: byTitle };
  }, [query, contacts, deals]);

  const hasResults = contactResults.length > 0 || titleDeals.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sm.overlay}>
        <Pressable style={sm.overlayBg} onPress={onClose} />
        <View style={sm.sheet}>
          {/* Search input */}
          <View style={sm.searchRow}>
            <Text style={sm.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              style={sm.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar negociação ou órgão..."
              placeholderTextColor={COLORS.gray[400]}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={sm.clearBtn}>
                <Text style={sm.clearTxt}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Results */}
          <ScrollView style={sm.results} keyboardShouldPersistTaps="handled">
            {query.trim().length === 0 && (
              <Text style={sm.hint}>Digite para buscar negociações ou órgãos</Text>
            )}
            {query.trim().length > 0 && !hasResults && (
              <Text style={sm.hint}>Nenhum resultado para "{query}"</Text>
            )}

            {/* Contact results */}
            {contactResults.length > 0 && (
              <>
                <View style={sm.sectionHeader}>
                  <Text style={sm.sectionTitle}>CONTATOS</Text>
                </View>
                {contactResults.map((contact) => {
                  const cDeals = dealsByContactId[contact.id] ?? [];
                  return (
                    <View key={contact.id}>
                      <Pressable style={sm.contactRow} onPress={() => { onClose(); router.push(`/(app)/(tabs)/contacts/${contact.id}` as never); }}>
                        <View style={sm.contactAvatar}>
                          <Text style={sm.contactAvatarTxt}>{contact.firstName[0].toUpperCase()}</Text>
                        </View>
                        <View style={sm.contactInfo}>
                          <Text style={sm.contactName}>{contact.firstName} {contact.lastName}</Text>
                          {contact.company && <Text style={sm.contactSub}>{contact.company}</Text>}
                        </View>
                        <Text style={sm.dealCount}>{cDeals.length} negociação{cDeals.length !== 1 ? 'ões' : ''} →</Text>
                      </Pressable>
                      {cDeals.map((deal) => {
                        const stage = stageMap[deal.stageId];
                        return (
                          <Pressable key={deal.id} style={sm.dealUnderContact} onPress={() => { onSelect(deal.id); onClose(); }}>
                            <Text style={sm.dealUnderTitle} numberOfLines={1}>{deal.title}</Text>
                            <View style={sm.itemMeta}>
                              {funnelMap[deal.funnelId] && <Text style={sm.itemSub}>{funnelMap[deal.funnelId]}</Text>}
                              {stage && <><Text style={sm.itemDot}>·</Text><Text style={sm.itemStage}>{stage.name}</Text></>}
                            </View>
                          </Pressable>
                        );
                      })}
                      {cDeals.length === 0 && (
                        <View style={sm.noDeals}><Text style={sm.noDealsText}>Nenhuma negociação vinculada</Text></View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Title-match deal results */}
            {titleDeals.length > 0 && (
              <>
                <View style={sm.sectionHeader}>
                  <Text style={sm.sectionTitle}>NEGOCIAÇÕES</Text>
                </View>
                {titleDeals.map((deal) => {
                  const contactName = contactMap[deal.contactId ?? ''];
                  const stage = stageMap[deal.stageId];
                  return (
                    <Pressable key={deal.id} style={sm.item} onPress={() => { onSelect(deal.id); onClose(); }}>
                      <View style={sm.itemLeft}>
                        <Text style={sm.itemTitle} numberOfLines={1}>{deal.title}</Text>
                        <View style={sm.itemMeta}>
                          {contactName && <Text style={sm.itemSub}>{contactName}</Text>}
                          {contactName && funnelMap[deal.funnelId] && <Text style={sm.itemDot}>·</Text>}
                          {funnelMap[deal.funnelId] && <Text style={sm.itemSub}>{funnelMap[deal.funnelId]}</Text>}
                          {stage && <><Text style={sm.itemDot}>·</Text><Text style={sm.itemStage}>{stage.name}</Text></>}
                        </View>
                      </View>
                      {deal.value > 0 && <Text style={sm.itemValue}>{formatCurrency(deal.value)}</Text>}
                    </Pressable>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 80 },
  overlayBg: { position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:     { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, width: 600, maxWidth: '95%' as any, maxHeight: '70%' as any, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 16, overflow: 'hidden' as any, zIndex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  searchIcon:{ fontSize: 16 },
  input:     { flex: 1, fontSize: FONTS.base, color: COLORS.gray[900], paddingVertical: Platform.OS === 'web' ? SPACING.sm : 10, outlineStyle: 'none' } as any,
  clearBtn:  { padding: SPACING.xs },
  clearTxt:  { color: COLORS.gray[400], fontSize: 14 },
  results:   { maxHeight: 420 },
  hint:      { color: COLORS.gray[400], fontSize: FONTS.sm, textAlign: 'center' as any, padding: SPACING.xl },
  item:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemLeft:  { flex: 1, marginRight: SPACING.sm },
  itemTitle: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900], marginBottom: 2 },
  itemMeta:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' as any, gap: 4 },
  itemSub:   { fontSize: FONTS.sm, color: COLORS.gray[500] },
  itemDot:   { fontSize: FONTS.sm, color: COLORS.gray[300] },
  itemStage: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '500' },
  itemValue: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[700] },

  sectionHeader: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs, backgroundColor: COLORS.gray[50], borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  sectionTitle:  { fontSize: 10, fontWeight: '700', color: COLORS.gray[400], letterSpacing: 0.8 },

  contactRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm, backgroundColor: COLORS.white },
  contactAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  contactAvatarTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
  contactInfo:      { flex: 1 },
  contactName:      { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900] },
  contactSub:       { fontSize: FONTS.sm, color: COLORS.gray[400] },
  dealCount:        { fontSize: FONTS.sm, color: COLORS.gray[400] },

  dealUnderContact: { paddingHorizontal: SPACING.lg, paddingVertical: 10, paddingLeft: SPACING.lg + 36 + SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50], backgroundColor: COLORS.white },
  dealUnderTitle:   { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[800], marginBottom: 2 },

  noDeals:     { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, paddingLeft: SPACING.lg + 36 + SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  noDealsText: { fontSize: FONTS.sm, color: COLORS.gray[400], fontStyle: 'italic' as any },
});

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function NegotiationsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const openDeal  = useUIStore((s) => s.openDeal);
  const loadDeals = useDealStore((s) => s.loadDeals);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const deals = useDealStore((s) => s.deals);

  const contacts = useContactStore((s) => s.contacts);
  const allFunnels = useFunnelStore((s) => s.funnels);
  const activeFunnelId = useFunnelStore((s) => s.activeFunnelId);
  const currentUser = useAuthStore((s) => s.user);
  const users = useCRMUserStore((s) => s.users);
  const loadUsers = useCRMUserStore((s) => s.loadUsers);
  const loadFunnels = useFunnelStore((s) => s.loadFunnels);
  const teamMembers = useTeamStore((s) => s.teamMembers);

  useEffect(() => { loadFunnels(); loadDeals(); loadContacts(); loadUsers(); }, [currentUser?.companyId]);

  const isMaster = currentUser?.companyId === MASTER_COMPANY_ID;

  // All companies share the same funnels (from Default company)
  const funnels = allFunnels;

  const funnel = useMemo(() => funnels.find((f) => f.id === activeFunnelId) ?? funnels[0] ?? null, [funnels, activeFunnelId]);
  const stages = useMemo(() => funnel?.stages ?? [], [funnel]);

  const funnelDeals = useMemo(() => {
    let result = deals.filter((d) => !d.deletedAt);
    if (isMaster && selectedCompanyId) {
      // Filtering by specific company: show deals from that company
      result = result.filter((d) => d.companyId === selectedCompanyId);
    }
    // Filter by funnel only when not showing all companies or for non-master users
    if (!isMaster || selectedCompanyId) {
      result = result.filter((d) => d.funnelId === funnel?.id || !d.funnelId);
    }
    return result;
  }, [deals, funnel?.id, isMaster, selectedCompanyId]);

  const filteredDeals = useMemo(
    () => applyFilters(funnelDeals, filters, stages, currentUser?.id, teamMembers),
    [funnelDeals, filters, stages, currentUser?.id, teamMembers]
  );

  // dealsByStageId using filtered deals — won/lost go to virtual columns
  const stageTypeMap = useMemo(
    () => Object.fromEntries(stages.map((s) => [s.id, s.type ?? 'active'])),
    [stages]
  );
  const firstActiveStageId = useMemo(() => stages.find((s) => (s.type ?? 'active') === 'active')?.id ?? '', [stages]);
  const { dealsByStageId, wonDeals, lostDeals } = useMemo(() => {
    const result: Record<string, Deal[]> = {};
    const won: Deal[] = [];
    const lost: Deal[] = [];
    for (const deal of filteredDeals) {
      const stageType = stageTypeMap[deal.stageId] ?? null;
      if (deal.stage === 'closed_won' || stageType === 'won') {
        won.push(deal);
      } else if (deal.stage === 'closed_lost' || stageType === 'lost') {
        lost.push(deal);
      } else {
        // If deal's stageId doesn't match any current stage, place in first active stage
        const knownStage = stageTypeMap[deal.stageId] !== undefined;
        const key = knownStage ? deal.stageId : (firstActiveStageId || deal.stageId || deal.stage);
        if (!result[key]) result[key] = [];
        result[key].push(deal);
      }
    }
    return { dealsByStageId: result, wonDeals: won, lostDeals: lost };
  }, [filteredDeals, stageTypeMap, firstActiveStageId]);

  const contactNames = useMemo(
    () => Object.fromEntries(contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`])),
    [contacts]
  );
  const contactIdForDeal = useCallback(
    (dealId: string) => deals.find((d) => d.id === dealId)?.contactId ?? '',
    [deals]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.minValue) count++;
    if (filters.maxValue) count++;
    return count;
  }, [filters]);

  const updateFilters = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Text style={styles.pageTitle}>Licitações</Text>
          {currentUser?.companyName && <Text style={styles.companyLabel}>🏢 {currentUser.companyName}</Text>}
          {funnel && <Text style={styles.funnelLabel}>{funnel.name}</Text>}
        </View>
        <View style={styles.topRight}>
          <Pressable style={styles.searchBtn} onPress={() => setShowSearch(true)}>
            <Text style={styles.searchBtnTxt}>🔍</Text>
          </Pressable>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Pressable style={styles.newBtn} onPress={() => setShowNewDeal(true)}>
            <Text style={styles.newBtnTxt}>+ Nova</Text>
          </Pressable>
        </View>
      </View>

      {/* Filter toolbar */}
      <FilterToolbar
        filters={filters}
        onChange={updateFilters}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        onOpenAdvanced={() => setShowAdvanced(true)}
        activeFilterCount={activeFilterCount}
      />

      {/* Summary bar */}
      <SummaryBar deals={filteredDeals} stages={stages} />

      {/* Content */}
      {viewMode === 'list' ? (
        <ListView
          deals={filteredDeals}
          stages={stages}
          users={users}
          contactNames={contactNames}
          onPress={(id) => openDeal(id)}
        />
      ) : (
        <KanbanDragProvider contactIdForDeal={contactIdForDeal}>
          <KanbanBoard stages={stages} dealsByStageId={dealsByStageId} wonDeals={wonDeals} lostDeals={lostDeals} contactNames={contactNames} />
        </KanbanDragProvider>
      )}

      {/* Advanced filter modal */}
      <FilterModal visible={showAdvanced} filters={filters} onClose={() => setShowAdvanced(false)} onChange={(f) => setFilters(f)} />

      {/* New deal modal */}
      <NewDealModal visible={showNewDeal} onClose={() => setShowNewDeal(false)} />

      {/* Search modal */}
      <SearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        deals={deals}
        contacts={contacts}
        funnels={funnels}
        onSelect={(id) => openDeal(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  topLeft: { gap: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  pageTitle:    { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  companyLabel: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  funnelLabel:  { fontSize: FONTS.sm, color: COLORS.gray[400] },
  searchBtn: { width: 34, height: 34, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  searchBtnTxt: { fontSize: 15 },
  newBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 7 },
  newBtnTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
  boardContent: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
});
