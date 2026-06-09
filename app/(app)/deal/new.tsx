import React, { useState, useMemo } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TextInput, Pressable, Modal, Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useDealStore } from '../../../src/stores/dealStore';
import { useContactStore } from '../../../src/stores/contactStore';
import { useFunnelStore } from '../../../src/stores/funnelStore';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { FunnelStage } from '../../../src/types/models';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { parseCurrencyInput } from '../../../src/utils/currency';
import { DEFAULT_FUNNEL_ID } from '../../../src/db/schema';

// ─── Inline contact creation ──────────────────────────────────────────────────
interface NewContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
}

/** Seletor de órgão/contato com busca, lista filtrada e modal de criação inline de novo contato. */
function ContactPicker({
  contacts,
  selectedId,
  onSelect,
  onCreateContact,
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
    return contacts.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  /** Valida nome/sobrenome, dispara a criação do contato e fecha/limpa o modal. */
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
      {/* Selected contact preview */}
      {selected && (
        <View style={cp.selectedRow}>
          <View style={cp.avatar}>
            <Text style={cp.avatarText}>{selected.firstName[0].toUpperCase()}</Text>
          </View>
          <View style={cp.selectedInfo}>
            <Text style={cp.selectedName}>{selected.firstName} {selected.lastName}</Text>
            {selected.company && <Text style={cp.selectedSub}>{selected.company}</Text>}
          </View>
          <Pressable onPress={() => onSelect('')} style={cp.clearBtn}>
            <Text style={cp.clearTxt}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Search + create */}
      {!selected && (
        <>
          <View style={cp.searchRow}>
            <TextInput
              style={cp.search}
              placeholder="Buscar órgão..."
              value={search}
              onChangeText={setSearch}
            />
            <Pressable style={cp.createBtn} onPress={() => setShowCreate(true)}>
              <Text style={cp.createBtnTxt}>+ Novo</Text>
            </Pressable>
          </View>

          <View style={cp.list}>
            {filtered.length === 0 && (
              <Text style={cp.empty}>
                {contacts.length === 0
                  ? 'Nenhum órgão. Crie um abaixo.'
                  : 'Nenhum resultado para "' + search + '"'}
              </Text>
            )}
            {filtered.map((c) => (
              <Pressable key={c.id} style={cp.item} onPress={() => onSelect(c.id)}>
                <View style={cp.itemAvatar}>
                  <Text style={cp.itemAvatarTxt}>{c.firstName[0].toUpperCase()}</Text>
                </View>
                <View style={cp.itemInfo}>
                  <Text style={cp.itemName}>{c.firstName} {c.lastName}</Text>
                  {(c.company || c.email) && (
                    <Text style={cp.itemSub}>{c.company || c.email}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Create contact modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={cp.overlay}>
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
              <Pressable style={cp.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={cp.cancelTxt}>Cancelar</Text>
              </Pressable>
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
  selectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10', borderRadius: RADIUS.md,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.primary + '30',
    marginBottom: SPACING.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
  selectedInfo: { flex: 1 },
  selectedName: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900] },
  selectedSub: { fontSize: FONTS.sm, color: COLORS.gray[500] },
  clearBtn: { padding: SPACING.xs },
  clearTxt: { color: COLORS.gray[400], fontSize: 16 },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  search: {
    flex: 1, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'web' ? SPACING.sm : 10,
    fontSize: FONTS.base, backgroundColor: COLORS.white,
  },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, justifyContent: 'center' },
  createBtnTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
  list: { maxHeight: 200, borderWidth: 1, borderColor: COLORS.gray[100], borderRadius: RADIUS.md, overflow: 'hidden' },
  empty: { color: COLORS.gray[400], fontSize: FONTS.sm, padding: SPACING.md, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[50], backgroundColor: COLORS.white },
  itemAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gray[200], alignItems: 'center', justifyContent: 'center' },
  itemAvatarTxt: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[600] },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FONTS.base, fontWeight: '500', color: COLORS.gray[900] },
  itemSub: { fontSize: FONTS.sm, color: COLORS.gray[400] },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 480, maxWidth: '95%' as unknown as number },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.lg },
  row: { flexDirection: 'row', gap: SPACING.md },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.base, color: COLORS.gray[900], marginBottom: SPACING.md, backgroundColor: COLORS.white,
  },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end', marginTop: SPACING.xs },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt: { color: COLORS.gray[600], fontWeight: '600' },
  confirmBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmTxt: { color: COLORS.white, fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
});

// ─── Main screen ───────────────────────────────────────────────────────────────
/** Tela de criação de nova negociação: formulário com título, valor, etapa, observações e seleção de órgão. */
export default function NewDealScreen() {
  const createDeal = useDealStore((s) => s.createDeal);
  const activeFunnelId = useFunnelStore((s) => s.activeFunnelId);
  const funnels = useFunnelStore((s) => s.funnels);
  const contacts = useContactStore((s) => s.contacts);
  const createContact = useContactStore((s) => s.createContact);

  const funnel = useMemo(() => funnels.find((f) => f.id === activeFunnelId) ?? funnels[0], [funnels, activeFunnelId]);
  const activeStages = useMemo(
    () => (funnel?.stages ?? []).filter((s) => s.type === 'active'),
    [funnel]
  );
  const firstStage = activeStages[0];

  const [title, setTitle] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [stageId, setStageId] = useState<string>(firstStage?.id ?? '');
  const [contactId, setContactId] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update default stageId when funnel loads
  React.useEffect(() => {
    if (!stageId && firstStage) setStageId(firstStage.id);
  }, [firstStage?.id]);

  /** Valida os campos obrigatórios (título e órgão) e retorna o mapa de erros. */
  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Título é obrigatório';
    if (!contactId) e.contact = 'Selecione ou crie um órgão';
    return e;
  };

  /** Cria um novo contato (lead) a partir do formulário inline e o seleciona para a negociação. */
  const handleCreateContact = async (form: NewContactForm) => {
    const contact = await createContact({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      type: 'lead',
      jobTitle: null,
      avatarUrl: null,
      tags: [],
      notes: null,
    });
    setContactId(contact.id);
  };

  /** Valida o formulário e, se válido, cria a negociação e volta para a tela anterior. */
  const handleCreate = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const selectedStage = funnel?.stages.find((s) => s.id === stageId);
      await createDeal({
        funnelId: funnel?.id ?? DEFAULT_FUNNEL_ID,
        stageId,
        stage: 'qualification',
        contactId,
        ownerId: null,
        title: title.trim(),
        value: parseCurrencyInput(valueInput),
        currency: 'BRL',
        probability: selectedStage?.probability ?? 10,
        expectedCloseDate: expectedCloseDate.trim() || null,
        closingReason: null,
        notes: notes.trim() || null,
      });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Nova Negociação', headerShown: Platform.OS !== 'web' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {Platform.OS === 'web' && (
          <Text style={styles.pageTitle}>Nova Negociação</Text>
        )}

        {/* Funnel indicator */}
        {funnel && (
          <View style={styles.funnelBadge}>
            <Text style={styles.funnelBadgeText}>🎯 {funnel.name}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Informações da Negociação</Text>

        <Input label="Título *" value={title} onChangeText={setTitle} error={errors.title} placeholder="Ex: Proposta para Empresa X" />

        <Input
          label="Valor (R$)"
          value={valueInput}
          onChangeText={setValueInput}
          keyboardType="numeric"
          placeholder="0,00"
        />

        <Input
          label="Data prevista de fechamento"
          value={expectedCloseDate}
          onChangeText={setExpectedCloseDate}
          placeholder="AAAA-MM-DD"
        />

        {/* Stage selector */}
        {activeStages.length > 0 && (
          <>
            <Text style={styles.label}>Etapa inicial</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stageScroll}>
              <View style={styles.stageRow}>
                {activeStages.map((st) => (
                  <Pressable
                    key={st.id}
                    style={[styles.stagePill, stageId === st.id && { backgroundColor: st.color, borderColor: st.color }]}
                    onPress={() => setStageId(st.id)}
                  >
                    <View style={[styles.stageDot, { backgroundColor: stageId === st.id ? COLORS.white : st.color }]} />
                    <Text style={[styles.stagePillText, stageId === st.id && { color: COLORS.white }]}>{st.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <Input
          label="Observações"
          value={notes}
          onChangeText={setNotes}
          placeholder="Opcional..."
          multiline
          numberOfLines={3}
        />

        {/* Contact */}
        <Text style={styles.sectionTitle}>Órgão *</Text>
        {errors.contact && <Text style={styles.error}>{errors.contact}</Text>}
        <ContactPicker
          contacts={contacts}
          selectedId={contactId}
          onSelect={setContactId}
          onCreateContact={handleCreateContact}
        />

        <Button label="Criar Negociação" onPress={handleCreate} loading={loading} style={styles.submit} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.xl, paddingBottom: SPACING['2xl'], maxWidth: 720, width: '100%' as unknown as number, alignSelf: 'center' },
  pageTitle: { fontSize: FONTS['2xl'], fontWeight: '800', color: COLORS.gray[900], marginBottom: SPACING.lg },
  funnelBadge: {
    alignSelf: 'flex-start', backgroundColor: COLORS.primary + '12',
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4,
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.primary + '25',
  },
  funnelBadgeText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.md, marginTop: SPACING.md },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.sm },
  stageScroll: { marginBottom: SPACING.md },
  stageRow: { flexDirection: 'row', gap: SPACING.sm, paddingBottom: SPACING.xs },
  stagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  stageDot: { width: 8, height: 8, borderRadius: 4 },
  stagePillText: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[600] },
  error: { fontSize: FONTS.sm, color: COLORS.danger, marginBottom: SPACING.sm },
  submit: { marginTop: SPACING.xl },
});
