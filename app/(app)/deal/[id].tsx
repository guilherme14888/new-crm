import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDealStore } from '../../../src/stores/dealStore';
import { useContactStore } from '../../../src/stores/contactStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { Deal } from '../../../src/types/models';
import { DealHeader } from '../../../src/components/deal/DealHeader';
import { DealTagRow } from '../../../src/components/deal/DealTagRow';
import { DealStageBar } from '../../../src/components/deal/DealStageBar';
import { DealLeftPanel } from '../../../src/components/deal/DealLeftPanel';
import { DealHistoryTab } from '../../../src/components/deal/tabs/DealHistoryTab';
import { DealTasksTab } from '../../../src/components/deal/tabs/DealTasksTab';
import { DealProductsTab } from '../../../src/components/deal/tabs/DealProductsTab';
import { DealFilesTab } from '../../../src/components/deal/tabs/DealFilesTab';
import { DealEmailTab } from '../../../src/components/deal/tabs/DealEmailTab';
import { DealProposalsTab } from '../../../src/components/deal/tabs/DealProposalsTab';
import { COLORS, FONTS, SPACING } from '../../../src/constants/theme';

type TabKey = 'history' | 'tasks' | 'products' | 'files' | 'email' | 'proposals';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'history',   label: 'Histórico' },
  { key: 'tasks',     label: 'Tarefas' },
  { key: 'email',     label: 'E-mail' },
  { key: 'products',  label: 'Produtos' },
  { key: 'files',     label: 'Arquivos' },
  { key: 'proposals', label: 'Propostas' },
];

/** Tela de detalhe da negociação: cabeçalho, etapas, painel lateral e abas (histórico, tarefas, produtos, etc.). */
export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deals = useDealStore((s) => s.deals);
  const updateDeal = useDealStore((s) => s.updateDeal);
  const contacts = useContactStore((s) => s.contacts);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [activeTab, setActiveTab] = useState<TabKey>('history');
  const [localDeal, setLocalDeal] = useState<Deal | null>(null);

  const deal = localDeal ?? deals.find((d) => d.id === id) ?? null;
  const contact = deal ? contacts.find((c) => c.id === deal.contactId) : undefined;
  const isWide = Platform.OS === 'web' && Dimensions.get('window').width >= 900;

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => {
    const found = deals.find((d) => d.id === id);
    if (found) setLocalDeal(found);
  }, [id, deals]);

  /** Aplica atualização otimista no estado local e persiste a alteração da negociação. */
  const handleUpdate = async (patch: Partial<Deal>) => {
    if (!deal) return;
    setLocalDeal((prev) => prev ? { ...prev, ...patch } : prev);
    await updateDeal(deal.id, patch);
  };

  if (!deal) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  /** Retorna o componente da aba atualmente selecionada. */
  const tabContent = () => {
    switch (activeTab) {
      case 'history':   return <DealHistoryTab dealId={deal.id} contactId={deal.contactId} />;
      case 'tasks':     return <DealTasksTab dealId={deal.id} />;
      case 'products':  return <DealProductsTab dealId={deal.id} />;
      case 'files':     return <DealFilesTab />;
      case 'email':     return <DealEmailTab contact={contact} />;
      case 'proposals': return <DealProposalsTab />;
    }
  };

  const tabBar = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <DealHeader deal={deal} onUpdate={handleUpdate} />
      <DealTagRow deal={deal} />
      <DealStageBar deal={deal} />

      {isWide ? (
        <View style={styles.twoCol}>
          <View style={styles.leftCol}>
            <DealLeftPanel deal={deal} contact={contact} onUpdateDeal={handleUpdate} />
          </View>
          <View style={styles.rightCol}>
            {tabBar}
            <View style={styles.tabContent}>{tabContent()}</View>
          </View>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <DealLeftPanel deal={deal} contact={contact} onUpdateDeal={handleUpdate} />
          <View style={styles.rightColMobile}>
            {tabBar}
            <View style={{ minHeight: 400 }}>{tabContent()}</View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.gray[400], fontSize: FONTS.base },
  twoCol: { flex: 1, flexDirection: 'row' },
  leftCol: { width: 300, borderRightWidth: 1, borderRightColor: COLORS.gray[100], backgroundColor: COLORS.white },
  rightCol: { flex: 1, backgroundColor: COLORS.white },
  rightColMobile: { backgroundColor: COLORS.white },
  tabBar: { borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], backgroundColor: COLORS.white },
  tabBarContent: { flexDirection: 'row', paddingHorizontal: SPACING.md },
  tab: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 4,
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[500] },
  tabTextActive: { color: COLORS.primary },
  tabContent: { flex: 1 },
});
