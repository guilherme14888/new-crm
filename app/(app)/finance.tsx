import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Modal, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import {
  useFinanceStore, FinanceCompany, CompanyInvoice, LicensePurchase,
} from '../../src/stores/financeStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

/** Formata um valor em centavos como moeda brasileira (R$). */
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Retorna o rótulo e a cor de status da empresa (bloqueada ou em dia). */
function dueStatus(c: FinanceCompany): { label: string; color: string } {
  if (c.isBlocked) return { label: 'Bloqueada', color: COLORS.danger };
  return { label: 'Em dia', color: COLORS.success };
}

const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

/** Roteia a tela de Financeiro: empresa Default vê o painel admin (gerencia todas
 *  as empresas); demais empresas veem o autoatendimento das próprias licenças. */
export default function FinanceScreen() {
  const user = useAuthStore((s) => s.user);
  if (user && user.companyId !== MASTER_COMPANY_ID) return <TenantFinanceScreen />;
  return <AdminFinanceScreen />;
}

/** Tela financeira (admin Default): KPIs, lista de empresas tenants com licenças/cobranças e modal de detalhe. */
function AdminFinanceScreen() {
  const user = useAuthStore((s) => s.user);
  const { companies, isLoading, loadCompanies } = useFinanceStore();

  const [selected, setSelected] = useState<FinanceCompany | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') loadCompanies();
  }, [user?.role]);

  if (user && user.role !== 'admin') {
    return (
      <View style={styles.screen}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>Acesso restrito</Text>
          <Text style={styles.emptyDesc}>Esta área é exclusiva para administradores.</Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/(app)/(tabs)/dashboard')}>
            <Text style={styles.btnTxt}>Voltar ao Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = !q ? companies : companies.filter((c) =>
    c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  );

  const totals = useMemo(() => ({
    activeLicenses: companies.reduce((sum, c) => sum + c.activeLicenses, 0),
    purchasedLicenses: companies.reduce((sum, c) => sum + c.purchasedLicenses, 0),
    monthlyRevenue: companies.reduce((sum, c) => sum + c.purchasedLicenses * c.licensePriceCents, 0),
    blocked: companies.filter((c) => c.isBlocked).length,
  }), [companies]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Financeiro</Text>
        <Text style={styles.sub}>Cobranças, licenças e bloqueios das empresas tenants</Text>
      </View>

      {/* KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Empresas</Text>
          <Text style={styles.kpiValue}>{companies.length}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Licenças ativas</Text>
          <Text style={styles.kpiValue}>{totals.activeLicenses}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Licenças contratadas</Text>
          <Text style={styles.kpiValue}>{totals.purchasedLicenses}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>MRR estimado</Text>
          <Text style={styles.kpiValue}>{formatCents(totals.monthlyRevenue)}</Text>
        </View>
        <View style={[styles.kpi, totals.blocked > 0 && { borderColor: COLORS.danger, borderWidth: 1 }]}>
          <Text style={styles.kpiLabel}>Bloqueadas</Text>
          <Text style={[styles.kpiValue, totals.blocked > 0 && { color: COLORS.danger }]}>{totals.blocked}</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar empresa..."
          placeholderTextColor={COLORS.gray[400]}
        />
        <Pressable style={styles.refreshBtn} onPress={() => loadCompanies()} disabled={isLoading}>
          <Text style={styles.refreshTxt}>{isLoading ? 'Atualizando...' : '↻ Atualizar'}</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm }}>
        {filtered.length === 0 && (
          <Text style={styles.emptyTxt}>{companies.length === 0 ? 'Nenhuma empresa encontrada.' : 'Nenhum resultado.'}</Text>
        )}
        {filtered.map((c) => {
          const status = dueStatus(c);
          const overUsed = c.activeLicenses > c.purchasedLicenses && c.purchasedLicenses > 0;
          return (
            <Pressable key={c.id} style={[styles.row, c.isBlocked && styles.rowBlocked]} onPress={() => setSelected(c)}>
              <View style={{ flex: 2 }}>
                <Text style={styles.rowName}>{c.name}</Text>
                <Text style={styles.rowSub}>slug: {c.slug}{c.cnpj ? `  ·  ${c.cnpj}` : ''}</Text>
              </View>
              <View style={[styles.licenseBox, overUsed && styles.licenseBoxOver]}>
                <Text style={[styles.licenseValue, overUsed && { color: COLORS.danger }]}>
                  {c.activeLicenses} / {c.purchasedLicenses || '—'}
                </Text>
                <Text style={styles.licenseLabel}>licenças</Text>
              </View>
              <View style={{ width: 100, alignItems: 'center' }}>
                <Text style={styles.dueDay}>dia {c.billingDay}</Text>
                <Text style={styles.licenseLabel}>vencimento</Text>
              </View>
              <View style={{ width: 110, alignItems: 'center' }}>
                <Text style={styles.priceVal}>{formatCents(c.licensePriceCents)}</Text>
                <Text style={styles.licenseLabel}>por licença</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: status.color + '18' }]}>
                <Text style={[styles.statusTxt, { color: status.color }]}>{status.label}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selected && (
        <FinanceDetailModal company={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

/** Modal de detalhe da empresa: configuração de cobrança, gestão de faturas e compras de licenças, e bloqueio/desbloqueio. */
function FinanceDetailModal({ company, onClose }: { company: FinanceCompany; onClose: () => void }) {
  const {
    detail, loadDetail, updateBilling, block, unblock,
    createInvoice, payInvoice, updateInvoice,
    createLicensePurchase, confirmLicensePurchase,
  } = useFinanceStore();

  const d = detail[company.id];
  const c = d?.company ?? company;

  const [billingDay, setBillingDay]               = useState(String(c.billingDay));
  const [graceDays, setGraceDays]                 = useState(String(c.blockGraceDays));
  const [pricePerLicense, setPricePerLicense]     = useState((c.licensePriceCents / 100).toFixed(2));
  const [purchasedLicenses, setPurchasedLicenses] = useState(String(c.purchasedLicenses));
  const [trialDays, setTrialDays]                 = useState(c.trialDays != null ? String(c.trialDays) : '');

  const [invoiceForm, setInvoiceForm] = useState({
    periodStart: '', periodEnd: '', dueDate: '', licenses: '', notes: '',
  });

  const [purchaseForm, setPurchaseForm] = useState({ quantity: '', price: '' });

  useEffect(() => { loadDetail(company.id); }, [company.id]);

  useEffect(() => {
    if (d) {
      setBillingDay(String(d.company.billingDay));
      setGraceDays(String(d.company.blockGraceDays));
      setPricePerLicense((d.company.licensePriceCents / 100).toFixed(2));
      setPurchasedLicenses(String(d.company.purchasedLicenses));
      setTrialDays(d.company.trialDays != null ? String(d.company.trialDays) : '');
    }
  }, [d?.company.id, d?.company.licensePriceCents, d?.company.purchasedLicenses, d?.company.billingDay, d?.company.blockGraceDays, d?.company.trialDays, d?.company.trialStartsAt]);

  /** Persiste a configuração de cobrança (vencimento, tolerância, preço e licenças contratadas). */
  const saveBilling = async () => {
    await updateBilling(company.id, {
      billingDay: parseInt(billingDay, 10) || 5,
      blockGraceDays: parseInt(graceDays, 10) || 4,
      licensePriceCents: Math.round((parseFloat(pricePerLicense.replace(',', '.')) || 0) * 100),
      purchasedLicenses: parseInt(purchasedLicenses, 10) || 0,
    });
  };

  /** Inicia/reinicia o período de teste com os dias informados (contagem começa agora). */
  const startTrial = async () => {
    const td = parseInt(trialDays, 10);
    if (!td || td <= 0) { if (Platform.OS === 'web') window.alert('Informe os dias de teste'); return; }
    await updateBilling(company.id, { trialDays: td, trialStart: true });
  };
  /** Encerra/limpa o período de teste da empresa. */
  const clearTrial = async () => { await updateBilling(company.id, { trialDays: 0 }); };

  /** Exibe uma confirmação (web/nativo) e executa a ação assíncrona se confirmada. */
  const confirmThenRun = (msg: string, fn: () => Promise<void>) => {
    if (Platform.OS === 'web') { if (window.confirm(msg)) fn(); return; }
    Alert.alert('Confirmar', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'OK', onPress: () => fn() },
    ]);
  };

  /** Valida período/vencimento e cria uma nova fatura para a empresa, limpando o formulário. */
  const handleCreateInvoice = async () => {
    if (!invoiceForm.periodStart || !invoiceForm.periodEnd || !invoiceForm.dueDate) {
      if (Platform.OS === 'web') window.alert('Preencha período e vencimento');
      return;
    }
    await createInvoice(company.id, {
      periodStart: invoiceForm.periodStart,
      periodEnd: invoiceForm.periodEnd,
      dueDate: invoiceForm.dueDate,
      licensesBilled: invoiceForm.licenses ? parseInt(invoiceForm.licenses, 10) : undefined,
      notes: invoiceForm.notes || undefined,
    });
    setInvoiceForm({ periodStart: '', periodEnd: '', dueDate: '', licenses: '', notes: '' });
  };

  /** Valida quantidade/preço e cria um pedido pendente de compra de licenças extras. */
  const handleCreatePurchase = async () => {
    const q = parseInt(purchaseForm.quantity, 10);
    const p = Math.round((parseFloat(purchaseForm.price.replace(',', '.')) || 0) * 100);
    if (!q || !p) {
      if (Platform.OS === 'web') window.alert('Preencha quantidade e preço');
      return;
    }
    await createLicensePurchase(company.id, { quantity: q, unitPriceCents: p });
    setPurchaseForm({ quantity: '', price: '' });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={dm.overlay}>
        <Pressable style={dm.backdrop} onPress={onClose} />
        <View style={dm.sheet}>
          <View style={dm.header}>
            <View style={{ flex: 1 }}>
              <Text style={dm.title}>{c.name}</Text>
              <Text style={dm.sub}>{c.slug}{c.cnpj ? `  ·  ${c.cnpj}` : ''}</Text>
            </View>
            {c.isBlocked ? (
              <Pressable style={[dm.actionBtn, dm.unblockBtn]} onPress={() => confirmThenRun(`Desbloquear ${c.name}?`, () => unblock(company.id))}>
                <Text style={dm.unblockTxt}>✓ Desbloquear</Text>
              </Pressable>
            ) : (
              <Pressable style={[dm.actionBtn, dm.blockBtn]} onPress={() => confirmThenRun(`Bloquear ${c.name}?`, () => block(company.id))}>
                <Text style={dm.blockTxt}>⛔ Bloquear</Text>
              </Pressable>
            )}
            <Pressable style={dm.closeBtn} onPress={onClose}>
              <Text style={dm.closeTxt}>✕</Text>
            </Pressable>
          </View>

          {c.isBlocked && (
            <View style={dm.blockBanner}>
              <Text style={dm.blockBannerTxt}>
                ⚠  Empresa bloqueada{c.blockedReason ? ` (${c.blockedReason === 'overdue' ? 'fatura vencida' : c.blockedReason})` : ''}
              </Text>
            </View>
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
            {/* Billing config */}
            <View style={dm.card}>
              <Text style={dm.cardTitle}>Configuração de cobrança</Text>
              <View style={dm.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={dm.label}>Dia do vencimento</Text>
                  <TextInput style={dm.input} value={billingDay} onChangeText={setBillingDay} keyboardType="numeric" placeholder="5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dm.label}>Tolerância (dias)</Text>
                  <TextInput style={dm.input} value={graceDays} onChangeText={setGraceDays} keyboardType="numeric" placeholder="4" />
                </View>
              </View>
              <View style={dm.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={dm.label}>Preço por licença (R$)</Text>
                  <TextInput style={dm.input} value={pricePerLicense} onChangeText={setPricePerLicense} keyboardType="decimal-pad" placeholder="0,00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dm.label}>Licenças contratadas</Text>
                  <TextInput style={dm.input} value={purchasedLicenses} onChangeText={setPurchasedLicenses} keyboardType="numeric" placeholder="0" />
                </View>
              </View>
              <Pressable style={dm.primaryBtn} onPress={saveBilling}>
                <Text style={dm.primaryBtnTxt}>Salvar configuração</Text>
              </Pressable>
              <Text style={dm.help}>
                Licenças ativas (usuários ativos): <Text style={{ fontWeight: '700' }}>{c.activeLicenses}</Text>
                {c.purchasedLicenses > 0 && c.activeLicenses > c.purchasedLicenses ? (
                  <Text style={{ color: COLORS.danger, fontWeight: '700' }}>  ·  excedeu o contrato</Text>
                ) : null}
              </Text>
            </View>

            {/* Período de teste */}
            <View style={dm.card}>
              <Text style={dm.cardTitle}>Período de teste</Text>
              <View style={dm.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={dm.label}>Dias de teste</Text>
                  <TextInput style={dm.input} value={trialDays} onChangeText={setTrialDays} keyboardType="numeric" placeholder="ex.: 15" />
                </View>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <Pressable style={dm.primaryBtn} onPress={startTrial}>
                    <Text style={dm.primaryBtnTxt}>{c.trialStartsAt ? 'Reiniciar período' : 'Iniciar período'}</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={[dm.help, c.trialExpired ? { color: COLORS.danger, fontWeight: '700' } : c.onTrial ? { color: '#b45309', fontWeight: '700' } : null]}>
                {c.onTrial
                  ? `Em teste — faltam ${c.trialDaysLeft} dia(s)${c.trialEndsAt ? ` (termina ${new Date(c.trialEndsAt).toLocaleDateString('pt-BR')})` : ''}.`
                  : c.trialExpired
                    ? 'Período de teste expirado — usuários não-admin estão bloqueados no login.'
                    : 'Sem período de teste ativo. Informe os dias e clique em Iniciar.'}
              </Text>
              {(c.onTrial || c.trialExpired) && (
                <Pressable onPress={clearTrial}>
                  <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sm, marginTop: SPACING.sm }}>Encerrar período de teste</Text>
                </Pressable>
              )}
            </View>

            {/* Invoices */}
            <View style={dm.card}>
              <Text style={dm.cardTitle}>Faturas</Text>
              <View style={dm.invoiceCreate}>
                <View style={dm.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={dm.label}>Período início</Text>
                    <TextInput style={dm.input} value={invoiceForm.periodStart} onChangeText={(v) => setInvoiceForm((f) => ({ ...f, periodStart: v }))} placeholder="AAAA-MM-DD" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dm.label}>Período fim</Text>
                    <TextInput style={dm.input} value={invoiceForm.periodEnd} onChangeText={(v) => setInvoiceForm((f) => ({ ...f, periodEnd: v }))} placeholder="AAAA-MM-DD" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dm.label}>Vencimento</Text>
                    <TextInput style={dm.input} value={invoiceForm.dueDate} onChangeText={(v) => setInvoiceForm((f) => ({ ...f, dueDate: v }))} placeholder="AAAA-MM-DD" />
                  </View>
                </View>
                <View style={dm.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={dm.label}>Licenças (opc.)</Text>
                    <TextInput style={dm.input} value={invoiceForm.licenses} onChangeText={(v) => setInvoiceForm((f) => ({ ...f, licenses: v }))} keyboardType="numeric" placeholder="(usa ativas)" />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={dm.label}>Notas</Text>
                    <TextInput style={dm.input} value={invoiceForm.notes} onChangeText={(v) => setInvoiceForm((f) => ({ ...f, notes: v }))} placeholder="Ex: cobrança jul/2026" />
                  </View>
                </View>
                <Pressable style={dm.primaryBtn} onPress={handleCreateInvoice}>
                  <Text style={dm.primaryBtnTxt}>+ Criar fatura</Text>
                </Pressable>
              </View>

              <View style={{ marginTop: SPACING.md }}>
                {(d?.invoices ?? []).length === 0 && (
                  <Text style={dm.emptyTxt}>Nenhuma fatura ainda.</Text>
                )}
                {(d?.invoices ?? []).map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    onPay={() => confirmThenRun('Marcar fatura como paga?', () => payInvoice(inv.id))}
                    onCancel={() => confirmThenRun('Cancelar fatura?', () => updateInvoice(inv.id, { status: 'canceled' }))}
                  />
                ))}
              </View>
            </View>

            {/* License purchases */}
            <View style={dm.card}>
              <Text style={dm.cardTitle}>Compra de licenças extras</Text>
              <Text style={dm.help}>
                Cria um pedido pendente. Quando o pagamento chegar (manualmente ou via webhook do gateway),
                confirme para somar as licenças ao contrato.
              </Text>
              <View style={dm.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={dm.label}>Quantidade</Text>
                  <TextInput style={dm.input} value={purchaseForm.quantity} onChangeText={(v) => setPurchaseForm((f) => ({ ...f, quantity: v }))} keyboardType="numeric" placeholder="0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dm.label}>Preço unitário (R$)</Text>
                  <TextInput style={dm.input} value={purchaseForm.price} onChangeText={(v) => setPurchaseForm((f) => ({ ...f, price: v }))} keyboardType="decimal-pad" placeholder="0,00" />
                </View>
              </View>
              <Pressable style={dm.primaryBtn} onPress={handleCreatePurchase}>
                <Text style={dm.primaryBtnTxt}>+ Pedido de compra</Text>
              </Pressable>

              <View style={{ marginTop: SPACING.md }}>
                {(d?.licensePurchases ?? []).length === 0 && (
                  <Text style={dm.emptyTxt}>Nenhuma compra registrada.</Text>
                )}
                {(d?.licensePurchases ?? []).map((lp) => (
                  <LicensePurchaseRow
                    key={lp.id}
                    purchase={lp}
                    onConfirm={() => confirmThenRun(`Confirmar pagamento de ${lp.quantity} licença(s)?`, () => confirmLicensePurchase(lp.id))}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Linha de uma fatura: período, valores, status e ações de pagar/cancelar quando aplicável. */
function InvoiceRow({ invoice, onPay, onCancel }: { invoice: CompanyInvoice; onPay: () => void; onCancel: () => void }) {
  const colorByStatus: Record<CompanyInvoice['status'], string> = {
    open: COLORS.gray[500], paid: COLORS.success, overdue: COLORS.danger, canceled: COLORS.gray[400],
  };
  const labelByStatus: Record<CompanyInvoice['status'], string> = {
    open: 'Em aberto', paid: 'Paga', overdue: 'Vencida', canceled: 'Cancelada',
  };
  return (
    <View style={dm.invoiceRow}>
      <View style={{ flex: 2 }}>
        <Text style={dm.invoiceTitle}>{invoice.periodStart} → {invoice.periodEnd}</Text>
        <Text style={dm.invoiceMeta}>Vencimento: {invoice.dueDate}{invoice.notes ? `  ·  ${invoice.notes}` : ''}</Text>
      </View>
      <Text style={dm.invoiceQty}>{invoice.licensesBilled}× {formatCents(invoice.unitPriceCents)}</Text>
      <Text style={dm.invoiceTotal}>{formatCents(invoice.totalCents)}</Text>
      <View style={[dm.statusPill, { backgroundColor: colorByStatus[invoice.status] + '18' }]}>
        <Text style={[dm.statusTxt, { color: colorByStatus[invoice.status] }]}>{labelByStatus[invoice.status]}</Text>
      </View>
      {(invoice.status === 'open' || invoice.status === 'overdue') && (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable style={dm.smallBtn} onPress={onPay}>
            <Text style={dm.smallBtnTxt}>✓ Pagar</Text>
          </Pressable>
          <Pressable style={[dm.smallBtn, { backgroundColor: COLORS.gray[100] }]} onPress={onCancel}>
            <Text style={[dm.smallBtnTxt, { color: COLORS.gray[600] }]}>Cancelar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Linha de uma compra de licenças: quantidade, valores, status e ação de confirmar pagamento se pendente. */
function LicensePurchaseRow({ purchase, onConfirm }: { purchase: LicensePurchase; onConfirm: () => void }) {
  const colorByStatus: Record<LicensePurchase['status'], string> = {
    pending: COLORS.gray[500], paid: COLORS.success, failed: COLORS.danger, canceled: COLORS.gray[400],
  };
  const labelByStatus: Record<LicensePurchase['status'], string> = {
    pending: 'Pendente', paid: 'Confirmada', failed: 'Falhou', canceled: 'Cancelada',
  };
  return (
    <View style={dm.invoiceRow}>
      <View style={{ flex: 2 }}>
        <Text style={dm.invoiceTitle}>{purchase.quantity} licença(s)</Text>
        <Text style={dm.invoiceMeta}>{purchase.createdAt?.slice(0, 10)}{purchase.paymentProviderRef ? `  ·  ref: ${purchase.paymentProviderRef}` : ''}</Text>
      </View>
      <Text style={dm.invoiceQty}>{formatCents(purchase.unitPriceCents)}</Text>
      <Text style={dm.invoiceTotal}>{formatCents(purchase.totalCents)}</Text>
      <View style={[dm.statusPill, { backgroundColor: colorByStatus[purchase.status] + '18' }]}>
        <Text style={[dm.statusTxt, { color: colorByStatus[purchase.status] }]}>{labelByStatus[purchase.status]}</Text>
      </View>
      {purchase.status === 'pending' && (
        <Pressable style={dm.smallBtn} onPress={onConfirm}>
          <Text style={dm.smallBtnTxt}>Confirmar</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Autoatendimento do tenant (empresa não-Default) ──────────────────────────
/** Dashboard de licenças da própria empresa: contratadas, em uso, valor unitário
 *  (definido pela Default) e botão para contratar mais licenças. */
function TenantFinanceScreen() {
  const { mySummary, loadMySummary, contractLicenses } = useFinanceStore();
  const [showBuy, setShowBuy] = useState(false);
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadMySummary(); }, []);

  const c = mySummary?.company;
  const purchases = mySummary?.licensePurchases ?? [];
  const unit = c?.licensePriceCents ?? 0;
  const contracted = c?.purchasedLicenses ?? 0;
  const active = c?.activeLicenses ?? 0;
  const monthly = contracted * unit;
  const buyQty = Math.max(1, parseInt(qty, 10) || 0);

  const handleBuy = async () => {
    setBusy(true);
    try { await contractLicenses(buyQty); setShowBuy(false); setQty('1'); }
    catch { if (Platform.OS === 'web') window.alert('Não foi possível enviar o pedido.'); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={ts.screen} contentContainerStyle={{ padding: SPACING.lg }}>
      <Text style={ts.title}>Licenças</Text>
      <Text style={ts.sub}>{c?.name ?? 'Sua empresa'}</Text>

      {c?.isBlocked && (
        <View style={ts.alert}><Text style={ts.alertTxt}>⛔  Acesso bloqueado — entre em contato com o setor financeiro.</Text></View>
      )}
      {c?.onTrial && (
        <View style={ts.trial}><Text style={ts.trialTxt}>⏳  Período de teste — faltam {c.trialDaysLeft} dia(s).</Text></View>
      )}

      <View style={ts.kpiRow}>
        <View style={ts.kpi}><Text style={ts.kpiVal}>{contracted}</Text><Text style={ts.kpiLbl}>Licenças contratadas</Text></View>
        <View style={ts.kpi}><Text style={ts.kpiVal}>{active}</Text><Text style={ts.kpiLbl}>Licenças em uso</Text></View>
        <View style={ts.kpi}><Text style={ts.kpiVal}>{formatCents(unit)}</Text><Text style={ts.kpiLbl}>Valor por licença</Text></View>
        <View style={ts.kpi}><Text style={ts.kpiVal}>{formatCents(monthly)}</Text><Text style={ts.kpiLbl}>Total mensal</Text></View>
      </View>

      {contracted > 0 && active > contracted && (
        <Text style={ts.warn}>⚠  Você usa {active} licenças, acima das {contracted} contratadas. Contrate mais para regularizar.</Text>
      )}

      <Pressable style={ts.buyBtn} onPress={() => setShowBuy(true)}>
        <Text style={ts.buyTxt}>+  Contratar mais licenças</Text>
      </Pressable>

      <Text style={ts.section}>Pedidos de contratação</Text>
      {purchases.length === 0 && <Text style={ts.muted}>Nenhum pedido ainda.</Text>}
      {purchases.map((p) => (
        <View key={p.id} style={ts.pRow}>
          <Text style={ts.pQty}>{p.quantity} licença(s)</Text>
          <Text style={ts.pVal}>{formatCents(p.totalCents)}</Text>
          <Text style={[ts.pStatus, { color: p.status === 'paid' ? COLORS.success : COLORS.gray[500] }]}>
            {p.status === 'paid' ? 'Confirmado' : p.status === 'pending' ? 'Aguardando confirmação' : p.status}
          </Text>
        </View>
      ))}

      <Modal visible={showBuy} transparent animationType="fade" onRequestClose={() => setShowBuy(false)}>
        <View style={ts.overlay}>
          <Pressable style={ts.backdrop} onPress={() => setShowBuy(false)} />
          <View style={ts.sheet}>
            <Text style={ts.mTitle}>Contratar licenças</Text>
            <Text style={ts.label}>Quantidade</Text>
            <TextInput style={ts.input} value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="1" />
            <Text style={ts.total}>Total: {formatCents(buyQty * unit)}  ·  {formatCents(unit)} por licença</Text>
            <Text style={ts.muted}>O pedido é enviado para confirmação do setor financeiro.</Text>
            <View style={ts.mBtns}>
              <Pressable style={ts.cancel} onPress={() => setShowBuy(false)}><Text style={ts.cancelTxt}>Cancelar</Text></Pressable>
              <Pressable style={[ts.confirm, busy && { opacity: 0.5 }]} onPress={handleBuy} disabled={busy}>
                <Text style={ts.confirmTxt}>{busy ? 'Enviando…' : 'Contratar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const ts = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: COLORS.gray[50] },
  title:    { fontSize: FONTS['2xl'], fontWeight: '800', color: COLORS.gray[900] },
  sub:      { fontSize: FONTS.base, color: COLORS.gray[500], marginTop: 2, marginBottom: SPACING.lg },
  alert:    { backgroundColor: '#fef2f2', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#fecaca' },
  alertTxt: { color: COLORS.danger, fontWeight: '700', fontSize: FONTS.sm },
  trial:    { backgroundColor: '#fffbeb', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#fcd34d' },
  trialTxt: { color: '#92400e', fontWeight: '700', fontSize: FONTS.sm },
  kpiRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  kpi:      { flexGrow: 1, minWidth: 150, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], padding: SPACING.lg },
  kpiVal:   { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  kpiLbl:   { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 4 },
  warn:     { color: '#b45309', fontWeight: '700', fontSize: FONTS.sm, marginTop: SPACING.md },
  buyBtn:   { marginTop: SPACING.lg, alignSelf: 'flex-start', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  buyTxt:   { color: COLORS.white, fontWeight: '800', fontSize: FONTS.base },
  section:  { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.gray[800], marginTop: SPACING.xl, marginBottom: SPACING.sm },
  muted:    { fontSize: FONTS.sm, color: COLORS.gray[400] },
  pRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[100], paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.xs },
  pQty:     { flex: 1, fontSize: FONTS.base, color: COLORS.gray[800], fontWeight: '600' },
  pVal:     { fontSize: FONTS.base, color: COLORS.gray[700], fontWeight: '700' },
  pStatus:  { fontSize: FONTS.sm, fontWeight: '700', width: 170, textAlign: 'right' },
  overlay:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { position: 'absolute' as any, inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' } as any,
  sheet:    { width: 420, maxWidth: '92%' as any, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl },
  mTitle:   { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900], marginBottom: SPACING.md },
  label:    { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: 4 },
  input:    { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.lg, color: COLORS.gray[900] },
  total:    { fontSize: FONTS.base, color: COLORS.gray[800], fontWeight: '700', marginTop: SPACING.md },
  mBtns:    { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  cancel:   { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:{ color: COLORS.gray[600], fontWeight: '600' },
  confirm:  { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmTxt:{ color: COLORS.white, fontWeight: '700' },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  title: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  sub:   { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },

  kpiRow: {
    flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg, paddingBottom: 0, flexWrap: 'wrap' as any,
  },
  kpi: {
    flex: 1, minWidth: 160, backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[100],
  },
  kpiLabel: { fontSize: FONTS.xs, color: COLORS.gray[500], fontWeight: '600', textTransform: 'uppercase' as any, letterSpacing: 0.5 },
  kpiValue: { fontSize: FONTS['2xl'], fontWeight: '800', color: COLORS.gray[900], marginTop: 4 },

  toolbar: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  search: { flex: 1, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, backgroundColor: COLORS.white },
  refreshBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100], borderWidth: 1, borderColor: COLORS.gray[200] },
  refreshTxt: { fontSize: FONTS.sm, color: COLORS.gray[700], fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[100],
  },
  rowBlocked: { borderColor: COLORS.danger + '50', backgroundColor: COLORS.danger + '06' },
  rowName: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[900] },
  rowSub:  { fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 2 },

  licenseBox: { width: 110, alignItems: 'center', padding: 4, borderRadius: RADIUS.sm },
  licenseBoxOver: { backgroundColor: COLORS.danger + '14' },
  licenseValue: { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.gray[900] },
  licenseLabel: { fontSize: 10, color: COLORS.gray[400], textTransform: 'uppercase' as any, letterSpacing: 0.5 },

  dueDay: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[800] },
  priceVal: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[800] },

  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, minWidth: 90, alignItems: 'center' },
  statusTxt:  { fontSize: 11, fontWeight: '700' },

  chevron: { fontSize: FONTS.xl, color: COLORS.gray[300] },

  emptyTxt: { textAlign: 'center', color: COLORS.gray[400], padding: SPACING.lg, fontStyle: 'italic' as any },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon:  { fontSize: 56, marginBottom: SPACING.lg },
  emptyTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[700], marginBottom: SPACING.sm, textAlign: 'center' },
  emptyDesc:  { fontSize: FONTS.base, color: COLORS.gray[400], textAlign: 'center', lineHeight: 24, maxWidth: 400, marginBottom: SPACING.lg },
  btn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md },
  btnTxt: { color: COLORS.white, fontWeight: '700' },
});

const dm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { position: 'absolute' as any, inset: 0 as any, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { backgroundColor: COLORS.gray[50], borderRadius: RADIUS.xl, width: 880, maxWidth: '95%' as any, maxHeight: '90%' as any, overflow: 'hidden' as any, zIndex: 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 16 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  title:    { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900] },
  sub:      { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 14, color: COLORS.gray[600], fontWeight: '700' },

  actionBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md },
  blockBtn:   { backgroundColor: COLORS.danger + '14', borderWidth: 1, borderColor: COLORS.danger + '40' },
  blockTxt:   { color: COLORS.danger, fontWeight: '700', fontSize: FONTS.sm },
  unblockBtn: { backgroundColor: COLORS.success + '14', borderWidth: 1, borderColor: COLORS.success + '40' },
  unblockTxt: { color: COLORS.success, fontWeight: '700', fontSize: FONTS.sm },

  blockBanner: { backgroundColor: COLORS.danger + '12', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.danger + '30' },
  blockBannerTxt: { color: COLORS.danger, fontWeight: '700', fontSize: FONTS.sm, textAlign: 'center' },

  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.gray[100] },
  cardTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.gray[800], marginBottom: SPACING.md },

  formRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  label:   { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: 4 },
  input:   { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white, marginBottom: SPACING.sm },
  primaryBtn:    { backgroundColor: COLORS.primary, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.xs },
  primaryBtnTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sm },
  help: { fontSize: FONTS.xs, color: COLORS.gray[500], marginTop: SPACING.sm },

  invoiceCreate: { backgroundColor: COLORS.gray[50], borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderStyle: 'dashed' as any, borderColor: COLORS.gray[200] },

  invoiceRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  invoiceTitle: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[800] },
  invoiceMeta:  { fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 2 },
  invoiceQty:   { fontSize: FONTS.xs, color: COLORS.gray[600], width: 100, textAlign: 'right' as any },
  invoiceTotal: { fontSize: FONTS.sm, color: COLORS.gray[900], fontWeight: '700', width: 100, textAlign: 'right' as any },

  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, minWidth: 90, alignItems: 'center' },
  statusTxt:  { fontSize: 11, fontWeight: '700' },

  smallBtn:    { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.success + '14', borderWidth: 1, borderColor: COLORS.success + '40' },
  smallBtnTxt: { fontSize: 11, color: COLORS.success, fontWeight: '700' },

  emptyTxt: { textAlign: 'center', color: COLORS.gray[400], padding: SPACING.md, fontStyle: 'italic' as any, fontSize: FONTS.sm },
});
