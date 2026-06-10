import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Alert, Platform, Animated,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useUIStore } from '../../src/stores/uiStore';
import { useFunnelStore } from '../../src/stores/funnelStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useCustomFieldStore } from '../../src/stores/customFieldStore';
import { useProductStore } from '../../src/stores/productStore';
import { useCRMUserStore } from '../../src/stores/crmUserStore';
import { useTeamStore, Team, TeamMember } from '../../src/stores/teamStore';
import { useACLProfileStore, ACLProfile, ACLPermissions, DEFAULT_PERMISSIONS, PERMISSION_LABELS } from '../../src/stores/aclProfileStore';
import { useCompanyStore, Company } from '../../src/stores/companyStore';
import { useCompanyAttrStore, AttrKey, CompanyAttr } from '../../src/stores/companyAttrStore';
import { useCitiesStore } from '../../src/stores/citiesStore';
import { signOut, switchCompany } from '../../src/services/authService';
import { apiFetch } from '../../src/services/api';
import { Card } from '../../src/components/ui/Card';
import { ApiExternaModal } from '../../src/components/settings/ApiExternaModal';
import { PalavrasChaveModal } from '../../src/components/settings/PalavrasChaveModal';
import { Button } from '../../src/components/ui/Button';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { Funnel, FunnelStage, CustomField, CustomFieldType, Product, CRMUser, UserRole, WinLossReason } from '../../src/types/models';
import { formatCurrency } from '../../src/utils/currency';

// ─── City autocomplete ────────────────────────────────────────────────────────
// Strip combining diacritics so "guarulhos" matches "Guarulhos" and "sao paulo" matches "São Paulo".
const DIACRITIC_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036F) + ']', 'g');
/** Remove acentos e converte para minúsculas, permitindo busca de cidade sem distinção de acentuação. */
function normalize(str: string) {
  return str.normalize('NFD').replace(DIACRITIC_RE, '').toLowerCase();
}

