import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Deal, Contact } from '../../types/models';
import { useCustomFieldStore } from '../../stores/customFieldStore';
import { useCompanyStore } from '../../stores/companyStore';
import { formatCurrency } from '../../utils/currency';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  deal: Deal;
  contact: Contact | undefined;
  onUpdateDeal: (patch: Partial<Deal>) => void;
}

/** Campo de texto rotulado, editável ao toque, que salva o valor ao confirmar ou perder o foco. */
function Field({ label, value, onSave }: { label: string; value: string; onSave?: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Salva o rascunho se mudou e encerra a edição.
  const handleSave = () => {
    if (onSave && draft !== value) onSave(draft);
    setEditing(false);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.fieldInput}
          value={draft}
          onChangeText={setDraft}
          onBlur={handleSave}
          onSubmitEditing={handleSave}
          autoFocus
        />
      ) : (
        <Pressable onPress={() => { setDraft(value); setEditing(true); }}>
          <Text style={styles.fieldValue}>{value || <Text style={styles.fieldEmpty}>—</Text>}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Converte um valor bruto (JSON de array ou lista separada por vírgulas) em um array de strings.
function parseMultiValue(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Campo de seleção única com menu suspenso de opções, salvando a opção escolhida. */
function SelectField({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ position: 'relative' as any, zIndex: 50 }}>
        <Pressable onPress={() => setOpen(!open)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>{value || '—'}</Text>
            <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{open ? '▲' : '▼'}</Text>
          </View>
        </Pressable>
        {open && (
          <>
            <Pressable style={{ position: 'fixed' as any, inset: 0, zIndex: 48 }} onPress={() => setOpen(false)} />
            <View style={styles.companyFlyout}>
              {options.length === 0 && (
                <View style={styles.companyItem}><Text style={styles.companyItemTxt}>Sem opções</Text></View>
              )}
              {options.map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.companyItem, opt === value && styles.companyItemActive]}
                  onPress={() => { onSave(opt); setOpen(false); }}
                >
                  <Text style={[styles.companyItemTxt, opt === value && { color: '#6366f1', fontWeight: '700' }]}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Campo de seleção múltipla com menu suspenso, salvando as opções marcadas como JSON. */
function MultiSelectField({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = parseMultiValue(value);
  // Alterna a presença de uma opção na seleção e persiste o resultado.
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onSave(JSON.stringify(next));
  };
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ position: 'relative' as any, zIndex: 50 }}>
        <Pressable onPress={() => setOpen(!open)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {selected.length === 0 ? (
              <Text style={[styles.fieldValue, styles.fieldEmpty]}>—</Text>
            ) : (
              selected.map((s) => (
                <View key={s} style={{ backgroundColor: '#6366f1' + '18', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                  <Text style={{ fontSize: FONTS.xs, color: '#6366f1', fontWeight: '600' }}>{s}</Text>
                </View>
              ))
            )}
            <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{open ? '▲' : '▼'}</Text>
          </View>
        </Pressable>
        {open && (
          <>
            <Pressable style={{ position: 'fixed' as any, inset: 0, zIndex: 48 }} onPress={() => setOpen(false)} />
            <View style={styles.companyFlyout}>
              {options.length === 0 && (
                <View style={styles.companyItem}><Text style={styles.companyItemTxt}>Sem opções</Text></View>
              )}
              {options.map((opt) => {
                const isSel = selected.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    style={[styles.companyItem, isSel && styles.companyItemActive]}
                    onPress={() => toggle(opt)}
                  >
                    <Text style={[styles.companyItemTxt, isSel && { color: '#6366f1', fontWeight: '700' }]}>
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

/** Campo de empresa com menu suspenso que lista as empresas carregadas e permite vincular uma à negociação. */
function CompanyField({ companyId, companyName, onChangeCompany }: { companyId: string; companyName: string; onChangeCompany: (id: string) => void }) {
  const { companies, loadCompanies } = useCompanyStore();
  const [open, setOpen] = useState(false);

  useEffect(() => { loadCompanies(); }, []);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Empresa</Text>
      <View style={{ position: 'relative' as any, zIndex: 50 }}>
        <Pressable onPress={() => setOpen(!open)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.fieldValue, { color: '#6366f1', fontWeight: '600' }]}>{companyName || '—'}</Text>
            <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{open ? '▲' : '▼'}</Text>
          </View>
        </Pressable>
        {open && (
          <>
            <Pressable style={{ position: 'fixed' as any, inset: 0, zIndex: 48 }} onPress={() => setOpen(false)} />
            <View style={styles.companyFlyout}>
              {companies.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.companyItem, c.id === companyId && styles.companyItemActive]}
                  onPress={() => { onChangeCompany(c.id); setOpen(false); }}
                >
                  <Text style={[styles.companyItemTxt, c.id === companyId && { color: '#6366f1', fontWeight: '700' }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Painel lateral da negociação: exibe e edita dados principais (valor, datas, probabilidade etc.) e campos personalizados. */
export function DealLeftPanel({ deal, contact, onUpdateDeal }: Props) {
  const { fields, dealValues, loadFields, loadDealValues, saveDealValues } = useCustomFieldStore();

  useEffect(() => {
    loadFields();
    loadDealValues(deal.id);
  }, [deal.id]);

  // Persiste o valor de um campo personalizado para esta negociação.
  const handleCustomFieldSave = (fieldId: string, value: string) => {
    saveDealValues(deal.id, [{ fieldId, value }]);
  };

  const createdAt = new Date(deal.createdAt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Negociação</Text>

        <Field label="Nome" value={deal.title} onSave={(v) => onUpdateDeal({ title: v })} />
        <Field
          label="Órgão"
          value={contact ? `${contact.firstName} ${contact.lastName}` : '—'}
        />
        <CompanyField
          companyId={deal.companyId ?? ''}
          companyName={deal.companyName ?? ''}
          onChangeCompany={(id) => onUpdateDeal({ companyId: id } as any)}
        />
        <Field label="Criada em" value={createdAt} />
        <Field
          label="Valor total"
          value={formatCurrency(deal.value)}
          onSave={(v) => {
            const num = parseFloat(v.replace(/[^0-9,.]/g, '').replace(',', '.')) * 100;
            if (!isNaN(num)) onUpdateDeal({ value: Math.round(num) });
          }}
        />
        <Field
          label="Previsão de fechamento"
          value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('pt-BR') : ''}
          onSave={(v) => onUpdateDeal({ expectedCloseDate: v || null })}
        />
        <Field
          label="Probabilidade"
          value={deal.probability ? `${deal.probability}%` : ''}
          onSave={(v) => {
            const num = parseInt(v.replace('%', ''), 10);
            if (!isNaN(num)) onUpdateDeal({ probability: Math.min(100, Math.max(0, num)) });
          }}
        />
        <Field
          label="Observações"
          value={deal.notes ?? ''}
          onSave={(v) => onUpdateDeal({ notes: v || null })}
        />

        {fields.map((field) => {
          const val = dealValues[field.id] ?? '';
          if (field.fieldType === 'select') {
            return (
              <SelectField
                key={field.id}
                label={field.name}
                value={val}
                options={field.options ?? []}
                onSave={(v) => handleCustomFieldSave(field.id, v)}
              />
            );
          }
          if (field.fieldType === 'multiselect') {
            return (
              <MultiSelectField
                key={field.id}
                label={field.name}
                value={val}
                options={field.options ?? []}
                onSave={(v) => handleCustomFieldSave(field.id, v)}
              />
            );
          }
          return (
            <Field
              key={field.id}
              label={field.name}
              value={val}
              onSave={(v) => handleCustomFieldSave(field.id, v)}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  section: { padding: SPACING.lg },
  sectionTitle: {
    fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[800],
    marginBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], paddingBottom: SPACING.sm,
  },
  field: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONTS.xs, color: COLORS.gray[500], fontWeight: '500', marginBottom: 2 },
  fieldValue: { fontSize: FONTS.sm, color: COLORS.gray[900], fontWeight: '500' },
  fieldEmpty: { color: COLORS.gray[300] },
  fieldInput: {
    fontSize: FONTS.sm, color: COLORS.gray[900], borderBottomWidth: 1,
    borderBottomColor: COLORS.primary, paddingVertical: 2,
  },
  companyFlyout: {
    position: 'absolute' as any, top: '100%' as any, left: 0, marginTop: 4,
    minWidth: 200, backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 49, overflow: 'hidden' as any,
  },
  companyItem: {
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[50],
  },
  companyItemActive: { backgroundColor: '#6366f1' + '0d' },
  companyItemTxt: { fontSize: FONTS.sm, color: COLORS.gray[700] },
});
