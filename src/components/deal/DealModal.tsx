import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView,
  TextInput, Dimensions, Platform, Clipboard, ToastAndroid, Linking, Image,
} from 'react-native';
import { useUIStore } from '../../stores/uiStore';
import { useDealStore } from '../../stores/dealStore';
import { useContactStore } from '../../stores/contactStore';
import { useFunnelStore } from '../../stores/funnelStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCustomFieldStore } from '../../stores/customFieldStore';
import { useCRMUserStore } from '../../stores/crmUserStore';
import { Deal, Contact, WinLossReason } from '../../types/models';
import { formatCurrency } from '../../utils/currency';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { WinCelebration } from './WinCelebration';
import { DealHistoryTab } from './tabs/DealHistoryTab';
import { DealTasksTab } from './tabs/DealTasksTab';
import { DealProductsTab } from './tabs/DealProductsTab';
import { DealFilesTab } from './tabs/DealFilesTab';
import { DealEmailTab } from './tabs/DealEmailTab';
import { DealProposalsTab } from './tabs/DealProposalsTab';

// ─── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'history' | 'tasks' | 'email' | 'products' | 'files' | 'proposals';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'history',   label: 'Histórico' },
  { key: 'tasks',     label: 'Tarefas' },
  { key: 'email',     label: 'E-mail' },
  { key: 'products',  label: 'Produtos' },
  { key: 'files',     label: 'Arquivos' },
  { key: 'proposals', label: 'Propostas' },
];

