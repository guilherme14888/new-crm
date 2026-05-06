import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Modal, ScrollView, Platform,
} from 'react-native';
import { useDealStore } from '../../stores/dealStore';
import { useContactStore } from '../../stores/contactStore';
import { useFunnelStore } from '../../stores/funnelStore';
import { useAuthStore } from '../../stores/authStore';
import { useCompanyStore } from '../../stores/companyStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
import { parseCurrencyInput } from '../../utils/currency';
import { DEFAULT_FUNNEL_ID } from '../../db/schema';

// ─── Contact picker ───────────────────────────────────────────────────────────
interface NewContactForm {
  firstName: string; lastName: string; email: string; phone: string; company: string;
}

function ContactPicker({
  contacts, selectedId, onSelect, onCreateContact,
}: {
  contacts: ReturnType<typeof useContactStore.getState>['contacts'];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateContact: (form: NewContactForm) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewContactForm>({ firstName: '', lastName: '', email: '', phone: '', company: '' });
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const handleCreate = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    setCreating(true);
    await onCreateContact(form);
    setCreating(false);
    setShowCreate(false);
    setForm({ firstName: '', lastName: '', email: '', phone: '', company: '' });
  };

  const selected = contacts.find((c) => c.id === selectedId);

  return (
    <View>
      {selected ? (
        <View style={cp.selectedRow}>
          <View style={cp.avatar}><Text style={cp.avatarText}>{selected.firstName[0].toUpperCase()}</Text></View>
          <View style={cp.selectedInfo}>
            <Text style={cp.selectedName}>{selected.firstName} {selected.lastName}</Text>
            {selected.company && <Text style={cp.selectedSub}>{selected.company}</Text>}
          </View>
          <Pressable onPress={() => onSelect('')} style={cp.clearBtn}><Text style={cp.clearTxt}>✕</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={cp.searchRow}>
            <TextInput style={cp.search} placeholder="Buscar órgão..." value={search} onChangeText={setSearch} />
            <Pressable style={cp.createBtn} onPress={() => setShowCreate(true)}>
              <Text style={cp.createBtnTxt}>+ Novo</Text>
            </Pressable>
          </View>
          <View style={cp.list}>
            {filtered.length === 0 && (
              <Text style={cp.empty}>{contacts.length === 0 ? 'Nenhum órgão. Crie um abaixo.' : `Nenhum resultado para "${search}"`}</Text>
            )}
            {filtered.map((c) => (
              <Pressable key={c.id} style={cp.item} onPress={() => onSelect(c.id)}>
                <View style={cp.itemAvatar}><Text style={cp.itemAvatarTxt}>{c.firstName[0].toUpperCase()}</Text></View>
                <View style={cp.itemInfo}>
                  <Text style={cp.itemName}>{c.firstName} {c.lastName}</Text>
                  {(c.company || c.email) && <Text style={cp.itemSub}>{c.company || c.email}</Text>}
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Nested modal for quick contact creation */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={cp.overlay}>
          <Pressable style={cp.overlayBg} onPress={() => setShowCreate(false)} />
          <View style={cp.modal}>
            <Text style={cp.modalTitle}>Novo Órgão</Text>
            <View style={cp.row}>
              <View style={{ flex: 1 }}>
                <Text style={cp.label}>Nome *</Text>
                <TextInput style={cp.input} value={form.firstName} onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))} autoFocus />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cp.label}>Sobrenome *</Text>
                <TextInput style={cp.input} value={form.lastName} onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))} />
              </View>
            </View>
            <Text style={cp.label}>E-mail</Text>
            <TextInput style={cp.input} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
            <Text style={cp.label}>Telefone</Text>
            <TextInput style={cp.input} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <Text style={cp.label}>Empresa</Text>
            <TextInput style={cp.input} value={form.company} onChangeText={(v) => setForm((f) => ({ ...f, company: v }))} />
            <View style={cp.modalActions}>
              <Pressable style={cp.cancelBtn} onPress={() => setShowCreate(false)}><Text style={cp.cancelTxt}>Cancelar</Text></Pressable>
              <Pressable
                style={[cp.confirmBtn, (!form.firstName.trim() || !form.lastName.trim() || creating) && cp.disabledBtn]}
                onPress={handleCreate}
              >
                <Text style={cp.confirmTxt}>{creating ? 'Criando...' : 'Criar Órgão'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const cp = StyleSheet.create({
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary + '10', borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.primary + '30', marginBottom: SPACING.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
  selectedInfo: { flex: 1 },
  selectedName: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900] },
  selectedSub: { fontSize: FONTS.sm, color: COLORS.gray[500] },
  clearBtn: { padding: SPACING.xs },
  clearTxt: { color: COLORS.gray[400], fontSize: 16 },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  search: { flex: 1, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'web' ? SPACING.sm : 10, fontSize: FONTS.base, backgroundColor: COLORS.white },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, justifyContent: 'center' },
  createBtnTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
  list: { maxHeight: 160, borderWidth: 1, borderColor: COLORS.gray[100], borderRadius: RADIUS.md, overflow: 'hidden' as any },
  empty: { color: COLORS.gray[400], fontSize: FONTS.sm, padding: SPACING.md, textAlign: 'center' as any },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50], backgroundColor: COLORS.white },
  itemAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gray[200], alignItems: 'center', justifyContent: 'center' },
  itemAvatarTxt: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[600] },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FONTS.base, fontWeight: '500', color: COLORS.gray[900] },
  itemSub: { fontSize: FONTS.sm, color: COLORS.gray[400] },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayBg: { position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 480, maxWidth: '95%' as any, zIndex: 1 },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.lg },
  row: { flexDirection: 'row', gap: SPACING.md },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  input: { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], marginBottom: SPACING.md, backgroundColor: COLORS.white },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end', marginTop: SPACING.xs },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt: { color: COLORS.gray[600], fontWeight: '600' },
  confirmBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmTxt: { color: COLORS.white, fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
});