/** Campo de autocompletar cidade: filtra a lista de cidades por texto e devolve cidade/UF selecionada (ou texto livre "Cidade/UF"). */
function CityAutocomplete({
  value, uf, cities, loading, onSelect,
}: {
  value: string;
  uf: string;
  cities: { name: string; uf: string }[];
  loading: boolean;
  onSelect: (city: string, uf: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value && uf ? `${value}/${uf}` : value);

  React.useEffect(() => { setDraft(value && uf ? `${value}/${uf}` : value); }, [value, uf]);

  const q = normalize(draft.trim());
  const matches = !q ? cities.slice(0, 30) : cities
    .filter((c) => {
      const haystack = normalize(`${c.name}/${c.uf}`);
      return haystack.includes(q);
    })
    .slice(0, 30);

  // Ao perder o foco, fecha a lista e interpreta o texto como cidade selecionada ou livre ("Cidade/UF").
  const handleBlur = () => {
    // Give the user a chance to click an item before we close
    setTimeout(() => {
      setOpen(false);
      // If their text doesn't match a selected city, treat the typed value as
      // a free-form city name with UF extracted if they typed "City/UF"
      const trimmed = draft.trim();
      if (!trimmed) { onSelect('', ''); return; }
      const slash = trimmed.lastIndexOf('/');
      if (slash > 0 && /^[a-zA-Z]{2}$/.test(trimmed.slice(slash + 1).trim())) {
        const cityName = trimmed.slice(0, slash).trim();
        const ufName = trimmed.slice(slash + 1).trim().toUpperCase();
        if (cityName !== value || ufName !== uf) onSelect(cityName, ufName);
      }
    }, 150);
  };

  return (
    <View style={{ position: 'relative' as any, zIndex: 60, marginBottom: SPACING.md }}>
      <TextInput
        style={s.input}
        value={draft}
        onChangeText={(v) => { setDraft(v); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={loading ? 'Carregando cidades...' : 'Digite a cidade...'}
      />
      {open && (
        <View style={ca.flyout}>
          {loading && cities.length === 0 && (
            <Text style={ca.empty}>Carregando lista de cidades...</Text>
          )}
          {!loading && cities.length === 0 && (
            <Text style={ca.empty}>
              Lista de cidades indisponível.{'\n'}Você pode digitar livre como &quot;Cidade/UF&quot;.
            </Text>
          )}
          {cities.length > 0 && matches.length === 0 && (
            <Text style={ca.empty}>
              Nenhuma cidade encontrada para &quot;{draft.trim()}&quot;.{'\n'}Você pode digitar livre como &quot;Cidade/UF&quot;.
            </Text>
          )}
          {matches.length > 0 && (
            <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
              {matches.map((c) => (
                <Pressable
                  key={`${c.name}-${c.uf}`}
                  style={ca.item}
                  onPress={() => { onSelect(c.name, c.uf); setDraft(`${c.name}/${c.uf}`); setOpen(false); }}
                >
                  <Text style={ca.itemTxt}>{c.name}/{c.uf}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
const ca = StyleSheet.create({
  flyout: { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, marginTop: -SPACING.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], zIndex: 60, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  item:   { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemTxt:{ fontSize: FONTS.sm, color: COLORS.gray[700] },
  empty:  { fontSize: FONTS.sm, color: COLORS.gray[500], padding: SPACING.md, textAlign: 'center' as any, fontStyle: 'italic' as any },
});

// ─── Generic attr dropdown (single/multi) with inline "+ Novo" ────────────────
/** Dropdown genérico de atributo (seleção única ou múltipla) com busca e opção de cadastrar novo item inline ("+ Novo"). */
function AttrPicker({
  options, value, multiple, onChange, onCreate, placeholder, zIndex,
}: {
  options: { id: string; name: string }[];
  value: string | string[] | null;
  multiple?: boolean;
  onChange: (v: string | string[] | null) => void;
  onCreate?: (name: string) => Promise<{ id: string; name: string } | void>;
  placeholder?: string;
  zIndex?: number;
}) {
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy]   = useState(false);

  const close = () => { setOpen(false); setDraft(''); };

  const selectedIds: string[] = multiple
    ? (Array.isArray(value) ? value : [])
    : (value ? [value as string] : []);
  const labelStr = (() => {
    if (multiple) {
      if (!selectedIds.length) return '';
      return options.filter((o) => selectedIds.includes(o.id)).map((o) => o.name).join(', ');
    }
    return options.find((o) => o.id === (value as string))?.name ?? '';
  })();

  // For multi-select, hide already-selected items from the dropdown so the
  // user can keep picking the next one. Single-select keeps the full list
  // (so the user can switch their choice).
  const baseList = multiple
    ? options.filter((o) => !selectedIds.includes(o.id))
    : options;
  const filtered = draft.trim()
    ? baseList.filter((o) => o.name.toLowerCase().includes(draft.trim().toLowerCase()))
    : baseList;
  const exact = options.find((o) => o.name.toLowerCase() === draft.trim().toLowerCase());

  // Seleciona um item: em multi-seleção adiciona à lista; em seleção única define/desmarca e fecha.
  const pick = (id: string) => {
    if (multiple) {
      // Add to selection; keep dropdown open and clear search so the next item
      // is easy to find.
      if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
      setDraft('');
    } else {
      onChange(id === value ? null : id);
      close();
    }
  };

  // Remove um item da seleção (em seleção única limpa o valor).
  const removeOne = (id: string) => {
    if (!multiple) { onChange(null); return; }
    onChange(selectedIds.filter((x) => x !== id));
  };

  // Cadastra um novo item a partir do texto digitado (via onCreate) e o adiciona/seleciona.
  const handleCreate = async () => {
    const name = draft.trim();
    if (!name || !onCreate || busy) return;
    setBusy(true);
    try {
      const created = await onCreate(name);
      if (created && 'id' in created) {
        if (multiple) {
          if (!selectedIds.includes(created.id)) onChange([...selectedIds, created.id]);
        } else {
          onChange(created.id); close(); return;
        }
      }
      setDraft('');
    } finally { setBusy(false); }
  };

  // Selected items in the same order they appear in `options` (alphabetical).
  const selectedItems = multiple
    ? options.filter((o) => selectedIds.includes(o.id))
    : [];

  return (
    <View style={{ position: 'relative' as any, zIndex: zIndex ?? 50, marginBottom: SPACING.md }}>
      {multiple ? (
        // Trigger area for multi-select: chips for each selected item + chevron
        <Pressable
          style={[s.input, { flexDirection: 'row', flexWrap: 'wrap' as any, alignItems: 'center', gap: 4, minHeight: 40, paddingVertical: 6 }]}
          onPress={() => setOpen((v) => !v)}
        >
          {selectedItems.length === 0 && (
            <Text style={{ flex: 1, fontSize: FONTS.base, color: COLORS.gray[400] }}>{placeholder || 'Selecionar...'}</Text>
          )}
          {selectedItems.map((item) => (
            <View key={item.id} style={ap.chip}>
              <Pressable
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  e?.nativeEvent?.stopPropagation?.();
                  e?.preventDefault?.();
                  removeOne(item.id);
                }}
                style={ap.chipX}
                hitSlop={6}
              >
                <Text style={ap.chipXTxt}>×</Text>
              </Pressable>
              <Text style={ap.chipTxt}>{item.name}</Text>
            </View>
          ))}
          <Text style={{ marginLeft: 'auto' as any, fontSize: 10, color: COLORS.gray[500], paddingLeft: 8 }}>{open ? '▲' : '▼'}</Text>
        </Pressable>
      ) : (
        <Pressable style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }]} onPress={() => setOpen((v) => !v)}>
          <Text style={{ flex: 1, fontSize: FONTS.base, color: labelStr ? COLORS.gray[900] : COLORS.gray[400] }} numberOfLines={1}>
            {labelStr || placeholder || 'Selecionar...'}
          </Text>
          <Text style={{ fontSize: 10, color: COLORS.gray[500] }}>{open ? '▲' : '▼'}</Text>
        </Pressable>
      )}
      {open && (
        <>
          <Pressable style={ap.backdrop} onPress={close} />
        <View style={ap.flyout}>
          {onCreate && (
            <View style={ap.searchRow}>
              <TextInput
                style={ap.searchInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Buscar ou cadastrar novo..."
                autoFocus
              />
              {draft.trim() && !exact && (
                <Pressable style={[ap.addBtn, busy && { opacity: 0.5 }]} onPress={handleCreate} disabled={busy}>
                  <Text style={ap.addBtnTxt}>+ Novo</Text>
                </Pressable>
              )}
            </View>
          )}
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 && (
              <Text style={ap.empty}>{multiple && selectedItems.length === options.length ? 'Todos já selecionados.' : 'Nenhum resultado.'}</Text>
            )}
            {filtered.map((o) => {
              const sel = !multiple && selectedIds.includes(o.id);
              return (
                <Pressable key={o.id} style={[ap.item, sel && ap.itemActive]} onPress={() => pick(o.id)}>
                  <Text style={[ap.itemTxt, sel && ap.itemTxtActive]}>{o.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {multiple && (
            <Pressable style={ap.doneBtn} onPress={close}>
              <Text style={ap.doneBtnTxt}>Concluir</Text>
            </Pressable>
          )}
        </View>
        </>
      )}
    </View>
  );
}
const ap = StyleSheet.create({
  backdrop:    { position: 'fixed' as any, inset: 0 as any, zIndex: 998 } as any,
  flyout:      { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, marginTop: -SPACING.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], zIndex: 999, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary + '12', borderRadius: 6, borderWidth: 1, borderColor: COLORS.primary + '22', paddingLeft: 4, paddingRight: 8, paddingVertical: 4 },
  chipX:       { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}) },
  chipXTxt:    { fontSize: 13, color: COLORS.primary, opacity: 0.6, fontWeight: '500', lineHeight: 14, includeFontPadding: false as any },
  chipTxt:     { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  searchRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, fontSize: FONTS.sm },
  addBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  addBtnTxt:   { color: COLORS.white, fontWeight: '700', fontSize: FONTS.xs },
  item:        { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemActive:  { backgroundColor: COLORS.primary + '0d' },
  itemTxt:     { fontSize: FONTS.sm, color: COLORS.gray[700] },
  itemTxtActive:{ color: COLORS.primary, fontWeight: '700' },
  empty:       { fontSize: FONTS.sm, color: COLORS.gray[400], textAlign: 'center' as any, padding: SPACING.md, fontStyle: 'italic' },
  doneBtn:     { padding: SPACING.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.gray[100], backgroundColor: COLORS.gray[50] },
  doneBtnTxt:  { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '700' },
});

// ─── Animated counter badge ────────────────────────────────────────────────────
/** Badge numérico que faz uma animação de "pulo" (escala) sempre que o valor de count muda. */
function AnimatedCounter({ count }: { count: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const prev  = useRef(count);
  useEffect(() => {
    if (count === prev.current) return;
    prev.current = count;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.7, tension: 300, friction: 5,  useNativeDriver: false }),
      Animated.spring(scale, { toValue: 1,   tension: 200, friction: 8,  useNativeDriver: false }),
    ]).start();
  }, [count]);
  return (
    <Animated.View style={[ac.badge, { transform: [{ scale }] }]}>
      <Text style={ac.txt}>{count}</Text>
    </Animated.View>
  );
}
const ac = StyleSheet.create({
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  txt:   { color: COLORS.white, fontSize: 11, fontWeight: '800' },
});

// ─── Animated member chip ──────────────────────────────────────────────────────
/** Linha animada de um membro de equipe: avatar, nome/e-mail, botão para alternar papel (líder/membro) e remover. */
function MemberChip({ member, onRemove, onRoleToggle }: {
  member: TeamMember;
  onRemove: () => void;
  onRoleToggle: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 130, friction: 8, useNativeDriver: false }).start();
  }, []);
  const isLeader = member.role === 'leader';
  return (
    <Animated.View style={[mc.row, { opacity: anim, transform: [{ scale: anim }] }]}>
      <View style={[mc.avatar, { backgroundColor: isLeader ? '#fef3c7' : COLORS.primary + '18' }]}>
        <Text style={[mc.avatarTxt, { color: isLeader ? '#d97706' : COLORS.primary }]}>
          {member.userDisplayName[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={mc.name} numberOfLines={1}>{member.userDisplayName}</Text>
        <Text style={mc.email} numberOfLines={1}>{member.userEmail}</Text>
      </View>
      <Pressable style={[mc.roleBtn, isLeader && mc.roleBtnLeader]} onPress={onRoleToggle}>
        <Text style={[mc.roleTxt, isLeader && mc.roleTxtLeader]}>{isLeader ? '★ Líder' : 'Membro'}</Text>
      </Pressable>
      <Pressable style={mc.removeBtn} onPress={onRemove}>
        <Text style={mc.removeTxt}>×</Text>
      </Pressable>
    </Animated.View>
  );
}
const mc = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontWeight: '800', fontSize: FONTS.base },
  name:        { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[800] },
  email:       { fontSize: 11, color: COLORS.gray[400] },
  roleBtn:     { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.gray[200] },
  roleBtnLeader: { borderColor: '#d97706', backgroundColor: '#fef3c7' },
  roleTxt:     { fontSize: 11, color: COLORS.gray[500], fontWeight: '600' },
  roleTxtLeader: { color: '#d97706' },
  removeBtn:   { padding: 4 },
  removeTxt:   { fontSize: 20, color: COLORS.gray[400], lineHeight: 22 },
});

// ─── Team members modal ────────────────────────────────────────────────────────
const TEAM_PRESET_COLORS = [
  '#3b82f6','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#f59e0b','#16a34a','#06b6d4','#0ea5e9','#6366f1',
  '#d946ef','#14b8a6','#84cc16','#78716c','#64748b',
];

/** Modal de gestão de uma equipe: edita nome/cor, lista membros atuais e usuários disponíveis para adicionar/remover. */
function TeamMembersModal({ team, users, onClose }: { team: Team; users: CRMUser[]; onClose: () => void }) {
  const { teamMembers, loadMembers, addMember, removeMember, updateMemberRole, updateTeam } = useTeamStore();
  const members = teamMembers[team.id] ?? [];
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('');

  useEffect(() => { loadMembers(team.id); }, [team.id]);

  const nonMembers = users.filter((u) => u.isActive && !members.some((m) => m.userId === u.id));

  // Adiciona um usuário à equipe.
  const handleAdd = async (userId: string) => {
    await addMember(team.id, userId);
  };

  // Remove um usuário da equipe.
  const handleRemove = async (userId: string) => {
    await removeMember(team.id, userId);
  };

  // Alterna o papel do membro entre líder e membro.
  const handleRoleToggle = async (m: TeamMember) => {
    const newRole = m.role === 'leader' ? 'member' : 'leader';
    await updateMemberRole(team.id, m.userId, newRole);
  };

  // Salva o novo nome da equipe (se alterado) ao sair da edição inline.
  const handleSaveName = async () => {
    setIsEditingName(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== team.name) {
      await updateTeam(team.id, { name: trimmed });
    } else {
      setEditName(team.name);
    }
  };

  // Aplica a cor escolhida à equipe (se diferente da atual) e fecha o seletor de cor.
  const handleColorSelect = async (color: string) => {
    setShowColorPicker(false);
    setCustomColor('');
    if (color !== team.color) {
      await updateTeam(team.id, { color });
    }
  };

  // Valida o hexadecimal digitado pelo usuário e o aplica como cor personalizada da equipe.
  const handleCustomColorSubmit = () => {
    const hex = customColor.startsWith('#') ? customColor : `#${customColor}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      handleColorSelect(hex);
    }
  };

  const win = { width: typeof window !== 'undefined' ? window.innerWidth : 800 };
  const isWide = Platform.OS === 'web' && win.width >= 720;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tm.overlay} onPress={onClose}>
        <Pressable style={[tm.box, isWide && tm.boxWide]} onPress={() => {}}>
          {/* Header */}
          <View style={tm.header}>
            <Pressable onPress={() => setShowColorPicker(!showColorPicker)}>
              <View style={[tm.colorDot, tm.colorDotClickable, { backgroundColor: team.color }]} />
            </Pressable>
            {isEditingName ? (
              <TextInput
                style={[tm.title, tm.titleInput]}
                value={editName}
                onChangeText={setEditName}
                onBlur={handleSaveName}
                onSubmitEditing={handleSaveName}
                autoFocus
                selectTextOnFocus
              />
            ) : (
              <Pressable style={{ flex: 1 }} onPress={() => setIsEditingName(true)}>
                <Text style={tm.title} numberOfLines={1}>{team.name}</Text>
              </Pressable>
            )}
            <AnimatedCounter count={members.length} />
            <Text style={tm.memberLabel}>membro{members.length !== 1 ? 's' : ''}</Text>
            <Pressable style={tm.closeBtn} onPress={onClose}>
              <Text style={tm.closeTxt}>✕</Text>
            </Pressable>
          </View>

          {/* Color picker */}
          {showColorPicker && (
            <View style={tm.colorPickerWrap}>
              <View style={tm.colorGrid}>
                {TEAM_PRESET_COLORS.map((c) => (
                  <Pressable key={c} onPress={() => handleColorSelect(c)}>
                    <View style={[tm.colorOption, { backgroundColor: c }, team.color === c && tm.colorOptionActive]} />
                  </Pressable>
                ))}
              </View>
              <View style={tm.customColorRow}>
                <Text style={tm.customColorLabel}>Personalizada:</Text>
                <TextInput
                  style={tm.customColorInput}
                  value={customColor}
                  onChangeText={setCustomColor}
                  placeholder="#A1B2C3"
                  placeholderTextColor={COLORS.gray[300]}
                  maxLength={7}
                  onSubmitEditing={handleCustomColorSubmit}
                />
                {customColor.length >= 4 && (
                  <Pressable onPress={handleCustomColorSubmit}>
                    <View style={[tm.colorOption, { backgroundColor: customColor.startsWith('#') ? customColor : `#${customColor}` }]} />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Body */}
          <View style={[tm.body, isWide && tm.bodyRow]}>
            {/* Current members */}
            <View style={[tm.col, isWide && { borderRightWidth: 1, borderRightColor: COLORS.gray[100] }]}>
              <Text style={tm.colTitle}>Membros da equipe</Text>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {members.length === 0 && (
                  <Text style={tm.empty}>Nenhum membro ainda. Adicione usuários ao lado.</Text>
                )}
                {members.map((m) => (
                  <MemberChip
                    key={m.id}
                    member={m}
                    onRemove={() => handleRemove(m.userId)}
                    onRoleToggle={() => handleRoleToggle(m)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Available users */}
            <View style={tm.col}>
              <Text style={tm.colTitle}>Adicionar usuários</Text>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {nonMembers.length === 0 && (
                  <Text style={tm.empty}>Todos os usuários já fazem parte desta equipe.</Text>
                )}
                {nonMembers.map((u) => (
                  <Pressable key={u.id} style={tm.userRow} onPress={() => handleAdd(u.id)}>
                    <View style={tm.userAvatar}>
                      <Text style={tm.userAvatarTxt}>{u.displayName[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={tm.userName} numberOfLines={1}>{u.displayName}</Text>
                      <Text style={tm.userEmail} numberOfLines={1}>{u.email}</Text>
                    </View>
                    <View style={tm.addBtn}>
                      <Text style={tm.addBtnTxt}>+ Adicionar</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const tm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  box:          { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, width: '92%' as unknown as number, maxWidth: 700, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 16 },
  boxWide:      {},
  header:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  colorDot:     { width: 14, height: 14, borderRadius: 7 },
  colorDotClickable: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.gray[200], cursor: 'pointer' } as any,
  colorPickerWrap: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], backgroundColor: COLORS.gray[50] },
  colorGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorOption:  { width: 28, height: 28, borderRadius: 14 },
  colorOptionActive: { borderWidth: 3, borderColor: COLORS.gray[900] },
  customColorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  customColorLabel: { fontSize: FONTS.xs, color: COLORS.gray[500], fontWeight: '600' },
  customColorInput: { fontSize: FONTS.sm, color: COLORS.gray[800], borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 4, width: 90, outlineStyle: 'none' } as any,
  title:        { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900], flex: 1 },
  titleInput:   { borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingVertical: 2, outlineStyle: 'none' } as any,
  memberLabel:  { fontSize: FONTS.xs, color: COLORS.gray[500] },
  closeBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt:     { fontSize: 12, color: COLORS.gray[600], fontWeight: '700' },
  body:         { padding: SPACING.lg },
  bodyRow:      { flexDirection: 'row', gap: SPACING.xl },
  col:          { flex: 1, minHeight: 120 },
  colTitle:     { fontSize: 11, fontWeight: '700', color: COLORS.gray[400], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.md },
  empty:        { fontSize: FONTS.sm, color: COLORS.gray[300], textAlign: 'center', paddingVertical: SPACING.xl, fontStyle: 'italic' },
  userRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  userAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gray[200], alignItems: 'center', justifyContent: 'center' },
  userAvatarTxt:{ fontWeight: '700', fontSize: FONTS.base, color: COLORS.gray[600] },
  userName:     { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[800] },
  userEmail:    { fontSize: 11, color: COLORS.gray[400] },
  addBtn:       { backgroundColor: COLORS.primary + '18', borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  addBtnTxt:    { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
});

const INDICATOR_COLORS = {
  synced: COLORS.success,
  pending: COLORS.warning,
  offline: COLORS.gray[400],
  error: COLORS.danger,
};

const PRESET_COLORS = ['#94a3b8','#3b82f6','#8b5cf6','#f59e0b','#f97316','#ef4444','#16a34a','#06b6d4','#ec4899'];
type StageType = 'active' | 'won' | 'lost';

// ─── Funnel Modal ──────────────────────────────────────────────────────────────
/** Modal de criar/editar um funil (nome e descrição); chama onCreate ou onUpdate conforme estiver editando. */
function FunnelModal({
  visible, editing, onClose, onCreate, onUpdate,
}: {
  visible: boolean;
  editing: Funnel | null;
  onClose: () => void;
  onCreate: (name: string, desc: string) => void;
  onUpdate: (id: string, name: string, desc: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [desc, setDesc] = useState(editing?.description ?? '');

  React.useEffect(() => {
    setName(editing?.name ?? '');
    setDesc(editing?.description ?? '');
  }, [editing?.id, visible]);

  // Valida o nome e cria ou atualiza o funil, fechando o modal em seguida.
  const handleSave = () => {
    if (!name.trim()) return;
    if (editing) onUpdate(editing.id, name.trim(), desc.trim());
    else onCreate(name.trim(), desc.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <Text style={s.modalTitle}>{editing ? 'Editar Funil' : 'Novo Funil'}</Text>
          <Text style={s.label}>Nome *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} autoFocus />
          <Text style={s.label}>Descrição</Text>
          <TextInput style={[s.input, s.inputMulti]} value={desc} onChangeText={setDesc} multiline numberOfLines={2} />
          <View style={s.row}>
            <Pressable style={s.cancelBtn} onPress={onClose}><Text style={s.cancelTxt}>Cancelar</Text></Pressable>
            <Pressable style={[s.saveBtn, !name.trim() && s.disabled]} onPress={handleSave}>
              <Text style={s.saveTxt}>Salvar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Stage Modal ───────────────────────────────────────────────────────────────
/** Modal de criar/editar uma etapa do funil (nome, cor, probabilidade, tipo e dias para "podre"). */
function StageModal({
  visible, funnelId, editing, onClose, onCreate, onUpdate,
}: {
  visible: boolean;
  funnelId: string;
  editing: FunnelStage | null;
  onClose: () => void;
  onCreate: (funnelId: string, data: Omit<FunnelStage, 'id' | 'funnelId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (funnelId: string, stageId: string, data: Partial<FunnelStage>) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [probability, setProbability] = useState('30');
  const [type, setType] = useState<StageType>('active');
  const [rottenDays, setRottenDays] = useState('');

  React.useEffect(() => {
    setName(editing?.name ?? '');
    setColor(editing?.color ?? '#3b82f6');
    setProbability(String(editing?.probability ?? 30));
    setType((editing?.type as StageType) ?? 'active');
    setRottenDays(editing?.rottenDays ? String(editing.rottenDays) : '');
  }, [editing?.id, visible]);

  // Valida e monta os dados da etapa (com probabilidade limitada a 0–100) e chama criar/atualizar.
  const handleSave = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(), color,
      probability: Math.min(100, Math.max(0, parseInt(probability) || 0)),
      type, order: editing?.order ?? 999,
      rottenDays: rottenDays ? parseInt(rottenDays) : null,
    };
    if (editing) onUpdate(funnelId, editing.id, data);
    else onCreate(funnelId, data);
    onClose();
  };

  const TYPE_LABELS: Record<StageType, string> = { active: 'Em andamento', won: 'Ganho', lost: 'Perdido' };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <Text style={s.modalTitle}>{editing ? 'Editar Etapa' : 'Nova Etapa'}</Text>
          <Text style={s.label}>Nome *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} autoFocus />
          <Text style={s.label}>Cor</Text>
          <View style={s.colorRow}>
            {PRESET_COLORS.map((c) => (
              <Pressable key={c} style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]} onPress={() => setColor(c)} />
            ))}
          </View>
          <Text style={s.label}>Probabilidade (%)</Text>
          <TextInput style={s.input} value={probability} onChangeText={setProbability} keyboardType="numeric" />
          <Text style={s.label}>Tipo</Text>
          <View style={s.typeRow}>
            {(['active', 'won', 'lost'] as StageType[]).map((t) => (
              <Pressable key={t} style={[s.typeBtn, type === t && s.typeBtnActive]} onPress={() => setType(t)}>
                <Text style={[s.typeBtnTxt, type === t && s.typeBtnTxtActive]}>{TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>Dias p/ "Podre"</Text>
          <TextInput style={s.input} value={rottenDays} onChangeText={setRottenDays} keyboardType="numeric" placeholder="Ex: 30" />
          <View style={s.row}>
            <Pressable style={s.cancelBtn} onPress={onClose}><Text style={s.cancelTxt}>Cancelar</Text></Pressable>
            <Pressable style={[s.saveBtn, !name.trim() && s.disabled]} onPress={handleSave}>
              <Text style={s.saveTxt}>Salvar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Users Panel (used inside modal) ──────────────────────────────────────────
const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin', manager: 'Gerente', supervisor: 'Supervisor', consultant: 'Consultor', agent: 'Consultor',
};
const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#7c3aed', manager: '#0891b2', supervisor: '#0284c7', consultant: '#4b5563', agent: '#4b5563',
};

/** Painel de usuários (dentro do modal): busca, lista com perfil ACL/status e formulário de criar/editar usuário. */
function UsersPanel({ users, companies, aclProfiles }: { users: CRMUser[]; companies: Company[]; aclProfiles: ACLProfile[] }) {
  const { createUser, updateUser } = useCRMUserStore();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';

  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<CRMUser | null>(null);
  const [formError, setFormError] = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [roleOpen, setRoleOpen]   = useState(false);
  const [form, setForm] = useState({
    email: '', displayName: '', role: 'consultant' as UserRole, aclProfileId: '',
    password: '', passwordConfirm: '', companyId: currentUser?.companyId ?? '',
  });

  // Retorna o perfil ACL do usuário (por id, ou pelo nome equivalente ao seu papel) ou null.
  const getProfile = (u: CRMUser) => aclProfiles.find((p) => p.id === u.aclProfileId) ?? aclProfiles.find((p) => p.name.toLowerCase() === ROLE_LABELS[u.role]?.toLowerCase()) ?? null;
  const sortedProfiles = [...aclProfiles].sort((a, b) => a.level - b.level);

  const filtered = users.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Abre o formulário em branco para cadastrar um novo usuário.
  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setShowPwd(false); setShowPwdConfirm(false); setRoleOpen(false);
    const defaultProfile = sortedProfiles[0];
    setForm({ email: '', displayName: '', role: 'consultant', aclProfileId: defaultProfile?.id ?? '', password: '', passwordConfirm: '', companyId: currentUser?.companyId ?? '' });
    setShowForm(true);
  };
  // Abre o formulário preenchido com os dados de um usuário existente para edição.
  const openEdit = (u: CRMUser) => {
    setEditing(u);
    setFormError('');
    setShowPwd(false); setShowPwdConfirm(false); setRoleOpen(false);
    const profile = getProfile(u);
    setForm({ email: u.email, displayName: u.displayName, role: u.role, aclProfileId: profile?.id ?? '', password: '', passwordConfirm: '', companyId: u.companyId });
    setShowForm(true);
  };

  // Valida o formulário e cria ou atualiza o usuário via store, exibindo erro em caso de falha.
  const handleSave = async () => {
    setFormError('');
    if (!form.email.trim())       { setFormError('E-mail é obrigatório'); return; }
    if (!form.displayName.trim()) { setFormError('Nome é obrigatório'); return; }

    // Validação de senha: na criação é opcional; na edição, só se preenchida (redefinição).
    if (form.password) {
      if (form.password.length < 8)               { setFormError('Senha deve ter pelo menos 8 caracteres'); return; }
      if (form.password !== form.passwordConfirm) { setFormError('As senhas não coincidem'); return; }
    }

    try {
      if (editing) {
        await updateUser(editing.id, {
          displayName: form.displayName.trim(),
          role: form.role,
          aclProfileId: form.aclProfileId || undefined,
          ...(form.password ? { password: form.password.trim() } : {}),
          ...(isAdmin && { companyId: form.companyId }),
        });
      } else {
        await createUser({
          email: form.email.trim(),
          displayName: form.displayName.trim(),
          role: form.role,
          aclProfileId: form.aclProfileId || undefined,
          avatarUrl: null,
          password: form.password.trim() || undefined,
          ...(isAdmin && { companyId: form.companyId }),
        });
      }
      setShowForm(false);
    } catch (e: any) {
      setFormError(e?.message ?? 'Erro ao salvar usuário');
    }
  };

  // Resolve o nome da empresa a partir do id (ou devolve o próprio id se não encontrada).
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] }}>
        <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Buscar..." value={search} onChangeText={setSearch} />
        <Pressable style={styles.addBtn} onPress={openCreate}><Text style={styles.addBtnText}>+ Novo</Text></Pressable>
      </View>
      <ScrollView>
        {filtered.map((u) => {
          const prof = getProfile(u);
          const profColor = prof?.color ?? '#4b5563';
          const profName = prof?.name ?? ROLE_LABELS[u.role] ?? u.role;
          return (
          <View key={u.id} style={up.row}>
            <View style={[up.avatar, { backgroundColor: profColor + '22' }]}>
              <Text style={[up.avatarTxt, { color: profColor }]}>{u.displayName[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={up.name}>
                {u.displayName}
                {u.id === currentUser?.id ? <Text style={{ color: COLORS.gray[400], fontWeight: '400' }}> (você)</Text> : null}
              </Text>
              <Text style={up.email}>{u.email}</Text>
              {isAdmin && companies.length > 1 && (
                <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>🏢 {companyName(u.companyId)}</Text>
              )}
            </View>
            <View style={[up.roleBadge, { backgroundColor: profColor + '18' }]}>
              <Text style={[up.roleTxt, { color: profColor }]}>{profName}</Text>
            </View>
            <View style={[up.statusDot, { backgroundColor: u.isActive ? COLORS.success : COLORS.gray[300] }]} />
            <Pressable style={styles.iconBtn} onPress={() => openEdit(u)}><Text style={styles.iconBtnTxt}>✏️</Text></Pressable>
            {u.id !== currentUser?.id && (
              <Pressable style={styles.iconBtn} onPress={() => {
                if (Platform.OS === 'web' && window.confirm(`${u.isActive ? 'Desativar' : 'Ativar'} "${u.displayName}"?`))
                  updateUser(u.id, { isActive: !u.isActive });
              }}><Text style={styles.iconBtnTxt}>{u.isActive ? '🚫' : '✅'}</Text></Pressable>
            )}
          </View>
          );
        })}
        {filtered.length === 0 && <Text style={{ textAlign: 'center', color: COLORS.gray[400], padding: SPACING.xl }}>Nenhum usuário.</Text>}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={s.modal}>
              <Text style={s.modalTitle}>{editing ? 'Editar Usuário' : 'Novo Usuário'}</Text>

              {/* Error banner */}
              {!!formError && (
                <View style={up.errorBanner}>
                  <Text style={up.errorTxt}>⚠ {formError}</Text>
                </View>
              )}

              <Text style={s.label}>Nome *</Text>
              <TextInput style={s.input} value={form.displayName} onChangeText={(v) => setForm((f) => ({ ...f, displayName: v }))} autoFocus placeholder="Nome completo" />

              <Text style={s.label}>E-mail *</Text>
              <TextInput
                style={[s.input, !!editing && { backgroundColor: COLORS.gray[50], color: COLORS.gray[400] }]}
                value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="email@empresa.com" keyboardType="email-address" autoCapitalize="none" editable={!editing}
              />

              {/* Senha: na criação (opcional) e na edição (redefinição pelo admin/gerente) */}
              <>
                  <Text style={s.label}>
                    {editing ? 'Nova senha ' : 'Senha '}
                    <Text style={{ color: COLORS.gray[400], fontWeight: '400' }}>
                      {editing ? '(deixe em branco para manter a atual)' : '(opcional — gerada automaticamente)'}
                    </Text>
                  </Text>
                  <View style={up.pwdRow}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                      placeholder="Mínimo 8 caracteres" secureTextEntry={!showPwd}
                    />
                    <Pressable style={up.eyeBtn} onPress={() => setShowPwd((v) => !v)}>
                      <Text style={up.eyeTxt}>{showPwd ? '🙈' : '👁'}</Text>
                    </Pressable>
                  </View>

                  <Text style={s.label}>{editing ? 'Confirmar nova senha' : 'Confirmar senha'}</Text>
                  <View style={[up.pwdRow, { marginBottom: SPACING.md }]}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 },
                        form.passwordConfirm && form.password !== form.passwordConfirm && { borderColor: COLORS.danger }]}
                      value={form.passwordConfirm} onChangeText={(v) => setForm((f) => ({ ...f, passwordConfirm: v }))}
                      placeholder="Repita a senha" secureTextEntry={!showPwdConfirm}
                    />
                    <Pressable style={up.eyeBtn} onPress={() => setShowPwdConfirm((v) => !v)}>
                      <Text style={up.eyeTxt}>{showPwdConfirm ? '🙈' : '👁'}</Text>
                    </Pressable>
                  </View>
                  {form.passwordConfirm !== '' && form.password !== form.passwordConfirm && (
                    <Text style={{ fontSize: FONTS.xs, color: COLORS.danger, marginTop: -SPACING.sm, marginBottom: SPACING.sm }}>
                      As senhas não coincidem
                    </Text>
                  )}
              </>

              <Text style={s.label}>Papel (ACL)</Text>
              {(() => {
                const selProfile = sortedProfiles.find((p) => p.id === form.aclProfileId);
                return (
                  <View style={up.dropdownWrap}>
                    <Pressable style={up.dropdownTrigger} onPress={() => setRoleOpen((v) => !v)}>
                      <View style={up.dropdownTriggerLeft}>
                        {selProfile && <View style={[up.companyDot, { backgroundColor: selProfile.color }]} />}
                        <Text style={[up.dropdownTxt, !selProfile && { color: COLORS.gray[400] }]} numberOfLines={1}>
                          {selProfile ? selProfile.name : 'Selecione um papel'}
                        </Text>
                      </View>
                      <Text style={up.dropdownChevron}>{roleOpen ? '▲' : '▼'}</Text>
                    </Pressable>
                    {roleOpen && (
                      <View style={up.dropdownList}>
                        {sortedProfiles.map((p) => {
                          const active = form.aclProfileId === p.id;
                          return (
                            <Pressable
                              key={p.id}
                              style={[up.dropdownItem, active && { backgroundColor: p.color + '14' }]}
                              onPress={() => { setForm((f) => ({ ...f, aclProfileId: p.id })); setRoleOpen(false); }}
                            >
                              <View style={[up.companyDot, { backgroundColor: p.color }]} />
                              <Text style={[up.dropdownItemTxt, active && { color: p.color, fontWeight: '700' }]} numberOfLines={1}>
                                {p.name}
                              </Text>
                              {active && <Text style={{ color: p.color, fontWeight: '800' }}>✓</Text>}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })()}

              {isAdmin && companies.length > 0 && (
                <>
                  <Text style={s.label}>Empresa (Tenant)</Text>
                  <View style={{ flexDirection: 'column', gap: SPACING.xs, marginBottom: SPACING.md }}>
                    {companies.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[up.companyBtn, form.companyId === c.id && up.companyBtnActive]}
                        onPress={() => setForm((f) => ({ ...f, companyId: c.id }))}
                      >
                        <View style={[up.companyDot, { backgroundColor: c.isActive ? COLORS.success : COLORS.gray[300] }]} />
                        <Text style={[up.companyBtnTxt, form.companyId === c.id && { color: COLORS.primary, fontWeight: '700' }]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{c.plan}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={s.row}>
                <Pressable style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelTxt}>Cancelar</Text></Pressable>
                <Pressable
                  style={[s.saveBtn, (!form.email.trim() || !form.displayName.trim()) && s.disabled]}
                  onPress={handleSave}
                >
                  <Text style={s.saveTxt}>{editing ? 'Salvar' : 'Criar'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
const up = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  avatar:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { fontWeight: '800', fontSize: FONTS.base },
  name:          { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900] },
  email:         { fontSize: FONTS.sm, color: COLORS.gray[400] },
  roleBadge:     { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  roleTxt:       { fontSize: FONTS.sm, fontWeight: '600' },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  roleBtn:       { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center', minWidth: 80 },
  roleBtnTxt:    { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[600] },
  companyBtn:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: COLORS.white },
  companyBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '0d' },
  companyBtnTxt: { flex: 1, fontSize: FONTS.sm, color: COLORS.gray[700] },
  companyDot:    { width: 8, height: 8, borderRadius: 4 },
  errorBanner:   { backgroundColor: '#fef2f2', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#fecaca' },
  errorTxt:      { fontSize: FONTS.sm, color: '#dc2626', fontWeight: '600' },
  pwdRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  eyeBtn:        { padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: COLORS.white },
  eyeTxt:        { fontSize: 16 },
  // Dropdown de papel (ACL)
  dropdownWrap:      { marginBottom: SPACING.md },
  dropdownTrigger:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.white },
  dropdownTriggerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  dropdownTxt:       { fontSize: FONTS.base, color: COLORS.gray[900] },
  dropdownChevron:   { fontSize: 10, color: COLORS.gray[400], marginLeft: SPACING.sm },
  dropdownList:      { marginTop: SPACING.xs, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, backgroundColor: COLORS.white, overflow: 'hidden' as any },
  dropdownItem:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  dropdownItemTxt:   { flex: 1, fontSize: FONTS.sm, color: COLORS.gray[700] },
});

const um = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayBg:{ position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { backgroundColor: COLORS.gray[50], borderRadius: RADIUS.xl, width: 720, maxWidth: '95%' as any, maxHeight: '85%' as any, overflow: 'hidden' as any, zIndex: 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 16 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:    { fontSize: FONTS['2xl'], fontWeight: '700', color: COLORS.gray[900] },
  sub:      { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: COLORS.gray[500], fontWeight: '600', fontSize: 13 },
});

const co = StyleSheet.create({
  card:      { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[100], marginBottom: SPACING.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs },
  planBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  planTxt:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontSize: 11, color: COLORS.gray[500] },
  userCount: { fontSize: 12, color: COLORS.gray[500] },
  name:      { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900] },
  slug:      { fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 2 },
  switchBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '08', alignItems: 'center' },
  switchTxt: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
});

const lr = StyleSheet.create({
  addRow:       { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  input:        { flex: 1, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white },
  addBtn:       { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: '#ef4444', justifyContent: 'center' },
  addBtnTxt:    { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
  item:         { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[100], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  itemLabel:    { flex: 1, fontSize: FONTS.base, color: COLORS.gray[800] },
  itemActions:  { flexDirection: 'row', gap: SPACING.xs },
  editRow:      { flex: 1, flexDirection: 'row', gap: SPACING.xs, alignItems: 'center' },
  editInput:    { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, fontSize: FONTS.base },
  editBtn:      { width: 32, height: 32, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray[50] },
  editBtnTxt:   { fontSize: 14, color: COLORS.gray[600] },
  deleteBtn:    { width: 32, height: 32, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2' },
  deleteBtnTxt: { fontSize: 14 },
  saveBtn:      { width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt:   { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  cancelBtn:    { width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { color: COLORS.gray[600], fontWeight: '700', fontSize: 14 },
});

// ─── Reorderable stage list ───────────────────────────────────────────────────
/** Lista de etapas de um funil com reordenação por setas (cima/baixo) e ações de editar, excluir e adicionar etapa. */
function DraggableStageList({ funnel, onReorder, onEditStage, onDeleteStage, onAddStage }: {
  funnel: Funnel;
  onReorder: (orderedIds: string[]) => void;
  onEditStage: (stage: FunnelStage) => void;
  onDeleteStage: (stage: FunnelStage) => void;
  onAddStage: () => void;
}) {
  const [localStages, setLocalStages] = useState(funnel.stages);
  useEffect(() => { setLocalStages(funnel.stages); }, [funnel.stages]);

  // Move uma etapa da posição fromIdx para toIdx, atualiza o estado local e notifica a nova ordem.
  const moveStage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= localStages.length) return;
    const reordered = [...localStages];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalStages(reordered);
    onReorder(reordered.map((s) => s.id));
  };

  return (
    <View style={styles.stageList}>
      {localStages.map((stage, idx) => (
        <View key={stage.id} style={styles.stageRow}>
          <View style={dsl.arrows}>
            <Pressable
              style={[dsl.arrowBtn, idx === 0 && dsl.arrowDisabled]}
              onPress={() => moveStage(idx, idx - 1)}
              disabled={idx === 0}
            >
              <Text style={[dsl.arrowTxt, idx === 0 && dsl.arrowTxtDisabled]}>▲</Text>
            </Pressable>
            <Pressable
              style={[dsl.arrowBtn, idx === localStages.length - 1 && dsl.arrowDisabled]}
              onPress={() => moveStage(idx, idx + 1)}
              disabled={idx === localStages.length - 1}
            >
              <Text style={[dsl.arrowTxt, idx === localStages.length - 1 && dsl.arrowTxtDisabled]}>▼</Text>
            </Pressable>
          </View>
          <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
          <Text style={styles.stageIdx}>#{idx + 1}</Text>
          <View style={styles.stageInfo}>
            <Text style={styles.stageName}>{stage.name}</Text>
            <Text style={styles.stageMeta}>
              {stage.type === 'won' ? 'Ganho' : stage.type === 'lost' ? 'Perdido' : 'Em andamento'} · {stage.probability}%
            </Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={() => onEditStage(stage)}>
            <Text style={styles.iconBtnTxt}>✏️</Text>
          </Pressable>
          {funnel.stages.length > 1 && (
            <Pressable style={styles.iconBtn} onPress={() => onDeleteStage(stage)}>
              <Text style={styles.iconBtnTxt}>🗑</Text>
            </Pressable>
          )}
        </View>
      ))}
      <Pressable style={styles.addStageBtn} onPress={onAddStage}>
        <Text style={styles.addStageBtnText}>+ Nova Etapa</Text>
      </Pressable>
    </View>
  );
}
const dsl = StyleSheet.create({
  arrows:          { flexDirection: 'column', gap: 2, marginRight: 4 },
  arrowBtn:        { width: 22, height: 16, borderRadius: 4, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  arrowDisabled:   { opacity: 0.3 },
  arrowTxt:        { fontSize: 8, color: COLORS.gray[600], fontWeight: '700' },
  arrowTxtDisabled:{ color: COLORS.gray[300] },
});

const acl = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  sheet:          { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, width: 520, maxWidth: '95%' as unknown as number, maxHeight: '85%' as unknown as number, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 16 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:          { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900] },
  closeBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt:       { fontSize: 12, color: COLORS.gray[600], fontWeight: '700' },
  body:           { padding: SPACING.lg, maxHeight: 460 },
  label:          { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  input:          { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], marginBottom: SPACING.md, backgroundColor: COLORS.white },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: COLORS.gray[400], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  permRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.gray[300], alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark:      { color: COLORS.white, fontSize: 13, fontWeight: '700', marginTop: -1 },
  permLabel:      { fontSize: FONTS.sm, color: COLORS.gray[700], flex: 1 },
  footer:         { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  cancelBtn:      { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:      { color: COLORS.gray[600], fontWeight: '600' },
  saveBtn:        { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveTxt:        { color: COLORS.white, fontWeight: '600' },
});

// ─── Main settings screen ──────────────────────────────────────────────────────
/** Tela principal de Configurações: lista cartões de gestão (funis, campos, produtos, usuários, equipes, empresas, ACL, etc.) e hospeda todos os modais correspondentes. */
export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const syncIndicator = useUIStore((s) => s.syncIndicator);
  const { funnels, loadFunnels, createFunnel, updateFunnel, deleteFunnel, setDefaultFunnel, createStage, updateStage, deleteStage, reorderStages, winLossReasons, loadWinLossReasons, createWinLossReason, updateWinLossReason, deleteWinLossReason } = useFunnelStore();
  const { coolingThresholds, loadSettings, updateCoolingThresholds } = useSettingsStore();
  const { fields, loadFields, createField, deleteField } = useCustomFieldStore();
  const { catalog, loadCatalog, createProduct, deleteProduct } = useProductStore();
  const { users, loadUsers, updateUser } = useCRMUserStore();
  const { teams, loadTeams, createTeam, deleteTeam } = useTeamStore();
  const { companies, loadCompanies, createCompany, updateCompany, deleteCompany } = useCompanyStore();
  const { profiles: aclProfiles, loadProfiles: loadACLProfiles, createProfile: createACLProfile, updateProfile: updateACLProfile, deleteProfile: deleteACLProfile } = useACLProfileStore();
  const companyAttrs    = useCompanyAttrStore();
  const cities          = useCitiesStore((s) => s.cities);
  const citiesLoading   = useCitiesStore((s) => s.loading);
  const loadCities      = useCitiesStore((s) => s.load);

  const [expandedFunnel, setExpandedFunnel] = useState<string | null>(null);
  const [funnelsManagerVisible, setFunnelsManagerVisible] = useState(false);
  const [coolingManagerVisible, setCoolingManagerVisible] = useState(false);
  const [customFieldsManagerVisible, setCustomFieldsManagerVisible] = useState(false);
  const [productsManagerVisible, setProductsManagerVisible] = useState(false);
  const [teamsManagerVisible, setTeamsManagerVisible] = useState(false);
  const [aclProfilesManagerVisible, setAclProfilesManagerVisible] = useState(false);
  const [apiExternaVisible, setApiExternaVisible] = useState(false);
  const [palavrasChaveVisible, setPalavrasChaveVisible] = useState(false);
  const [funnelModal, setFunnelModal] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [stageModal, setStageModal] = useState(false);
  const [stageModalFunnelId, setStageModalFunnelId] = useState('');
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null);

  // Cooling settings state
  const [warningDays, setWarningDays] = useState(String(coolingThresholds.warningDays));
  const [dangerDays, setDangerDays] = useState(String(coolingThresholds.dangerDays));

  // Custom field modal state
  const [cfModal, setCfModal] = useState(false);
  const [cfName, setCfName] = useState('');
  const [cfType, setCfType] = useState<CustomFieldType>('text');
  const [cfOptions, setCfOptions] = useState<string[]>([]);
  const [cfOptionDraft, setCfOptionDraft] = useState('');

  // Product modal state
  const [prodModal, setProdModal] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDesc, setProdDesc] = useState('');

  // Users modal state
  const [showUsersModal, setShowUsersModal] = useState(false);

  // Loss reasons modal state
  const [showLossReasons, setShowLossReasons]     = useState(false);
  const [newReasonLabel, setNewReasonLabel]       = useState('');
  const [editingReason, setEditingReason]         = useState<WinLossReason | null>(null);
  const [editReasonLabel, setEditReasonLabel]     = useState('');

  // Companies modal state
  const [showCompaniesModal, setShowCompaniesModal] = useState(false);
  const [companyForm, setCompanyForm]               = useState<{
    name: string; slug: string; plan: Company['plan']; cnpj: string;
    city: string; state: string;
    porteId: string | null;
    fornecimentoId: string | null;
    eixoId: string | null;
    segmentoId: string | null;
    produtoIds: string[];
  }>({
    name: '', slug: '', plan: 'starter', cnpj: '',
    city: '', state: '',
    porteId: null, fornecimentoId: null, eixoId: null, segmentoId: null,
    produtoIds: [],
  });
  const [editingCompany, setEditingCompany]         = useState<Company | null>(null);
  const [showCompanyForm, setShowCompanyForm]       = useState(false);

  // Company user-assignment modal state
  const [showCompanyUsersModal, setShowCompanyUsersModal] = useState(false);
  const [companyUsersTarget, setCompanyUsersTarget]       = useState<Company | null>(null);
  const [companyUserSearch, setCompanyUserSearch]         = useState('');
  const [allUsers, setAllUsers]                           = useState<(CRMUser & { companyName?: string | null; companyIds?: string[] })[]>([]);
  const [assigningUserId, setAssigningUserId]             = useState<string | null>(null);

  // Teams modal state
  const [showCreateTeam, setShowCreateTeam]       = useState(false);
  const [teamName, setTeamName]                   = useState('');
  const [teamDesc, setTeamDesc]                   = useState('');
  const [teamColor, setTeamColor]                 = useState('#3b82f6');
  const [activeTeam, setActiveTeam]               = useState<Team | null>(null);

  // ACL modal state
  const [showACLModal, setShowACLModal]           = useState(false);
  const [editingACL, setEditingACL]               = useState<ACLProfile | null>(null);
  const [aclName, setAclName]                     = useState('');
  const [aclDesc, setAclDesc]                     = useState('');
  const [aclPerms, setAclPerms]                   = useState<ACLPermissions>({ ...DEFAULT_PERMISSIONS });
  const [aclFunnelIds, setAclFunnelIds]           = useState<string[]>([]);

  React.useEffect(() => {
    loadFunnels();
    loadSettings();
    loadFields();
    loadCatalog();
    loadUsers();
    loadTeams();
    loadWinLossReasons();
    loadCompanies();
    loadACLProfiles();
    companyAttrs.loadAll();
    loadCities();
  }, []);

  React.useEffect(() => {
    setWarningDays(String(coolingThresholds.warningDays));
    setDangerDays(String(coolingThresholds.dangerDays));
  }, [coolingThresholds.warningDays, coolingThresholds.dangerDays]);

  // Encerra a sessão e redireciona para a tela de login.
  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  // Pede confirmação e exclui o funil (ignora funis padrão).
  const confirmDeleteFunnel = (f: Funnel) => {
    if (f.isDefault) return;
    const doDelete = () => deleteFunnel(f.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir funil "${f.name}"?`)) doDelete();
    } else {
      Alert.alert('Excluir', `Excluir funil "${f.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Pede confirmação e exclui uma etapa do funil.
  const confirmDeleteStage = (funnelId: string, st: FunnelStage) => {
    const doDelete = () => deleteStage(funnelId, st.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir etapa "${st.name}"?`)) doDelete();
    } else {
      Alert.alert('Excluir', `Excluir etapa "${st.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Abre o modal de etapa em modo de criação para o funil informado.
  const openCreateStage = (funnelId: string) => {
    setStageModalFunnelId(funnelId);
    setEditingStage(null);
    setStageModal(true);
  };

  // Abre o modal de etapa em modo de edição para a etapa informada.
  const openEditStage = (funnelId: string, stage: FunnelStage) => {
    setStageModalFunnelId(funnelId);
    setEditingStage(stage);
    setStageModal(true);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Configurações' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

        {/* Account */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <Text style={styles.email}>{user?.displayName ?? 'Usuário'}</Text>
          <Text style={[styles.email, { color: COLORS.gray[400], fontSize: FONTS.sm }]}>{user?.email}</Text>
        </Card>

        {/* Sync */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Sincronização</Text>
          <View style={styles.syncRow}>
            <View style={[styles.dot, { backgroundColor: INDICATOR_COLORS[syncIndicator] }]} />
            <Text style={styles.syncLabel}>{syncIndicator.charAt(0).toUpperCase() + syncIndicator.slice(1)}</Text>
          </View>
        </Card>

        {/* Funnel management — opens modal */}
        <Pressable onPress={() => setFunnelsManagerVisible(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Funis de Venda</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{funnels.length} funil(is)</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* Cooling thresholds — opens modal */}
        <Pressable onPress={() => setCoolingManagerVisible(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Negociação Esfriando</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{coolingThresholds.warningDays}d / {coolingThresholds.dangerDays}d</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* Custom Fields — opens modal */}
        <Pressable onPress={() => setCustomFieldsManagerVisible(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Campos Personalizados</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{fields.length} campo(s)</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* Product Catalog — opens modal */}
        <Pressable onPress={() => setProductsManagerVisible(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Catálogo de Produtos</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{catalog.length} produto(s)</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* ACL Profiles — opens modal */}
        <Pressable onPress={() => setAclProfilesManagerVisible(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Níveis de Acesso (ACL)</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{aclProfiles.length} perfil(is)</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* Loss Reasons — opens modal */}
        <Pressable onPress={() => setShowLossReasons(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Motivos de Perda</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{winLossReasons.filter((r) => r.type === 'lost').length} motivo(s)</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* Users — opens modal */}
        <Pressable onPress={() => setShowUsersModal(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Usuários</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{users.length} usuário(s)</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* Teams — opens modal */}
        <Pressable onPress={() => setTeamsManagerVisible(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Equipes</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{teams.length} equipe(s)</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* Companies — opens modal (admin only) */}
        {user?.role === 'admin' && (
          <Pressable onPress={() => setShowCompaniesModal(true)}>
            <Card style={styles.card}>
              <View style={styles.menuItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Empresas</Text>
                  <View style={styles.companyBadge}>
                    <Text style={styles.companyBadgeText}>{companies.length} empresa(s)</Text>
                  </View>
                </View>
                <Text style={styles.menuItemChevron}>›</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* Palavras-Chave — opens modal (todos os usuários do tenant) */}
        <Pressable onPress={() => setPalavrasChaveVisible(true)}>
          <Card style={styles.card}>
            <View style={styles.menuItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Palavras-Chave</Text>
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>busca de licitações</Text>
                </View>
              </View>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </Card>
        </Pressable>

        {/* API Externa — opens modal (admin/manager) */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <Pressable onPress={() => setApiExternaVisible(true)}>
            <Card style={styles.card}>
              <View style={styles.menuItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>API Externa</Text>
                  <View style={styles.companyBadge}>
                    <Text style={styles.companyBadgeText}>portais de licitações</Text>
                  </View>
                </View>
                <Text style={styles.menuItemChevron}>›</Text>
              </View>
            </Card>
          </Pressable>
        )}

      </ScrollView>

      <ApiExternaModal visible={apiExternaVisible} onClose={() => setApiExternaVisible(false)} />
      <PalavrasChaveModal visible={palavrasChaveVisible} onClose={() => setPalavrasChaveVisible(false)} />

      {/* Funnels Manager Modal */}
      <Modal
        visible={funnelsManagerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFunnelsManagerVisible(false)}
      >
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setFunnelsManagerVisible(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View style={{ flex: 1 }}>
                <Text style={um.title}>Funis de Venda</Text>
                <Text style={um.sub}>{funnels.length} funil(is) configurado(s)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => { setEditingFunnel(null); setFunnelModal(true); }}
                >
                  <Text style={styles.addBtnText}>+ Novo</Text>
                </Pressable>
                <Pressable style={um.closeBtn} onPress={() => setFunnelsManagerVisible(false)}>
                  <Text style={um.closeTxt}>✕</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg }}>
              <Card style={styles.card}>
                {funnels.length === 0 && (
                  <Text style={styles.emptyTxt}>Nenhum funil cadastrado.</Text>
                )}
                {funnels.map((funnel) => (
                  <View key={funnel.id} style={styles.funnelBlock}>
                    <Pressable
                      style={styles.funnelRow}
                      onPress={() => setExpandedFunnel(expandedFunnel === funnel.id ? null : funnel.id)}
                    >
                      <View style={styles.funnelRowLeft}>
                        <Text style={styles.funnelName}>{funnel.name}</Text>
                        {funnel.isDefault && (
                          <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Padrão</Text></View>
                        )}
                      </View>
                      <View style={styles.funnelRowActions}>
                        {!funnel.isDefault && (
                          <Pressable style={styles.iconBtn} onPress={() => setDefaultFunnel(funnel.id)}>
                            <Text style={styles.iconBtnTxt}>⭐</Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.iconBtn} onPress={() => { setEditingFunnel(funnel); setFunnelModal(true); }}>
                          <Text style={styles.iconBtnTxt}>✏️</Text>
                        </Pressable>
                        {!funnel.isDefault && (
                          <Pressable style={styles.iconBtn} onPress={() => confirmDeleteFunnel(funnel)}>
                            <Text style={styles.iconBtnTxt}>🗑</Text>
                          </Pressable>
                        )}
                        <Text style={styles.chevron}>{expandedFunnel === funnel.id ? '▲' : '▼'}</Text>
                      </View>
                    </Pressable>

                    {expandedFunnel === funnel.id && (
                      <DraggableStageList
                        funnel={funnel}
                        onReorder={(orderedIds) => reorderStages(funnel.id, orderedIds)}
                        onEditStage={(stage) => openEditStage(funnel.id, stage)}
                        onDeleteStage={(stage) => confirmDeleteStage(funnel.id, stage)}
                        onAddStage={() => openCreateStage(funnel.id)}
                      />
                    )}
                  </View>
                ))}
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cooling Thresholds Manager Modal */}
      <Modal
        visible={coolingManagerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCoolingManagerVisible(false)}
      >
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setCoolingManagerVisible(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View style={{ flex: 1 }}>
                <Text style={um.title}>Negociação Esfriando</Text>
                <Text style={um.sub}>Dias sem movimentação para mudar a cor do badge</Text>
              </View>
              <Pressable style={um.closeBtn} onPress={() => setCoolingManagerVisible(false)}>
                <Text style={um.closeTxt}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg }}>
              <Card style={styles.card}>
                <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>⚠️ Aviso (Amarelo)</Text>
                    <TextInput
                      style={s.input}
                      value={warningDays}
                      onChangeText={setWarningDays}
                      keyboardType="numeric"
                      placeholder="15"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>🔴 Perigo (Vermelho)</Text>
                    <TextInput
                      style={s.input}
                      value={dangerDays}
                      onChangeText={setDangerDays}
                      keyboardType="numeric"
                      placeholder="30"
                    />
                  </View>
                </View>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => {
                    updateCoolingThresholds({ warningDays: parseInt(warningDays) || 15, dangerDays: parseInt(dangerDays) || 30 });
                    setCoolingManagerVisible(false);
                  }}
                >
                  <Text style={styles.addBtnText}>Salvar configuração</Text>
                </Pressable>
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Fields Manager Modal */}
      <Modal
        visible={customFieldsManagerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomFieldsManagerVisible(false)}
      >
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setCustomFieldsManagerVisible(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View style={{ flex: 1 }}>
                <Text style={um.title}>Campos Personalizados</Text>
                <Text style={um.sub}>{fields.length} campo(s) cadastrado(s)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => { setCfName(''); setCfType('text'); setCfOptions([]); setCfOptionDraft(''); setCfModal(true); }}
                >
                  <Text style={styles.addBtnText}>+ Novo</Text>
                </Pressable>
                <Pressable style={um.closeBtn} onPress={() => setCustomFieldsManagerVisible(false)}>
                  <Text style={um.closeTxt}>✕</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg }}>
              <Card style={styles.card}>
                {fields.length === 0 && (
                  <Text style={styles.emptyTxt}>Nenhum campo criado.</Text>
                )}
                {fields.map((f) => {
                  const typeLabel: Record<string, string> = { text: 'text', number: 'number', date: 'date', select: 'seleção única', multiselect: 'múltipla seleção' };
                  const optsHint = (f.fieldType === 'select' || f.fieldType === 'multiselect') && f.options
                    ? ` · ${f.options.length} opção(ões)`
                    : '';
                  return (
                    <View key={f.id} style={styles.funnelBlock}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.funnelName}>{f.name}</Text>
                          <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400] }}>
                            {typeLabel[f.fieldType] ?? f.fieldType}{optsHint}{f.isRequired ? ' · Obrigatório' : ''}
                          </Text>
                          {(f.fieldType === 'select' || f.fieldType === 'multiselect') && f.options && f.options.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {f.options.map((o, i) => (
                                <View key={`${o}-${i}`} style={{ backgroundColor: COLORS.gray[100], borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 1 }}>
                                  <Text style={{ fontSize: 10, color: COLORS.gray[600] }}>{o}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <Pressable style={styles.iconBtn} onPress={() => deleteField(f.id)}>
                          <Text style={styles.iconBtnTxt}>🗑</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Products Manager Modal */}
      <Modal
        visible={productsManagerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProductsManagerVisible(false)}
      >
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setProductsManagerVisible(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View style={{ flex: 1 }}>
                <Text style={um.title}>Catálogo de Produtos</Text>
                <Text style={um.sub}>{catalog.length} produto(s) cadastrado(s)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => { setProdName(''); setProdPrice(''); setProdDesc(''); setProdModal(true); }}
                >
                  <Text style={styles.addBtnText}>+ Novo</Text>
                </Pressable>
                <Pressable style={um.closeBtn} onPress={() => setProductsManagerVisible(false)}>
                  <Text style={um.closeTxt}>✕</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg }}>
              <Card style={styles.card}>
                {catalog.length === 0 && (
                  <Text style={styles.emptyTxt}>Nenhum produto cadastrado.</Text>
                )}
                {catalog.map((p) => (
                  <View key={p.id} style={styles.funnelBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={styles.funnelName}>{p.name}</Text>
                        <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400] }}>{formatCurrency(p.unitPrice)}</Text>
                      </View>
                      <Pressable style={styles.iconBtn} onPress={() => deleteProduct(p.id)}>
                        <Text style={styles.iconBtnTxt}>🗑</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Teams Manager Modal */}
      <Modal
        visible={teamsManagerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTeamsManagerVisible(false)}
      >
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setTeamsManagerVisible(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View style={{ flex: 1 }}>
                <Text style={um.title}>Equipes</Text>
                <Text style={um.sub}>{teams.length} equipe(s) cadastrada(s)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => { setTeamName(''); setTeamDesc(''); setTeamColor('#3b82f6'); setShowCreateTeam(true); }}
                >
                  <Text style={styles.addBtnText}>+ Nova</Text>
                </Pressable>
                <Pressable style={um.closeBtn} onPress={() => setTeamsManagerVisible(false)}>
                  <Text style={um.closeTxt}>✕</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg }}>
              <Card style={styles.card}>
                {teams.length === 0 && (
                  <Text style={styles.emptyTxt}>Nenhuma equipe criada.</Text>
                )}
                {teams.map((team) => (
                  <View key={team.id} style={styles.funnelBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }} onPress={() => setActiveTeam(team)}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: team.color }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.funnelName}>{team.name}</Text>
                          {team.description ? <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400] }}>{team.description}</Text> : null}
                        </View>
                        <AnimatedCounter count={team.memberCount} />
                      </Pressable>
                      <Pressable style={styles.iconBtn} onPress={() => { if (Platform.OS === 'web' && window.confirm(`Excluir equipe "${team.name}"?`)) deleteTeam(team.id); }}>
                        <Text style={styles.iconBtnTxt}>🗑</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ACL Profiles Manager Modal */}
      <Modal
        visible={aclProfilesManagerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAclProfilesManagerVisible(false)}
      >
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setAclProfilesManagerVisible(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View style={{ flex: 1 }}>
                <Text style={um.title}>Níveis de Acesso (ACL)</Text>
                <Text style={um.sub}>{aclProfiles.length} perfil(is) cadastrado(s)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => {
                    setEditingACL(null);
                    setAclName('');
                    setAclDesc('');
                    setAclPerms({ ...DEFAULT_PERMISSIONS });
                    setAclFunnelIds([]);
                    setShowACLModal(true);
                  }}
                >
                  <Text style={styles.addBtnText}>+ Novo</Text>
                </Pressable>
                <Pressable style={um.closeBtn} onPress={() => setAclProfilesManagerVisible(false)}>
                  <Text style={um.closeTxt}>✕</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg }}>
              <Card style={styles.card}>
                {aclProfiles.length === 0 && (
                  <Text style={styles.emptyTxt}>Nenhum perfil de acesso criado.</Text>
                )}
                {aclProfiles.map((profile) => {
                  const openEdit = () => {
                    setEditingACL(profile);
                    setAclName(profile.name);
                    setAclDesc(profile.description ?? '');
                    setAclPerms({ ...DEFAULT_PERMISSIONS, ...profile.permissions });
                    setAclFunnelIds(profile.funnelIds ?? []);
                    setShowACLModal(true);
                  };
                  const enabledCount = Object.values(profile.permissions).filter(Boolean).length;
                  const totalCount = Object.keys(PERMISSION_LABELS).length;
                  return (
                    <View key={profile.id} style={styles.funnelBlock}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Pressable style={{ flex: 1 }} onPress={openEdit}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: profile.color }} />
                            <Text style={styles.funnelName}>{profile.name}</Text>
                            <View style={{ backgroundColor: profile.color + '18', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, color: profile.color, fontWeight: '700' }}>
                                Nível {profile.level}
                              </Text>
                            </View>
                            {profile.isSystem && (
                              <View style={{ backgroundColor: COLORS.gray[100], borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 9, color: COLORS.gray[500], fontWeight: '600' }}>Sistema</Text>
                              </View>
                            )}
                          </View>
                          {profile.description ? <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 2, marginLeft: 24 }} numberOfLines={1}>{profile.description}</Text> : null}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginLeft: 24 }}>
                            <Text style={{ fontSize: 10, color: COLORS.gray[500] }}>{enabledCount}/{totalCount} permissões</Text>
                            {profile.funnelIds.length > 0 && (
                              <Text style={{ fontSize: 10, color: '#f59e0b' }}>
                                {profile.funnelIds.length} funil(is)
                              </Text>
                            )}
                          </View>
                        </Pressable>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <Pressable style={styles.iconBtn} onPress={openEdit}>
                            <Text style={styles.iconBtnTxt}>✏️</Text>
                          </Pressable>
                          {!profile.isSystem && (
                            <Pressable style={styles.iconBtn} onPress={() => {
                              if (Platform.OS === 'web' && window.confirm(`Excluir perfil "${profile.name}"?`)) deleteACLProfile(profile.id);
                            }}>
                              <Text style={styles.iconBtnTxt}>🗑</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FunnelModal
        visible={funnelModal}
        editing={editingFunnel}
        onClose={() => setFunnelModal(false)}
        onCreate={(name, desc) => createFunnel({ name, description: desc || undefined })}
        onUpdate={(id, name, desc) => updateFunnel(id, { name, description: desc || undefined })}
      />

      <StageModal
        visible={stageModal}
        funnelId={stageModalFunnelId}
        editing={editingStage}
        onClose={() => setStageModal(false)}
        onCreate={(fId, data) => createStage({ ...data, funnelId: fId })}
        onUpdate={(fId, stId, data) => updateStage(fId, stId, data)}
      />

      {/* ── Loss Reasons Modal ─────────────────────────────────────────── */}
      <Modal visible={showLossReasons} transparent animationType="fade" onRequestClose={() => setShowLossReasons(false)}>
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setShowLossReasons(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View style={{ flex: 1 }}>
                <Text style={um.title}>Motivos de Perda</Text>
                <Text style={um.sub}>{winLossReasons.filter((r) => r.type === 'lost').length} motivo(s)</Text>
              </View>
              <Pressable style={um.closeBtn} onPress={() => setShowLossReasons(false)}>
                <Text style={um.closeTxt}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm }}>
            {/* Add new */}
            <View style={lr.addRow}>
              <TextInput
                style={lr.input}
                placeholder="Novo motivo de perda..."
                placeholderTextColor={COLORS.gray[400]}
                value={newReasonLabel}
                onChangeText={setNewReasonLabel}
              />
              <Pressable
                style={[lr.addBtn, !newReasonLabel.trim() && { opacity: 0.4 }]}
                onPress={async () => {
                  if (!newReasonLabel.trim()) return;
                  await createWinLossReason({ type: 'lost', label: newReasonLabel.trim() });
                  setNewReasonLabel('');
                }}
              >
                <Text style={lr.addBtnTxt}>+ Adicionar</Text>
              </Pressable>
            </View>

            {/* List */}
            {winLossReasons.filter((r) => r.type === 'lost').map((r) => (
              <View key={r.id} style={lr.item}>
                {editingReason?.id === r.id ? (
                  <View style={lr.editRow}>
                    <TextInput
                      style={lr.editInput}
                      value={editReasonLabel}
                      onChangeText={setEditReasonLabel}
                      autoFocus
                    />
                    <Pressable style={lr.saveBtn} onPress={async () => {
                      if (editReasonLabel.trim()) await updateWinLossReason(r.id, editReasonLabel.trim());
                      setEditingReason(null);
                    }}>
                      <Text style={lr.saveBtnTxt}>✓</Text>
                    </Pressable>
                    <Pressable style={lr.cancelBtn} onPress={() => setEditingReason(null)}>
                      <Text style={lr.cancelBtnTxt}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={lr.itemLabel}>{r.label}</Text>
                    <View style={lr.itemActions}>
                      <Pressable style={lr.editBtn} onPress={() => { setEditingReason(r); setEditReasonLabel(r.label); }}>
                        <Text style={lr.editBtnTxt}>✎</Text>
                      </Pressable>
                      <Pressable style={lr.deleteBtn} onPress={() => deleteWinLossReason(r.id)}>
                        <Text style={lr.deleteBtnTxt}>🗑</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}
            {winLossReasons.filter((r) => r.type === 'lost').length === 0 && (
              <Text style={{ color: COLORS.gray[400], textAlign: 'center', marginTop: SPACING.xl }}>
                Nenhum motivo cadastrado ainda.{'\n'}Adicione um acima.
              </Text>
            )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Users Modal ────────────────────────────────────────────────── */}
      <Modal visible={showUsersModal} animationType="fade" transparent onRequestClose={() => setShowUsersModal(false)}>
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setShowUsersModal(false)} />
          <View style={um.sheet}>
            <View style={um.header}>
              <View>
                <Text style={um.title}>Usuários</Text>
                <Text style={um.sub}>{users.length} usuário{users.length !== 1 ? 's' : ''}</Text>
              </View>
              <Pressable style={um.closeBtn} onPress={() => setShowUsersModal(false)}>
                <Text style={um.closeTxt}>✕</Text>
              </Pressable>
            </View>
            <UsersPanel users={users} companies={companies} aclProfiles={aclProfiles} />
          </View>
        </View>
      </Modal>

      {/* ── Companies Modal ────────────────────────────────────────────── */}
      <Modal visible={showCompaniesModal} animationType="fade" transparent onRequestClose={() => setShowCompaniesModal(false)}>
        <View style={um.overlay}>
          <Pressable style={um.overlayBg} onPress={() => setShowCompaniesModal(false)} />
          <View style={um.sheet}>
          <View style={um.header}>
            <View>
              <Text style={um.title}>Empresas (Tenants)</Text>
              <Text style={um.sub}>{companies.length} empresa{companies.length !== 1 ? 's' : ''} cadastrada{companies.length !== 1 ? 's' : ''}</Text>
            </View>
            <Pressable style={[styles.addBtn, { marginRight: SPACING.md }]} onPress={() => {
              setEditingCompany(null);
              setCompanyForm({
                name: '', slug: '', plan: 'starter', cnpj: '',
                city: '', state: '',
                porteId: null, fornecimentoId: null, eixoId: null, segmentoId: null,
                produtoIds: [],
              });
              setShowCompanyForm(true);
            }}>
              <Text style={styles.addBtnText}>+ Nova</Text>
            </Pressable>
            <Pressable style={um.closeBtn} onPress={() => setShowCompaniesModal(false)}>
              <Text style={um.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm }}>
            {companies.length === 0 && (
              <Text style={{ color: COLORS.gray[400], textAlign: 'center', marginTop: SPACING.xl }}>Nenhuma empresa cadastrada.</Text>
            )}
            {companies.map((c) => (
              <View key={c.id} style={co.card}>
                <View style={co.header}>
                  <View style={[co.planBadge, { backgroundColor: c.plan === 'enterprise' ? '#7c3aed18' : c.plan === 'pro' ? '#0891b218' : '#16a34a18' }]}>
                    <Text style={[co.planTxt, { color: c.plan === 'enterprise' ? '#7c3aed' : c.plan === 'pro' ? '#0891b2' : '#16a34a' }]}>
                      {c.plan.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[co.statusDot, { backgroundColor: c.isActive ? COLORS.success : COLORS.gray[300] }]} />
                  <Text style={co.statusTxt}>{c.isActive ? 'Ativa' : 'Inativa'}</Text>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => { setCompanyUsersTarget(c); setCompanyUserSearch(''); setAllUsers([]); setShowCompanyUsersModal(true); apiFetch<any[]>('/api/users?allCompanies=1').then(setAllUsers).catch(() => {}); }}>
                    <Text style={co.userCount}>👥 {c.userCount}</Text>
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => {
                    setEditingCompany(c);
                    setCompanyForm({
                      name: c.name, slug: c.slug, plan: c.plan, cnpj: c.cnpj ?? '',
                      city: c.city ?? '', state: c.state ?? '',
                      porteId: c.porteId ?? null,
                      fornecimentoId: c.fornecimentoId ?? null,
                      eixoId: c.eixoId ?? null,
                      segmentoId: c.segmentoId ?? null,
                      produtoIds: Array.isArray(c.produtoIds) ? [...c.produtoIds] : [],
                    });
                    setShowCompanyForm(true);
                  }}><Text style={styles.iconBtnTxt}>✏️</Text></Pressable>
                  <Pressable style={styles.iconBtn} onPress={async () => {
                    if (Platform.OS === 'web' && window.confirm(`Excluir empresa "${c.name}"?`)) {
                      try { await deleteCompany(c.id); }
                      catch (e: any) { if (Platform.OS === 'web') window.alert(e.message ?? 'Erro ao excluir'); }
                    }
                  }}><Text style={styles.iconBtnTxt}>🗑</Text></Pressable>
                </View>
                <Text style={co.name}>{c.name}</Text>
                <Text style={co.slug}>slug: {c.slug}{c.cnpj ? `  ·  CNPJ: ${c.cnpj}` : ''}</Text>
                {user?.role === 'admin' && (
                  <Pressable style={co.switchBtn} onPress={async () => {
                    try {
                      await switchCompany(c.id);
                      // Reload all company-scoped stores so UI reflects the new tenant
                      await Promise.all([
                        loadFunnels(),
                        loadWinLossReasons(),
                        loadUsers(),
                        loadTeams(),
                      ]);
                      setShowCompaniesModal(false);
                    } catch (e: any) {
                      if (Platform.OS === 'web') window.alert(e?.message ?? 'Erro ao trocar empresa');
                    }
                  }}>
                    <Text style={co.switchTxt}>↩ Alternar para esta empresa</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Company Users Assignment Modal ─────────────────────────────── */}
      <Modal visible={showCompanyUsersModal} animationType="slide" onRequestClose={() => setShowCompanyUsersModal(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
          <View style={um.header}>
            <View style={{ flex: 1 }}>
              <Text style={um.title}>Usuários — {companyUsersTarget?.name}</Text>
              <Text style={um.sub}>Clique para mover o usuário para esta empresa</Text>
            </View>
            <Pressable style={um.closeBtn} onPress={() => setShowCompanyUsersModal(false)}>
              <Text style={um.closeTxt}>✕  Fechar</Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] }}>
            <TextInput
              style={[s.input, { marginBottom: 0 }]}
              placeholder="Buscar por nome ou e-mail..."
              value={companyUserSearch}
              onChangeText={setCompanyUserSearch}
              autoCapitalize="none"
            />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.xs }}>
            {allUsers.length === 0 && (
              <Text style={{ color: COLORS.gray[400], textAlign: 'center', marginTop: SPACING.xl }}>Carregando usuários...</Text>
            )}
            {allUsers
              .filter((u) => {
                const q = companyUserSearch.toLowerCase();
                return !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
              })
              .map((u) => {
                const isMember  = (u.companyIds ?? []).includes(companyUsersTarget?.id ?? '');
                const isBusy    = assigningUserId === u.id;
                const otherCos  = (u.companyIds ?? []).filter((id) => id !== companyUsersTarget?.id);
                return (
                  <Pressable
                    key={u.id}
                    style={[cu.row, isMember && cu.rowActive]}
                    onPress={async () => {
                      if (isBusy) return;
                      setAssigningUserId(u.id);
                      const targetId = companyUsersTarget!.id;
                      try {
                        if (isMember) {
                          await apiFetch(`/api/users/${u.id}/companies/${targetId}`, { method: 'DELETE' });
                          setAllUsers((prev) => prev.map((x) => x.id === u.id
                            ? { ...x, companyIds: (x.companyIds ?? []).filter((id) => id !== targetId) }
                            : x));
                        } else {
                          await apiFetch(`/api/users/${u.id}/companies`, { method: 'POST', body: JSON.stringify({ companyId: targetId }) });
                          setAllUsers((prev) => prev.map((x) => x.id === u.id
                            ? { ...x, companyIds: [...(x.companyIds ?? []), targetId] }
                            : x));
                        }
                        await loadCompanies();
                      } catch (e: any) {
                        if (Platform.OS === 'web') window.alert(e?.message ?? 'Erro ao atualizar acesso');
                      } finally {
                        setAssigningUserId(null);
                      }
                    }}
                  >
                    <View style={[cu.avatar, { backgroundColor: (ROLE_COLORS[u.role] ?? '#4b5563') + '22' }]}>
                      <Text style={[cu.avatarTxt, { color: ROLE_COLORS[u.role] ?? '#4b5563' }]}>{u.displayName[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={cu.name}>{u.displayName}</Text>
                      <Text style={cu.email} numberOfLines={1}>{u.email}</Text>
                      {otherCos.length > 0 && (
                        <Text style={cu.currentCompany}>🏢 +{otherCos.length} outra{otherCos.length > 1 ? 's' : ''} empresa{otherCos.length > 1 ? 's' : ''}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[cu.roleBadge, { color: ROLE_COLORS[u.role] ?? '#4b5563' }]}>{ROLE_LABELS[u.role] ?? u.role}</Text>
                      {isBusy
                        ? <Text style={cu.moveHint}>...</Text>
                        : isMember
                          ? <Text style={cu.inCompany}>✓ Membro  —  Remover</Text>
                          : <Text style={cu.moveHint}>+ Adicionar</Text>
                      }
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Company Create/Edit Modal ───────────────────────────────────── */}
      <Modal visible={showCompanyForm} transparent animationType="fade" onRequestClose={() => setShowCompanyForm(false)}>
        <View style={s.overlay}>
          <View style={[s.modal, { width: 440, maxHeight: '90%' as unknown as number }]}>
            <Text style={s.modalTitle}>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</Text>

            <ScrollView style={{ maxHeight: 540 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Nome *</Text>
            <TextInput
              style={s.input} value={companyForm.name} autoFocus
              onChangeText={(v) => setCompanyForm((f) => ({ ...f, name: v, slug: editingCompany ? f.slug : v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))}
              placeholder="Ex: Acme Vendas"
            />

            <Text style={s.label}>Slug (identificador único)</Text>
            <TextInput
              style={s.input} value={companyForm.slug}
              onChangeText={(v) => setCompanyForm((f) => ({ ...f, slug: v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))}
              placeholder="ex: acme-vendas" autoCapitalize="none"
            />

            <Text style={s.label}>CNPJ</Text>
            <TextInput
              style={s.input}
              value={companyForm.cnpj}
              onChangeText={(v) => {
                // Auto-format: XX.XXX.XXX/XXXX-XX
                const digits = v.replace(/\D/g, '').slice(0, 14);
                let formatted = digits;
                if (digits.length > 12) formatted = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
                else if (digits.length > 8) formatted = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`;
                else if (digits.length > 5) formatted = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`;
                else if (digits.length > 2) formatted = `${digits.slice(0,2)}.${digits.slice(2)}`;
                setCompanyForm((f) => ({ ...f, cnpj: formatted }));
              }}
              placeholder="00.000.000/0000-00"
              keyboardType="numeric"
            />

            <Text style={s.label}>Localidade</Text>
            <CityAutocomplete
              value={companyForm.city}
              uf={companyForm.state}
              cities={cities}
              loading={citiesLoading}
              onSelect={(city, state) => setCompanyForm((f) => ({ ...f, city, state }))}
            />

            <Text style={s.label}>Porte</Text>
            <AttrPicker
              zIndex={55}
              options={companyAttrs.portes}
              value={companyForm.porteId}
              onChange={(v) => setCompanyForm((f) => ({ ...f, porteId: (v as string | null) }))}
              onCreate={async (name) => companyAttrs.create('portes', name)}
              placeholder="Selecione o porte..."
            />

            <Text style={s.label}>Fornecimento</Text>
            <AttrPicker
              zIndex={50}
              options={companyAttrs.fornecimentos}
              value={companyForm.fornecimentoId}
              onChange={(v) => setCompanyForm((f) => ({ ...f, fornecimentoId: (v as string | null) }))}
              onCreate={async (name) => companyAttrs.create('fornecimentos', name)}
              placeholder="Selecione o fornecimento..."
            />

            <Text style={s.label}>Eixo</Text>
            <AttrPicker
              zIndex={45}
              options={companyAttrs.eixos}
              value={companyForm.eixoId}
              onChange={(v) => setCompanyForm((f) => ({ ...f, eixoId: (v as string | null) }))}
              onCreate={async (name) => companyAttrs.create('eixos', name)}
              placeholder="Selecione o eixo..."
            />

            <Text style={s.label}>Segmento</Text>
            <AttrPicker
              zIndex={40}
              options={companyAttrs.segmentos}
              value={companyForm.segmentoId}
              onChange={(v) => setCompanyForm((f) => ({ ...f, segmentoId: (v as string | null) }))}
              onCreate={async (name) => companyAttrs.create('segmentos', name)}
              placeholder="Selecione o segmento..."
            />

            <Text style={s.label}>Produtos</Text>
            <AttrPicker
              zIndex={35}
              multiple
              options={companyAttrs.produtos}
              value={companyForm.produtoIds}
              onChange={(v) => setCompanyForm((f) => ({ ...f, produtoIds: (v as string[]) ?? [] }))}
              onCreate={async (name) => companyAttrs.create('produtos', name)}
              placeholder="Selecione os produtos..."
            />

            <Text style={s.label}>Plano</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
              {(['starter', 'pro', 'enterprise'] as Company['plan'][]).map((p) => (
                <Pressable
                  key={p}
                  style={[{ flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' },
                    companyForm.plan === p && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  onPress={() => setCompanyForm((f) => ({ ...f, plan: p }))}
                >
                  <Text style={[{ fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[600] }, companyForm.plan === p && { color: COLORS.white }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            </ScrollView>

            <View style={s.row}>
              <Pressable style={s.cancelBtn} onPress={() => setShowCompanyForm(false)}><Text style={s.cancelTxt}>Cancelar</Text></Pressable>
              <Pressable
                style={[s.saveBtn, (!companyForm.name.trim() || !companyForm.slug.trim()) && s.disabled]}
                onPress={async () => {
                  if (!companyForm.name.trim() || !companyForm.slug.trim()) return;
                  try {
                    const payload = {
                      name: companyForm.name.trim(),
                      slug: companyForm.slug.trim(),
                      plan: companyForm.plan,
                      cnpj: companyForm.cnpj.trim() || undefined,
                      city: companyForm.city.trim() || null,
                      state: companyForm.state.trim() || null,
                      porteId: companyForm.porteId,
                      fornecimentoId: companyForm.fornecimentoId,
                      eixoId: companyForm.eixoId,
                      segmentoId: companyForm.segmentoId,
                      produtoIds: companyForm.produtoIds,
                    };
                    if (editingCompany) await updateCompany(editingCompany.id, payload);
                    else await createCompany(payload);
                    setShowCompanyForm(false);
                  } catch (e: any) {
                    const msg = e?.message ?? 'Erro ao salvar empresa';
                    if (Platform.OS === 'web') window.alert(msg);
                    else Alert.alert('Erro', msg);
                  }
                }}
              >
                <Text style={s.saveTxt}>{editingCompany ? 'Salvar' : 'Criar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Create Team Modal ───────────────────────────────────────────── */}
      <Modal visible={showCreateTeam} transparent animationType="fade" onRequestClose={() => setShowCreateTeam(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Nova Equipe</Text>
            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={teamName} onChangeText={setTeamName} autoFocus placeholder="Ex: Vendas, Suporte..." />
            <Text style={s.label}>Descrição</Text>
            <TextInput style={[s.input, s.inputMulti]} value={teamDesc} onChangeText={setTeamDesc} multiline numberOfLines={2} />
            <Text style={s.label}>Cor</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: SPACING.md }}>
              {['#3b82f6','#8b5cf6','#f59e0b','#ef4444','#16a34a','#f97316','#06b6d4','#ec4899'].map((c) => (
                <Pressable key={c} style={[{ width: 28, height: 28, borderRadius: 14, backgroundColor: c }, teamColor === c && { borderWidth: 3, borderColor: COLORS.gray[900] }]} onPress={() => setTeamColor(c)} />
              ))}
            </View>
            <View style={s.row}>
              <Pressable style={s.cancelBtn} onPress={() => setShowCreateTeam(false)}><Text style={s.cancelTxt}>Cancelar</Text></Pressable>
              <Pressable style={[s.saveBtn, !teamName.trim() && s.disabled]} onPress={async () => {
                if (!teamName.trim()) return;
                await createTeam({ name: teamName.trim(), description: teamDesc || undefined, color: teamColor });
                setShowCreateTeam(false);
              }}>
                <Text style={s.saveTxt}>Criar Equipe</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Team Members Modal ──────────────────────────────────────────── */}
      {activeTeam && (
        <TeamMembersModal
          team={activeTeam}
          users={users}
          onClose={() => setActiveTeam(null)}
        />
      )}

      {/* ── ACL Profile Modal ────────────────────────────────────────── */}
      <Modal visible={showACLModal} transparent animationType="fade" onRequestClose={() => setShowACLModal(false)}>
        <Pressable style={acl.overlay} onPress={() => setShowACLModal(false)}>
          <Pressable style={acl.sheet} onPress={() => {}}>
            <View style={[acl.header, editingACL && { borderLeftWidth: 4, borderLeftColor: editingACL.color }]}>
              <View style={{ flex: 1 }}>
                <Text style={acl.title}>{editingACL ? `Editar — ${editingACL.name}` : 'Novo Perfil de Acesso'}</Text>
                {editingACL && <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 2 }}>Nível {editingACL.level} {editingACL.isSystem ? '(Sistema)' : ''}</Text>}
              </View>
              <Pressable style={acl.closeBtn} onPress={() => setShowACLModal(false)}>
                <Text style={acl.closeTxt}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={acl.body} showsVerticalScrollIndicator={false}>
              <Text style={acl.label}>Nome do perfil *</Text>
              <TextInput
                style={acl.input}
                value={aclName}
                onChangeText={setAclName}
                placeholder="Ex: Analista, Coordenador..."
                placeholderTextColor={COLORS.gray[300]}
              />
              <Text style={acl.label}>Descrição</Text>
              <TextInput
                style={[acl.input, { height: 60, textAlignVertical: 'top' }]}
                value={aclDesc}
                onChangeText={setAclDesc}
                placeholder="Descreva o nível de acesso..."
                placeholderTextColor={COLORS.gray[300]}
                multiline
              />

              <Text style={acl.sectionLabel}>Permissões</Text>
              {(Object.keys(PERMISSION_LABELS) as (keyof ACLPermissions)[]).map((key) => (
                <Pressable
                  key={key}
                  style={acl.permRow}
                  onPress={() => setAclPerms((p) => ({ ...p, [key]: !p[key] }))}
                >
                  <View style={[acl.checkbox, aclPerms[key] && acl.checkboxActive]}>
                    {aclPerms[key] && <Text style={acl.checkmark}>✓</Text>}
                  </View>
                  <Text style={acl.permLabel}>{PERMISSION_LABELS[key]}</Text>
                </Pressable>
              ))}

              <Text style={[acl.sectionLabel, { marginTop: SPACING.lg }]}>Funis com acesso</Text>
              <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400], marginBottom: SPACING.sm }}>
                Sem seleção = acesso a todos os funis
              </Text>
              {funnels.map((f) => {
                const selected = aclFunnelIds.includes(f.id);
                return (
                  <Pressable
                    key={f.id}
                    style={acl.permRow}
                    onPress={() => setAclFunnelIds((ids) =>
                      selected ? ids.filter((id) => id !== f.id) : [...ids, f.id]
                    )}
                  >
                    <View style={[acl.checkbox, selected && acl.checkboxActive]}>
                      {selected && <Text style={acl.checkmark}>✓</Text>}
                    </View>
                    <Text style={acl.permLabel}>{f.name}</Text>
                    {f.isDefault && (
                      <View style={{ backgroundColor: COLORS.primary + '18', borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9, color: COLORS.primary, fontWeight: '700' }}>Padrão</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={acl.footer}>
              <Pressable style={acl.cancelBtn} onPress={() => setShowACLModal(false)}>
                <Text style={acl.cancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[acl.saveBtn, !aclName.trim() && { opacity: 0.5 }]}
                onPress={async () => {
                  if (!aclName.trim()) return;
                  const data = { name: aclName.trim(), description: aclDesc.trim() || undefined, permissions: aclPerms, funnelIds: aclFunnelIds };
                  if (editingACL) {
                    await updateACLProfile(editingACL.id, data);
                  } else {
                    await createACLProfile({ ...data, level: 1, color: '#64748b' });
                  }
                  setShowACLModal(false);
                }}
              >
                <Text style={acl.saveTxt}>{editingACL ? 'Salvar' : 'Criar'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Custom Field Modal */}
      <Modal visible={cfModal} transparent animationType="fade" onRequestClose={() => setCfModal(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Novo Campo</Text>
            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={cfName} onChangeText={setCfName} autoFocus placeholder="Ex: CPF, Tabela, Campanha..." />
            <Text style={s.label}>Tipo</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap', marginBottom: SPACING.md }}>
              {(['text', 'number', 'date', 'select', 'multiselect'] as CustomFieldType[]).map((t) => {
                const labels: Record<CustomFieldType, string> = { text: 'text', number: 'number', date: 'date', select: 'seleção única', multiselect: 'múltipla seleção' };
                return (
                  <Pressable key={t} style={[s.typeBtn, cfType === t && s.typeBtnActive]} onPress={() => setCfType(t)}>
                    <Text style={[s.typeBtnTxt, cfType === t && s.typeBtnTxtActive]}>{labels[t]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {(cfType === 'select' || cfType === 'multiselect') && (
              <>
                <Text style={s.label}>Opções *</Text>
                <View style={{ flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm }}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    value={cfOptionDraft}
                    onChangeText={setCfOptionDraft}
                    placeholder="Digite uma opção e pressione +"
                    onSubmitEditing={() => {
                      const v = cfOptionDraft.trim();
                      if (v && !cfOptions.includes(v)) { setCfOptions([...cfOptions, v]); setCfOptionDraft(''); }
                    }}
                  />
                  <Pressable
                    style={[styles.addBtn, !cfOptionDraft.trim() && s.disabled]}
                    onPress={() => {
                      const v = cfOptionDraft.trim();
                      if (v && !cfOptions.includes(v)) { setCfOptions([...cfOptions, v]); setCfOptionDraft(''); }
                    }}
                  >
                    <Text style={styles.addBtnText}>+ Adicionar</Text>
                  </Pressable>
                </View>
                {cfOptions.length > 0 && (
                  <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400], marginBottom: SPACING.xs, fontStyle: 'italic' }}>
                    {Platform.OS === 'web' ? 'Arraste para reordenar.' : 'Use as setas para reordenar.'}
                  </Text>
                )}
                <View style={{ flexDirection: 'column', gap: SPACING.xs, marginBottom: SPACING.md }}>
                  {cfOptions.length === 0 && (
                    <Text style={{ fontSize: FONTS.xs, color: COLORS.gray[400], fontStyle: 'italic' }}>
                      Nenhuma opção adicionada ainda.
                    </Text>
                  )}
                  {cfOptions.map((opt, idx) => {
                    const moveOption = (from: number, to: number) => {
                      if (to < 0 || to >= cfOptions.length || from === to) return;
                      const next = [...cfOptions];
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      setCfOptions(next);
                    };
                    const dndProps: any = Platform.OS === 'web' ? {
                      draggable: true,
                      onDragStart: (e: any) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; },
                      onDragOver: (e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
                      onDrop: (e: any) => {
                        e.preventDefault();
                        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                        if (!isNaN(from)) moveOption(from, idx);
                      },
                    } : {};
                    return (
                    <View
                      key={`${opt}-${idx}`}
                      {...dndProps}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: SPACING.sm,
                        backgroundColor: COLORS.primary + '14',
                        borderRadius: RADIUS.md,
                        paddingHorizontal: SPACING.sm,
                        paddingVertical: 6,
                        ...(Platform.OS === 'web' ? { cursor: 'grab' } as any : {}),
                      }}
                    >
                      <Text style={{ fontSize: 14, color: COLORS.primary, opacity: 0.6 }}>⋮⋮</Text>
                      {Platform.OS !== 'web' && (
                        <View style={{ flexDirection: 'column', gap: 2 }}>
                          <Pressable
                            onPress={() => moveOption(idx, idx - 1)}
                            disabled={idx === 0}
                            style={{ width: 22, height: 16, borderRadius: 4, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1 }}
                          >
                            <Text style={{ fontSize: 8, color: COLORS.gray[600], fontWeight: '700' }}>▲</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => moveOption(idx, idx + 1)}
                            disabled={idx === cfOptions.length - 1}
                            style={{ width: 22, height: 16, borderRadius: 4, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center', opacity: idx === cfOptions.length - 1 ? 0.3 : 1 }}
                          >
                            <Text style={{ fontSize: 8, color: COLORS.gray[600], fontWeight: '700' }}>▼</Text>
                          </Pressable>
                        </View>
                      )}
                      <Text style={{ flex: 1, fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' }}>{opt}</Text>
                      <Pressable
                        onPress={() => setCfOptions(cfOptions.filter((_, i) => i !== idx))}
                        style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary + '24', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '700' }}>×</Text>
                      </Pressable>
                    </View>
                    );
                  })}
                </View>
              </>
            )}

            <View style={s.row}>
              <Pressable style={s.cancelBtn} onPress={() => setCfModal(false)}><Text style={s.cancelTxt}>Cancelar</Text></Pressable>
              <Pressable
                style={[
                  s.saveBtn,
                  (!cfName.trim() || ((cfType === 'select' || cfType === 'multiselect') && cfOptions.length === 0)) && s.disabled,
                ]}
                onPress={() => {
                  if (!cfName.trim()) return;
                  if ((cfType === 'select' || cfType === 'multiselect') && cfOptions.length === 0) return;
                  const payload: { name: string; fieldType: CustomFieldType; options?: string[] } = {
                    name: cfName.trim(),
                    fieldType: cfType,
                  };
                  if (cfType === 'select' || cfType === 'multiselect') payload.options = cfOptions;
                  createField(payload);
                  setCfModal(false);
                }}
              >
                <Text style={s.saveTxt}>Criar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Modal */}
      <Modal visible={prodModal} transparent animationType="fade" onRequestClose={() => setProdModal(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Novo Produto</Text>
            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={prodName} onChangeText={setProdName} autoFocus placeholder="Ex: Plano Premium" />
            <Text style={s.label}>Preço (R$)</Text>
            <TextInput style={s.input} value={prodPrice} onChangeText={setProdPrice} keyboardType="decimal-pad" placeholder="Ex: 1500.00" />
            <Text style={s.label}>Descrição</Text>
            <TextInput style={[s.input, s.inputMulti]} value={prodDesc} onChangeText={setProdDesc} multiline numberOfLines={2} />
            <View style={s.row}>
              <Pressable style={s.cancelBtn} onPress={() => setProdModal(false)}><Text style={s.cancelTxt}>Cancelar</Text></Pressable>
              <Pressable style={[s.saveBtn, !prodName.trim() && s.disabled]} onPress={() => {
                if (!prodName.trim()) return;
                const price = Math.round((parseFloat(prodPrice.replace(',', '.')) || 0) * 100);
                createProduct({ name: prodName.trim(), unitPrice: price, description: prodDesc || null });
                setProdModal(false);
              }}>
                <Text style={s.saveTxt}>Criar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  content: { padding: SPACING.lg, paddingBottom: SPACING['2xl'], gap: SPACING.md },
  card: { marginBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[700], marginBottom: SPACING.xs },
  email: { fontSize: FONTS.base, color: COLORS.gray[800] },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  syncLabel: { fontSize: FONTS.base, color: COLORS.gray[700] },
  addBtnText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '700' },
  funnelBlock: { borderTopWidth: 1, borderTopColor: COLORS.gray[100], paddingTop: SPACING.sm, marginTop: SPACING.sm },
  funnelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  funnelRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  funnelName: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[800] },
  defaultBadge: { backgroundColor: COLORS.primary + '18', borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  companyBadge: { backgroundColor: COLORS.gray[100], borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  companyBadgeText: { fontSize: 10, color: COLORS.gray[600], fontWeight: '600', maxWidth: 120 },
  funnelRowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 4 },
  iconBtnTxt: { fontSize: 15 },
  chevron: { fontSize: FONTS.sm, color: COLORS.gray[400], marginLeft: 4 },
  stageList: { marginTop: SPACING.sm, paddingLeft: SPACING.md, gap: SPACING.xs },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageIdx: { fontSize: FONTS.sm, color: COLORS.gray[300], width: 20 },
  stageInfo: { flex: 1 },
  stageName: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[800] },
  stageMeta: { fontSize: 11, color: COLORS.gray[400] },
  addStageBtn: { marginTop: SPACING.xs, paddingVertical: SPACING.xs, alignItems: 'center', borderRadius: RADIUS.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.gray[300] },
  addStageBtnText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  menuItemText: { fontSize: FONTS.base, color: COLORS.gray[800] },
  menuItemChevron: { fontSize: FONTS.xl, color: COLORS.gray[400] },
  // Loss reasons preview
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  emptyTxt:    { fontSize: FONTS.sm, color: COLORS.gray[400], fontStyle: 'italic', paddingVertical: SPACING.xs },
  reasonRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: 3 },
  reasonDot:   { fontSize: 12, color: '#ef4444', fontWeight: '700' },
  reasonLabel: { fontSize: FONTS.sm, color: COLORS.gray[700] },
  addBtn:      { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100], borderWidth: 1, borderColor: COLORS.gray[200] },
  addBtnTxt:   { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
});

// Modal styles
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 420, maxWidth: '92%' as unknown as number },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.lg },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.base, color: COLORS.gray[900], marginBottom: SPACING.md, backgroundColor: COLORS.white,
  },
  inputMulti: { height: 72, textAlignVertical: 'top' },
  colorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: SPACING.md },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: COLORS.gray[900] },
  typeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  typeBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnTxt: { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '500' },
  typeBtnTxtActive: { color: COLORS.white, fontWeight: '700' },
  row: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end', marginTop: SPACING.sm },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt: { color: COLORS.gray[600], fontWeight: '600' },
  saveBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveTxt: { color: COLORS.white, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});

const cu = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], marginBottom: SPACING.xs },
  rowActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  avatar:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:    { fontWeight: '800', fontSize: FONTS.base },
  name:         { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900] },
  email:        { fontSize: FONTS.sm, color: COLORS.gray[400] },
  currentCompany: { fontSize: 11, color: COLORS.gray[400], marginTop: 2 },
  roleBadge:    { fontSize: 11, fontWeight: '700' },
  inCompany:    { fontSize: 11, color: COLORS.success, fontWeight: '700' },
  moveHint:     { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
});