/** Retorna o número de dias inteiros decorridos desde a data informada (0 se vazia). */
function daysSince(d: string | null | undefined) {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

/** Extrai as iniciais (até 2 letras maiúsculas) de um nome para exibir no avatar. */
function avatarInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ─── InfoField ────────────────────────────────────────────────────────────────

/** Campo de exibição com edição inline: mostra o valor e, ao tocar, vira TextInput que salva via onSave. */
function InfoField({
  label, value, onSave, multiline,
}: { label: string; value: string; onSave?: (v: string) => void; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const save = () => {
    if (onSave && draft !== value) onSave(draft);
    setEditing(false);
  };

  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={[fi.input, multiline && fi.inputMulti]}
          value={draft}
          onChangeText={setDraft}
          onBlur={save}
          onSubmitEditing={multiline ? undefined : save}
          autoFocus
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      ) : (
        <Pressable onPress={onSave ? () => { setDraft(value); setEditing(true); } : undefined}>
          <Text style={[fi.value, !value && fi.empty]}>{value || '—'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.gray[400], textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 },
  value: { fontSize: FONTS.sm, color: COLORS.gray[800], fontWeight: '500', lineHeight: 19 },
  empty: { color: COLORS.gray[300], fontStyle: 'italic' },
  input: {
    fontSize: FONTS.sm, color: COLORS.gray[900], fontWeight: '500',
    borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingBottom: 2,
  },
  inputMulti: { height: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.sm, padding: SPACING.xs, borderBottomWidth: 1 },
  flyout: {
    position: 'absolute' as any, top: '100%' as any, left: 0, marginTop: 4,
    minWidth: 200, maxHeight: 240, backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 49, overflow: 'hidden' as any,
  },
  flyoutItem: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  flyoutItemActive: { backgroundColor: COLORS.primary + '0d' },
  flyoutItemTxt: { fontSize: FONTS.sm, color: COLORS.gray[700] },
  chip: { backgroundColor: COLORS.primary + '18', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 1 },
  chipTxt: { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '600' },
});

/** Converte uma string (JSON de array ou lista separada por vírgulas) em array de valores. */
function parseMultiValue(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Campo de seleção única: abre um flyout com as opções e salva a escolha via onSave. */
function SelectInfoField({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <View style={{ position: 'relative' as any, zIndex: 50 }}>
        <Pressable onPress={() => setOpen(!open)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[fi.value, !value && fi.empty]}>{value || '—'}</Text>
            <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{open ? '▲' : '▼'}</Text>
          </View>
        </Pressable>
        {open && (
          <>
            <Pressable style={{ position: 'fixed' as any, inset: 0, zIndex: 48 }} onPress={() => setOpen(false)} />
            <View style={fi.flyout}>
              {options.length === 0 && (
                <View style={fi.flyoutItem}><Text style={fi.flyoutItemTxt}>Sem opções</Text></View>
              )}
              {options.map((opt) => (
                <Pressable
                  key={opt}
                  style={[fi.flyoutItem, opt === value && fi.flyoutItemActive]}
                  onPress={() => { onSave(opt); setOpen(false); }}
                >
                  <Text style={[fi.flyoutItemTxt, opt === value && { color: COLORS.primary, fontWeight: '700' }]}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Campo de seleção múltipla: exibe chips dos selecionados e salva o array em JSON via onSave. */
function MultiSelectInfoField({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = parseMultiValue(value);
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onSave(JSON.stringify(next));
  };
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <View style={{ position: 'relative' as any, zIndex: 50 }}>
        <Pressable onPress={() => setOpen(!open)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {selected.length === 0 ? (
              <Text style={[fi.value, fi.empty]}>—</Text>
            ) : (
              selected.map((s) => (
                <View key={s} style={fi.chip}><Text style={fi.chipTxt}>{s}</Text></View>
              ))
            )}
            <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{open ? '▲' : '▼'}</Text>
          </View>
        </Pressable>
        {open && (
          <>
            <Pressable style={{ position: 'fixed' as any, inset: 0, zIndex: 48 }} onPress={() => setOpen(false)} />
            <View style={fi.flyout}>
              {options.length === 0 && (
                <View style={fi.flyoutItem}><Text style={fi.flyoutItemTxt}>Sem opções</Text></View>
              )}
              {options.map((opt) => {
                const isSel = selected.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    style={[fi.flyoutItem, isSel && fi.flyoutItemActive]}
                    onPress={() => toggle(opt)}
                  >
                    <Text style={[fi.flyoutItemTxt, isSel && { color: COLORS.primary, fontWeight: '700' }]}>
                      {isSel ? '✓ ' : '   '}{opt}
                    </Text>
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

// ─── CurrencyField ────────────────────────────────────────────────────────────

/** Formata um valor em centavos como moeda brasileira (R$). */
function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Extrai apenas os dígitos de uma string e os converte em valor inteiro de centavos. */
function parseCents(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return parseInt(digits || '0', 10);
}

/** Formata uma string de dígitos como "R$ 0,00" para exibição durante a digitação. */
function formatCentsDisplay(digits: string): string {
  const n = parseInt(digits || '0', 10);
  return 'R$ ' + (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Campo monetário com edição inline: exibe o valor formatado e salva em centavos via onSave. */
function CurrencyField({ label, valueCents, onSave }: { label: string; valueCents: number; onSave: (cents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [digits, setDigits] = useState('');

  const handleOpen = () => {
    setDigits(String(valueCents));
    setEditing(true);
  };

  const handleChange = (text: string) => {
    const raw = text.replace(/\D/g, '');
    setDigits(raw);
  };

  const handleSave = () => {
    onSave(parseCents(digits));
    setEditing(false);
  };

  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={fi.input}
          value={formatCentsDisplay(digits)}
          onChangeText={handleChange}
          onBlur={handleSave}
          onSubmitEditing={handleSave}
          keyboardType="numeric"
          autoFocus
          selectTextOnFocus
        />
      ) : (
        <Pressable onPress={handleOpen}>
          <Text style={[fi.value, valueCents === 0 && fi.empty]}>
            {valueCents > 0 ? formatBRL(valueCents) : '—'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── DealModal ────────────────────────────────────────────────────────────────

const WA_LOGO = { uri: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzI1RDM2NiIgZD0iTTEyIDBDNS4zNzMgMCAwIDUuMzczIDAgMTJjMCAyLjEyNC41NTggNC4xMDkgMS41MjkgNS44MzFMMCAyNGw2LjMzNS0xLjQ5OUExMS45MjYgMTEuOTI2IDAgMDAxMiAyNGM2LjYyNyAwIDEyLTUuMzczIDEyLTEyUzE4LjYyNyAwIDEyIDB6Ii8+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xNy40NzIgMTQuMzgyYy0uMjk3LS4xNDktMS43NTgtLjg2Ny0yLjAzLS45NjctLjI3My0uMDk5LS40NzEtLjE0OC0uNjcuMTUtLjE5Ny4yOTctLjc2Ny45NjYtLjk0IDEuMTY0LS4xNzMuMTk5LS4zNDcuMjIzLS42NDQuMDc1LS4yOTctLjE1LTEuMjU1LS40NjMtMi4zOS0xLjQ3NS0uODgzLS43ODgtMS40OC0xLjc2MS0xLjY1My0yLjA1OS0uMTczLS4yOTctLjAxOC0uNDU4LjEzLS42MDYuMTM0LS4xMzMuMjk4LS4zNDcuNDQ2LS41Mi4xNDktLjE3NC4xOTgtLjI5OC4yOTgtLjQ5Ny4wOTktLjE5OC4wNS0uMzcxLS4wMjUtLjUyLS4wNzUtLjE0OS0uNjY5LTEuNjEyLS45MTYtMi4yMDctLjI0Mi0uNTc5LS40ODctLjUtLjY2OS0uNTEtLjE3My0uMDA4LS4zNzEtLjAxLS41Ny0uMDEtLjE5OCAwLS41Mi4wNzQtLjc5Mi4zNzItLjI3Mi4yOTctMS4wNCAxLjAxNi0xLjA0IDIuNDc5IDAgMS40NjIgMS4wNjUgMi44NzUgMS4yMTMgMy4wNzQuMTQ5LjE5OCAyLjA5NiAzLjIgNS4wNzcgNC40ODcuNzA5LjMwNiAxLjI2Mi40ODkgMS42OTQuNjI1LjcxMi4yMjcgMS4zNi4xOTUgMS44NzEuMTE4LjU3MS0uMDg1IDEuNzU4LS43MTkgMi4wMDYtMS40MTMuMjQ4LS42OTQuMjQ4LTEuMjg5LjE3My0xLjQxMy0uMDc0LS4xMjQtLjI3Mi0uMTk4LS41Ny0uMzQ3eiIvPjwvc3ZnPgo=' };

/** Formata um número de telefone brasileiro (10 ou 11 dígitos) no padrão (DD) NNNNN-NNNN. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/** Copia um texto para a área de transferência (web via navigator, nativo via Clipboard). */
function copyToClipboard(value: string) {
  if (Platform.OS === 'web') {
    navigator.clipboard?.writeText(value).catch(() => {});
  } else {
    Clipboard.setString(value);
  }
}

/** Modal de detalhe da negociação: exibe contato, campos, responsável, etapas e abas (histórico, tarefas, e-mail, produtos, arquivos, propostas), permitindo editar, ganhar, perder, reabrir ou excluir o deal. */
export function DealModal() {
  const openDealId  = useUIStore((s) => s.openDealId);
  const closeDeal   = useUIStore((s) => s.closeDeal);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);

  const deals       = useDealStore((s) => s.deals);
  const updateDeal  = useDealStore((s) => s.updateDeal);
  const deleteDeal  = useDealStore((s) => s.deleteDeal);
  const moveDeal    = useDealStore((s) => s.moveDeal);

  const contacts         = useContactStore((s) => s.contacts);
  const funnels              = useFunnelStore((s) => s.funnels);
  const winLossReasons       = useFunnelStore((s) => s.winLossReasons) as WinLossReason[];
  const loadWinLossReasons   = useFunnelStore((s) => s.loadWinLossReasons);
  const { coolingThresholds, loadSettings } = useSettingsStore();
  const { fields, dealValues, loadFields, loadDealValues, saveDealValues } = useCustomFieldStore();
  const { users: crmUsers, loadUsers } = useCRMUserStore();

  const [localDeal,    setLocalDeal]    = useState<Deal | null>(null);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [activeTab,    setActiveTab]    = useState<TabKey>('history');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState('');
  const [lostModal,    setLostModal]    = useState(false);
  const [lostReason,   setLostReason]   = useState('');
  const [winVisible,   setWinVisible]   = useState(false);
  const [winTitle,     setWinTitle]     = useState('');

  const deal    = localDeal;
  const contact = deal ? contacts.find((c) => c.id === deal.contactId) : undefined;
  const funnel  = deal ? funnels.find((f) => f.id === deal.funnelId)   : undefined;
  const owner   = deal?.ownerId ? crmUsers.find((u) => u.id === deal.ownerId) : undefined;
  const ownerInitials = owner
    ? owner.displayName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '—';
  const stages  = funnel?.stages ?? [];
  const currIdx = deal ? stages.findIndex((s) => s.id === deal.stageId) : -1;
  const currStage = currIdx >= 0 ? stages[currIdx] : undefined;

  const { warningDays, dangerDays } = coolingThresholds;
  const coolingDays = deal ? daysSince(deal.stageChangedAt ?? deal.updatedAt) : 0;
  const isNew       = deal ? daysSince(deal.createdAt) < 7 : false;

  let coolingColor = '#16a34a', coolingBg = '#f0fdf4';
  if (coolingDays >= dangerDays)      { coolingColor = '#ef4444'; coolingBg = '#fef2f2'; }
  else if (coolingDays >= warningDays){ coolingColor = '#f59e0b'; coolingBg = '#fffbeb'; }

  const win    = Dimensions.get('window');
  const isWide = Platform.OS === 'web' && win.width >= 860;
  const mW     = isWide ? Math.min(1440, win.width  * 0.97) : win.width;
  const mH     = isWide ? Math.min(win.height * 0.94, 900)  : win.height;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!openDealId) { setLocalDeal(null); return; }
    const found = deals.find((d) => d.id === openDealId);
    if (found) {
      setLocalDeal(found);
      setTitleDraft(found.title);
      setActiveTab('history');
      setEditingTitle(false);
      setLostReason('');
    }
    loadSettings();
    loadFields();
    loadUsers();
    loadWinLossReasons();
  }, [openDealId]);

  useEffect(() => {
    if (!openDealId) return;
    const found = deals.find((d) => d.id === openDealId);
    if (found) setLocalDeal(found);
  }, [deals]);

  useEffect(() => {
    if (deal?.id) loadDealValues(deal.id);
  }, [deal?.id]);

  // ── Actions ────────────────────────────────────────────────────────────────
  // Aplica uma alteração parcial ao deal localmente e persiste via updateDeal.
  const patch = async (p: Partial<Deal>) => {
    if (!deal) return;
    setLocalDeal((prev) => prev ? { ...prev, ...p } : prev);
    await updateDeal(deal.id, p);
  };

  const isClosed = deal?.stage === 'closed_won' || deal?.stage === 'closed_lost';

  // Reabre um deal fechado, movendo-o para a primeira etapa ativa do funil (ou status 'qualification').
  const handleReopen = async () => {
    if (!deal) return;
    const firstActiveStage = funnel?.stages.find((st) => st.type === 'active' || !st.type);
    try {
      if (firstActiveStage) {
        await moveDeal(deal.id, 'qualification', 0, deal.contactId, firstActiveStage.id);
      } else {
        await updateDeal(deal.id, { stage: 'qualification' });
      }
    } catch { /* ignore */ }
  };

  // Marca o deal como ganho (etapa 'won') e exibe a animação de comemoração.
  const handleWon = async () => {
    if (!deal) return;
    // Find a 'won' stage; fall back to last stage in funnel or skip stage move
    const wonStage = funnel?.stages.find((st) => st.type === 'won');
    try {
      if (wonStage) {
        await moveDeal(deal.id, 'closed_won', 0, deal.contactId, wonStage.id);
      } else {
        // No explicit won stage — just update the deal status directly
        await patch({ stage: 'closed_won' as any });
      }
    } catch { /* ignore move errors — still show celebration */ }
    setWinTitle(deal.title);
    setWinVisible(true);
  };

  // Marca o deal como perdido (etapa 'lost'), grava o motivo informado e fecha o modal.
  const handleLost = async () => {
    if (!deal) return;
    const lostStage = funnel?.stages.find((st) => st.type === 'lost');
    try {
      if (lostStage) {
        await moveDeal(deal.id, 'closed_lost', 0, deal.contactId, lostStage.id);
      } else {
        await updateDeal(deal.id, { stage: 'closed_lost' });
      }
      if (lostReason) await patch({ closingReason: lostReason });
    } catch { /* ignore */ }
    setLostModal(false);
    closeDeal();
  };

  // Exclui o deal (com confirmação na web) e fecha o modal.
  const handleDelete = () => {
    if (!deal) return;
    const doIt = async () => { await deleteDeal(deal.id); closeDeal(); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Excluir "${deal.title}"?`)) doIt();
    } else {
      doIt();
    }
  };

  // Move o deal para a etapa tocada na barra de etapas (ignora se já estiver nela).
  const handleStagePress = (stageId: string, idx: number) => {
    if (!deal || stageId === deal.stageId) return;
    moveDeal(deal.id, deal.stage, idx, deal.contactId, stageId);
  };

  // Salva o título editado se foi alterado e não está vazio, e encerra a edição.
  const saveTitleDraft = () => {
    if (titleDraft.trim() && titleDraft !== deal?.title) patch({ title: titleDraft.trim() });
    setEditingTitle(false);
  };

  if (!openDealId) return null;

  const contactName = contact ? `${contact.firstName} ${contact.lastName}` : '?';
  const lostList    = winLossReasons.filter((r) => r.type === 'lost' && r.isActive);

  // ── Tab content ────────────────────────────────────────────────────────────
  // Renderiza o conteúdo da aba ativa (histórico, tarefas, produtos, arquivos, e-mail ou propostas).
  const tabContent = () => {
    if (!deal) return null;
    switch (activeTab) {
      case 'history':   return <DealHistoryTab dealId={deal.id} contactId={deal.contactId} />;
      case 'tasks':     return <DealTasksTab dealId={deal.id} />;
      case 'products':  return <DealProductsTab dealId={deal.id} />;
      case 'files':     return <DealFilesTab />;
      case 'email':     return <DealEmailTab contact={contact} />;
      case 'proposals': return <DealProposalsTab />;
    }
  };

  // ── Left panel ─────────────────────────────────────────────────────────────
  const leftPanel = deal ? (
    <ScrollView style={s.leftPanel} showsVerticalScrollIndicator={false} contentContainerStyle={s.leftContent}>

      {/* Contact card */}
      <View style={s.contactCard}>
        <View style={[s.avatar, { backgroundColor: COLORS.primary + '18' }]}>
          <Text style={s.avatarTxt}>{avatarInitials(contactName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.contactName} numberOfLines={1}>{contactName}</Text>
          {contact?.company  && <Text style={s.contactSub}  numberOfLines={1}>{contact.company}</Text>}
          {contact?.phone && (
            <View style={s.contactActionRow}>
              <Text style={s.contactMeta} numberOfLines={1}>📞  {formatPhone(contact.phone)}</Text>
              <Pressable
                style={s.actionBtn}
                onPress={() => { copyToClipboard(contact.phone!); setCopiedField('phone'); setTimeout(() => setCopiedField(null), 2000); }}
              >
                <Text style={s.actionBtnTxt}>{copiedField === 'phone' ? '✓' : '⧉'}</Text>
              </Pressable>
              <Pressable
                style={s.actionBtnWa}
                onPress={() => {
                  const digits = contact.phone!.replace(/\D/g, '');
                  const num = digits.startsWith('55') ? digits : `55${digits}`;
                  Linking.openURL(`https://wa.me/${num}`);
                }}
              >
                <Image source={WA_LOGO} style={{ width: 22, height: 22 }} />
              </Pressable>
            </View>
          )}
          {contact?.email && (
            <View style={s.contactActionRow}>
              <Text style={s.contactMeta} numberOfLines={1}>✉  {contact.email}</Text>
              <Pressable
                style={s.actionBtn}
                onPress={() => { copyToClipboard(contact.email!); setCopiedField('email'); setTimeout(() => setCopiedField(null), 2000); }}
              >
                <Text style={s.actionBtnTxt}>{copiedField === 'email' ? '✓' : '⧉'}</Text>
              </Pressable>
            </View>
          )}
          {contact?.jobTitle && <Text style={s.contactMeta} numberOfLines={1}>💼  {contact.jobTitle}</Text>}
        </View>
      </View>

      {/* Deal fields */}
      <View style={s.section}>
        <Text style={s.sectionHdr}>Negociação</Text>
        <CurrencyField
          label="Valor"
          valueCents={deal.value}
          onSave={(cents) => patch({ value: cents })}
        />
        <InfoField
          label="Previsão de fechamento"
          value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('pt-BR') : ''}
          onSave={(v) => patch({ expectedCloseDate: v || null })}
        />
        <InfoField
          label="Probabilidade"
          value={deal.probability != null ? `${deal.probability}%` : ''}
          onSave={(v) => {
            const n = parseInt(v.replace('%', ''), 10);
            if (!isNaN(n)) patch({ probability: Math.min(100, Math.max(0, n)) });
          }}
        />
        <InfoField
          label="Observações"
          value={deal.notes ?? ''}
          onSave={(v) => patch({ notes: v || null })}
          multiline
        />
      </View>

      {/* Custom fields */}
      {fields.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionHdr}>Campos personalizados</Text>
          {fields.map((f) => {
            const val = dealValues[f.id] ?? '';
            const onSave = (v: string) => saveDealValues(deal.id, [{ fieldId: f.id, value: v }]);
            if (f.fieldType === 'select') {
              return <SelectInfoField key={f.id} label={f.name} value={val} options={f.options ?? []} onSave={onSave} />;
            }
            if (f.fieldType === 'multiselect') {
              return <MultiSelectInfoField key={f.id} label={f.name} value={val} options={f.options ?? []} onSave={onSave} />;
            }
            return <InfoField key={f.id} label={f.name} value={val} onSave={onSave} />;
          })}
        </View>
      )}

      {/* Owner */}
      <View style={s.ownerSection}>
        <Text style={s.sectionHdr}>Responsável</Text>
        <View style={s.ownerAnchor}>
          <Pressable style={s.ownerRow} onPress={() => setShowOwnerPicker((v) => !v)}>
            <View style={[s.ownerAvatar, { backgroundColor: owner ? COLORS.primary + '22' : COLORS.gray[100] }]}>
              <Text style={s.ownerAvatarTxt}>{ownerInitials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.ownerName} numberOfLines={1}>{owner?.displayName ?? 'Não atribuído'}</Text>
              {owner?.email && <Text style={s.ownerEmail} numberOfLines={1}>{owner.email}</Text>}
            </View>
            <Text style={s.ownerChevron}>{showOwnerPicker ? '▲' : '▼'}</Text>
          </Pressable>

          {showOwnerPicker && (
            <>
              <Pressable style={s.ownerBackdrop} onPress={() => setShowOwnerPicker(false)} />
              <View style={s.ownerFlyout}>
                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {crmUsers.filter((u) => u.isActive !== false).map((u) => {
                    const isSelected = u.id === deal?.ownerId;
                    const initials = u.displayName.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                    return (
                      <Pressable
                        key={u.id}
                        style={[s.ownerPickerItem, isSelected && s.ownerPickerItemActive]}
                        onPress={async () => { await patch({ ownerId: u.id }); setShowOwnerPicker(false); }}
                      >
                        <View style={[s.ownerPickerAvatar, { backgroundColor: isSelected ? COLORS.primary : COLORS.gray[200] }]}>
                          <Text style={[s.ownerPickerInitials, { color: isSelected ? COLORS.white : COLORS.gray[700] }]}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.ownerPickerName, isSelected && { color: COLORS.primary, fontWeight: '700' }]}>{u.displayName}</Text>
                          <Text style={s.ownerPickerEmail} numberOfLines={1}>{u.email}</Text>
                        </View>
                        {isSelected && <Text style={{ color: COLORS.primary, fontSize: 16 }}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  ) : null;

  // ── Right panel ────────────────────────────────────────────────────────────
  const tabBar = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarInner}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.key}
          style={[s.tab, activeTab === tab.key && s.tabActive]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Text style={[s.tabTxt, activeTab === tab.key && s.tabTxtActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Modal visible={!!openDealId} transparent animationType="fade" onRequestClose={closeDeal}>
        <Pressable style={s.overlay} onPress={closeDeal}>
          <Pressable
            style={[s.modal, { width: mW, height: mH, borderRadius: isWide ? 16 : 0 }]}
            onPress={() => {/* stop propagation */}}
          >

            {/* ── Header ─────────────────────────────────────────────────── */}
            {deal && (
              <View style={s.header}>
                <Pressable style={s.closeBtn} onPress={closeDeal}>
                  <Text style={s.closeTxt}>✕</Text>
                </Pressable>

                <View style={s.headerMid}>
                  {editingTitle ? (
                    <TextInput
                      style={s.titleInput}
                      value={titleDraft}
                      onChangeText={setTitleDraft}
                      onBlur={saveTitleDraft}
                      onSubmitEditing={saveTitleDraft}
                      autoFocus
                    />
                  ) : (
                    <Pressable onPress={() => { setTitleDraft(deal.title); setEditingTitle(true); }}>
                      <Text style={s.title} numberOfLines={1}>{deal.title}</Text>
                    </Pressable>
                  )}
                  {currStage && (
                    <View style={[s.stagePill, { backgroundColor: currStage.color + '20' }]}>
                      <View style={[s.stagePillDot, { backgroundColor: currStage.color }]} />
                      <Text style={[s.stagePillTxt, { color: currStage.color }]}>{currStage.name}</Text>
                    </View>
                  )}
                </View>

                <View style={s.headerRight}>
                  {isWide && (
                    <Text style={s.headerValue}>{formatCurrency(deal.value)}</Text>
                  )}
                  {isClosed ? (
                    <Pressable style={s.reopenBtn} onPress={handleReopen}>
                      <Text style={s.reopenTxt}>↩ Retomar</Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable style={s.wonBtn} onPress={handleWon}>
                        <Text style={s.wonTxt}>✓ Ganhar</Text>
                      </Pressable>
                      <Pressable style={s.lostBtn} onPress={() => { setLostReason(''); setLostModal(true); }}>
                        <Text style={s.lostTxt}>✕ Perder</Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable style={s.delBtn} onPress={handleDelete}>
                    <Text style={{ fontSize: 14 }}>🗑</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Tags row ───────────────────────────────────────────────── */}
            {deal && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.tagsRow}
                contentContainerStyle={s.tagsContent}
              >
                {!isWide && (
                  <View style={[s.badge, { backgroundColor: COLORS.primary + '15' }]}>
                    <Text style={[s.badgeTxt, { color: COLORS.primary, fontWeight: '800' }]}>{formatCurrency(deal.value)}</Text>
                  </View>
                )}
                {isNew && (
                  <View style={[s.badge, { backgroundColor: '#dbeafe' }]}>
                    <Text style={[s.badgeTxt, { color: '#2563eb' }]}>✦ NOVA</Text>
                  </View>
                )}
                {funnel && (
                  <View style={[s.badge, { backgroundColor: COLORS.gray[100] }]}>
                    <Text style={[s.badgeTxt, { color: COLORS.gray[600] }]}>{funnel.name}</Text>
                  </View>
                )}
                <View style={[s.badge, { backgroundColor: coolingBg }]}>
                  <Text style={[s.badgeTxt, { color: coolingColor }]}>
                    {coolingDays === 0 ? '● Hoje' : `⏱ ${coolingDays}d sem movimentação`}
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* ── Stage bar ──────────────────────────────────────────────── */}
            {deal && stages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.stageBar}
                contentContainerStyle={s.stageBarContent}
              >
                {stages.map((stage, idx) => {
                  const isCurr = stage.id === deal.stageId;
                  const isPast = idx < currIdx;
                  return (
                    <React.Fragment key={stage.id}>
                      <Pressable
                        style={[
                          s.stageStep,
                          isPast && s.stageStepPast,
                          isCurr && { backgroundColor: stage.color, borderColor: stage.color },
                        ]}
                        onPress={() => handleStagePress(stage.id, idx)}
                      >
                        <Text
                          style={[
                            s.stageStepTxt,
                            isPast  && s.stageStepTxtPast,
                            isCurr && s.stageStepTxtCurr,
                          ]}
                          numberOfLines={1}
                        >
                          {stage.type === 'won' ? '✓ ' : stage.type === 'lost' ? '✕ ' : ''}
                          {stage.name}
                        </Text>
                      </Pressable>
                      {idx < stages.length - 1 && (
                        <View style={[s.stageLine, (isPast || isCurr) && { backgroundColor: stage.color }]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Body ───────────────────────────────────────────────────── */}
            {isWide ? (
              <View style={s.body}>
                {leftPanel}
                <View style={s.bodyDivider} />
                <View style={s.rightPanel}>
                  {tabBar}
                  <View style={s.tabContent}>{tabContent()}</View>
                </View>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                {leftPanel}
                <View style={{ borderTopWidth: 1, borderTopColor: COLORS.gray[100] }}>
                  {tabBar}
                  <View style={{ minHeight: 420 }}>{tabContent()}</View>
                </View>
              </ScrollView>
            )}
            {/* ── Win celebration overlay ──────────────────────────────── */}
            <WinCelebration
              visible={winVisible}
              dealTitle={winTitle}
              onDone={() => { setWinVisible(false); closeDeal(); }}
            />
          </Pressable>
        </Pressable>
      </Modal>


      {/* ── Lost reason modal ───────────────────────────────────────────── */}
      <Modal visible={lostModal} transparent animationType="fade" onRequestClose={() => setLostModal(false)}>
        <View style={s.lostOverlay}>
          <View style={s.lostBox}>
            <Text style={s.lostTitle}>Motivo da perda</Text>
            {lostList.length > 0 && (
              <ScrollView style={{ maxHeight: 160, marginBottom: SPACING.sm }}>
                {lostList.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[s.reasonOpt, lostReason === r.label && s.reasonOptActive]}
                    onPress={() => setLostReason(lostReason === r.label ? '' : r.label)}
                  >
                    <Text style={[s.reasonTxt, lostReason === r.label && { color: '#ef4444', fontWeight: '700' }]}>{r.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <TextInput
              style={s.lostInput}
              placeholder="Escreva o motivo..."
              placeholderTextColor={COLORS.gray[400]}
              value={lostReason}
              onChangeText={setLostReason}
              multiline
              numberOfLines={3}
            />
            <View style={s.lostActions}>
              <Pressable style={s.lostCancel} onPress={() => setLostModal(false)}>
                <Text style={s.lostCancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.lostConfirm} onPress={handleLost}>
                <Text style={s.lostConfirmTxt}>Confirmar perda</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Overlay & container
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center', alignItems: 'center',
  },
  modal: {
    backgroundColor: COLORS.white, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.28, shadowRadius: 48, elevation: 24,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
    gap: SPACING.sm, backgroundColor: COLORS.white,
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 12, color: COLORS.gray[600], fontWeight: '700' },
  headerMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, overflow: 'hidden', minWidth: 0 },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900] },
  titleInput: {
    fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900],
    borderBottomWidth: 2, borderBottomColor: COLORS.primary, minWidth: 180,
  },
  stagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  stagePillDot: { width: 6, height: 6, borderRadius: 3 },
  stagePillTxt: { fontSize: 11, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  headerValue: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.primary, marginRight: SPACING.xs },
  wonBtn: {
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderRadius: RADIUS.md, backgroundColor: '#16a34a',
  },
  wonTxt: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  lostBtn: {
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: '#ef4444',
  },
  lostTxt: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  reopenBtn: {
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderRadius: RADIUS.md, backgroundColor: COLORS.gray[200],
  },
  reopenTxt: { color: COLORS.gray[700], fontSize: 12, fontWeight: '700' },
  delBtn: {
    width: 28, height: 28, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.gray[200],
    alignItems: 'center', justifyContent: 'center',
  },

  // Tags
  tagsRow: {
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
    backgroundColor: COLORS.gray[50], maxHeight: 38,
  },
  tagsContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: 6, gap: SPACING.xs,
  },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeTxt: { fontSize: 11, fontWeight: '700' },

  // Stage bar
  stageBar: {
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
    backgroundColor: COLORS.white, maxHeight: 42,
  },
  stageBarContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs,
  },
  stageStep: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  stageStepPast:    { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  stageStepTxt:     { fontSize: 11, fontWeight: '600', color: COLORS.gray[400] },
  stageStepTxtPast: { color: '#2563eb' },
  stageStepTxtCurr: { color: COLORS.white },
  stageLine:        { width: 14, height: 2, backgroundColor: COLORS.gray[200] },

  // Body layout
  body:        { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  bodyDivider: { width: 1, backgroundColor: COLORS.gray[100] },
  leftPanel:   { width: 270, flexGrow: 0, flexShrink: 0, backgroundColor: COLORS.white },
  leftContent: { paddingBottom: 48 },
  rightPanel:  { flex: 1, backgroundColor: COLORS.white },

  // Contact card
  contactCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    paddingLeft: SPACING.sm, paddingRight: SPACING.sm,
    paddingTop: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:   { fontSize: FONTS.base, fontWeight: '800', color: COLORS.primary },
  contactName: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[900], marginBottom: 1 },
  contactSub:  { fontSize: FONTS.xs, color: COLORS.gray[500], marginBottom: 1 },
  contactMeta: { fontSize: FONTS.xs, color: COLORS.gray[500], marginTop: 1, flex: 1 },
  contactActionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  actionBtn: { width: 22, height: 22, borderRadius: 5, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  actionBtnTxt: { fontSize: 11, color: COLORS.gray[600], fontWeight: '700' },
  actionBtnWa: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden' as any },

  // Left panel sections
  section:    { paddingLeft: SPACING.sm, paddingRight: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  sectionHdr: {
    fontSize: 10, fontWeight: '700', color: COLORS.gray[400],
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: SPACING.md,
  },

  // Tab bar
  tabBar:      { borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], backgroundColor: COLORS.white, maxHeight: 44 },
  tabBarInner: { flexDirection: 'row', paddingHorizontal: SPACING.md },
  tab:         { paddingHorizontal: SPACING.md, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 2 },
  tabActive:   { borderBottomColor: COLORS.primary },
  tabTxt:      { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[400] },
  tabTxtActive:{ color: COLORS.primary },
  tabContent:  { flex: 1 },

  // Lost modal
  lostOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  lostBox:     { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 380, maxWidth: '92%' as unknown as number },
  lostTitle:   { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.md },
  reasonOpt:   { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.gray[200], marginBottom: SPACING.xs },
  reasonOptActive: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  reasonTxt:   { fontSize: FONTS.sm, color: COLORS.gray[700] },
  lostInput:   {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONTS.sm, color: COLORS.gray[900],
    height: 80, textAlignVertical: 'top',
  },
  lostActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  lostCancel:  { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' },
  lostCancelTxt: { color: COLORS.gray[600], fontWeight: '600', fontSize: FONTS.sm },
  lostConfirm: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: '#ef4444', alignItems: 'center' },
  lostConfirmTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },

  // Owner section
  ownerSection: {
    borderTopWidth: 1, borderTopColor: COLORS.gray[100],
    paddingLeft: SPACING.sm, paddingRight: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.lg,
  },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  ownerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  ownerAvatarTxt: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  ownerName: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[900] },
  ownerEmail: { fontSize: 11, color: COLORS.gray[400], marginTop: 1 },
  ownerAnchor:  { position: 'relative' as any, zIndex: 20 },
  ownerChevron: { fontSize: 10, color: COLORS.gray[400], paddingLeft: SPACING.xs },
  ownerBackdrop:{ position: 'fixed' as any, inset: 0, zIndex: 18 },
  ownerFlyout:  { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], zIndex: 19, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8, overflow: 'hidden' as any },
  ownerEditBtn: {
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200],
    backgroundColor: COLORS.gray[50],
  },
  ownerEditTxt: { fontSize: 11, fontWeight: '600', color: COLORS.gray[600] },

  // Owner picker
  ownerPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100],
    marginBottom: SPACING.xs,
  },
  ownerPickerItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  ownerPickerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  ownerPickerInitials: { fontSize: 13, fontWeight: '700' },
  ownerPickerName: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[900] },
  ownerPickerEmail: { fontSize: 11, color: COLORS.gray[400], marginTop: 1 },
});