// ─── New Deal Modal ───────────────────────────────────────────────────────────
// ─── Reusable dropdown select ─────────────────────────────────────────────────
function DropdownSelect({ label, items, selectedId, onSelect, placeholder }: {
  label: string;
  items: { id: string; name: string; color?: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === selectedId);

  return (
    <View style={{ marginBottom: SPACING.md, zIndex: open ? 50 : 1 }}>
      <Text style={ds.label}>{label}</Text>
      <Pressable style={ds.trigger} onPress={() => setOpen(!open)}>
        {selected?.color && <View style={[ds.dot, { backgroundColor: selected.color }]} />}
        <Text style={[ds.triggerTxt, !selected && { color: COLORS.gray[300] }]} numberOfLines={1}>
          {selected?.name ?? (placeholder || 'Selecionar...')}
        </Text>
        <Text style={ds.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <>
          <Pressable style={ds.backdrop} onPress={() => setOpen(false)} />
          <View style={ds.flyout}>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {items.map((item) => {
                const active = item.id === selectedId;
                return (
                  <Pressable
                    key={item.id}
                    style={[ds.item, active && ds.itemActive]}
                    onPress={() => { onSelect(item.id); setOpen(false); }}
                  >
                    {item.color && <View style={[ds.dot, { backgroundColor: item.color }]} />}
                    <Text style={[ds.itemTxt, active && ds.itemTxtActive]}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}
const ds = StyleSheet.create({
  label:        { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: 4 },
  trigger:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.white },
  triggerTxt:   { flex: 1, fontSize: FONTS.base, color: COLORS.gray[900], fontWeight: '500' },
  chevron:      { fontSize: 12, color: COLORS.gray[400] },
  dot:          { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  backdrop:     { position: 'fixed' as any, inset: 0, zIndex: 48 },
  flyout:       { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, marginTop: 4, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray[100], shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 99, overflow: 'hidden' as any },
  item:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50] },
  itemActive:   { backgroundColor: '#f0f4ff' },
  itemTxt:      { fontSize: FONTS.base, color: COLORS.gray[800], fontWeight: '600' },
  itemTxtActive:{ color: '#1e3a5f', fontWeight: '700' },
});

export function NewDealModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const createDeal    = useDealStore((s) => s.createDeal);
  const activeFunnelId = useFunnelStore((s) => s.activeFunnelId);
  const funnels       = useFunnelStore((s) => s.funnels);
  const contacts      = useContactStore((s) => s.contacts);
  const createContact = useContactStore((s) => s.createContact);
  const currentUser   = useAuthStore((s) => s.user);
  const { companies, loadCompanies } = useCompanyStore();
  const isMaster = currentUser?.companyId === MASTER_COMPANY_ID;

  React.useEffect(() => { if (isMaster) loadCompanies(); }, [isMaster]);

  const defaultFunnelId = activeFunnelId ?? funnels[0]?.id ?? '';

  const [title, setTitle]               = useState('');
  const [valueInput, setValueInput]     = useState('');
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>(defaultFunnelId);
  const [stageId, setStageId]           = useState<string>('');
  const [contactId, setContactId]       = useState('');
  const [notes, setNotes]               = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});

  const funnel = useMemo(
    () => funnels.find((f) => f.id === selectedFunnelId) ?? funnels[0],
    [funnels, selectedFunnelId]
  );
  const activeStages = useMemo(() => (funnel?.stages ?? []).filter((s) => s.type === 'active'), [funnel]);

  React.useEffect(() => {
    if (visible) {
      const initFunnelId = activeFunnelId ?? funnels[0]?.id ?? '';
      const initFunnel = funnels.find((f) => f.id === initFunnelId) ?? funnels[0];
      const initStage = (initFunnel?.stages ?? []).filter((s) => s.type === 'active')[0];
      setTitle(''); setValueInput(''); setContactId(''); setNotes(''); setSelectedCompanyId(''); setErrors({});
      setSelectedFunnelId(initFunnelId);
      setStageId(initStage?.id ?? '');
    }
  }, [visible]);

  // When funnel changes, reset stage to first active stage of new funnel
  const handleFunnelChange = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    const newFunnel = funnels.find((f) => f.id === funnelId);
    const firstActive = (newFunnel?.stages ?? []).filter((s) => s.type === 'active')[0];
    setStageId(firstActive?.id ?? '');
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Título é obrigatório';
    if (!contactId)    e.contact = 'Selecione ou crie um órgão';
    return e;
  };

  const handleCreateContact = async (form: NewContactForm) => {
    const contact = await createContact({
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      company: form.company.trim() || null, type: 'lead',
      jobTitle: null, avatarUrl: null, tags: [], notes: null,
    });
    setContactId(contact.id);
  };

  const handleCreate = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const selectedStage = funnel?.stages.find((s) => s.id === stageId);
      await createDeal({
        funnelId: funnel?.id ?? DEFAULT_FUNNEL_ID,
        stageId, stage: 'qualification', contactId, ownerId: null,
        title: title.trim(),
        value: parseCurrencyInput(valueInput),
        currency: 'BRL',
        probability: selectedStage?.probability ?? 10,
        expectedCloseDate: null,
        closingReason: null,
        notes: notes.trim() || null,
        ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
      } as any);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.overlayBg} onPress={onClose} />
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Nova Negociação</Text>
            <Pressable style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Title */}
            <Text style={s.label}>Título *</Text>
            {errors.title && <Text style={s.error}>{errors.title}</Text>}
            <TextInput
              style={[s.input, !!errors.title && s.inputError]}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Proposta para Empresa X"
              autoFocus
            />

            {/* Value */}
            <Text style={s.label}>Valor</Text>
            <TextInput
              style={s.input}
              value={valueInput}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '');
                if (!digits) { setValueInput(''); return; }
                const cents = parseInt(digits, 10);
                setValueInput((cents / 100).toLocaleString('pt-BR', {
                  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
                }));
              }}
              keyboardType="numeric"
              placeholder="R$ 0,00"
            />

            {/* Funnel dropdown */}
            {funnels.length > 1 && (
              <DropdownSelect
                label="Funil de vendas"
                items={funnels.map((f) => ({ id: f.id, name: f.name }))}
                selectedId={selectedFunnelId}
                onSelect={handleFunnelChange}
                placeholder="Selecionar funil..."
              />
            )}

            {/* Stage dropdown */}
            {activeStages.length > 0 && (
              <DropdownSelect
                label="Etapa inicial"
                items={activeStages.map((st) => ({ id: st.id, name: st.name, color: st.color }))}
                selectedId={stageId}
                onSelect={setStageId}
                placeholder="Selecionar etapa..."
              />
            )}

            {/* Notes */}
            <Text style={s.label}>Observações</Text>
            <TextInput style={[s.input, s.textarea]} value={notes} onChangeText={setNotes} placeholder="Opcional..." multiline numberOfLines={3} />

            {/* Company dropdown — only for master/Default company */}
            {isMaster && companies.length > 0 && (
              <DropdownSelect
                label="Empresa"
                items={companies.map((c) => ({ id: c.id, name: c.name }))}
                selectedId={selectedCompanyId}
                onSelect={setSelectedCompanyId}
                placeholder="Selecionar empresa..."
              />
            )}

            {/* Contact */}
            <Text style={[s.label, { marginTop: SPACING.xs }]}>Órgão *</Text>
            {errors.contact && <Text style={s.error}>{errors.contact}</Text>}
            <ContactPicker
              contacts={contacts}
              selectedId={contactId}
              onSelect={setContactId}
              onCreateContact={handleCreateContact}
            />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </Pressable>
            <Pressable style={[s.createBtn, loading && s.createBtnDisabled]} onPress={handleCreate} disabled={loading}>
              <Text style={s.createTxt}>{loading ? 'Criando...' : 'Criar Negociação'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayBg:  { position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, width: 560, maxWidth: '95%' as any, maxHeight: '90%' as any, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 16, overflow: 'hidden' as any, zIndex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900], flex: 1 },
  closeBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { fontSize: 13, color: COLORS.gray[500] },

  body:        { maxHeight: 520 },
  bodyContent: { padding: SPACING.lg, paddingBottom: SPACING.sm },

  label:    { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: 4 },
  error:    { fontSize: FONTS.sm, color: COLORS.danger, marginBottom: SPACING.xs },
  input:    { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white, marginBottom: SPACING.md },
  inputError:{ borderColor: COLORS.danger },
  textarea:  { minHeight: 72, textAlignVertical: 'top' as any },
  row:       { flexDirection: 'row', gap: SPACING.md },

  stageRow:     { flexDirection: 'row', gap: SPACING.sm, paddingBottom: SPACING.xs },
  stagePill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.gray[200], backgroundColor: COLORS.white },
  stagePillActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stageDot:         { width: 8, height: 8, borderRadius: 4 },
  stagePillTxt:     { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[600] },
  stagePillTxtActive: { color: COLORS.white },

  footer:          { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  cancelBtn:       { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:       { color: COLORS.gray[600], fontWeight: '600', fontSize: FONTS.base },
  createBtn:       { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  createBtnDisabled:{ opacity: 0.6 },
  createTxt:       { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
});
