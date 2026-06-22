import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { signOut, switchCompany, listCompanies, updateProfile } from '../../services/authService';
import { useFunnelStore } from '../../stores/funnelStore';
import { useDealStore } from '../../stores/dealStore';
import { useContactStore } from '../../stores/contactStore';
import { COLORS, FONTS, SPACING, RADIUS, THEME } from '../../constants/theme';

export const SIDEBAR_W  = 220;
export const SIDEBAR_COL = 64;

interface NavItem { label: string; icon: string; href: string; children?: NavItem[]; menuKey?: string }

const BASE_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     icon: '📊', href: '/(app)/(tabs)/dashboard', menuKey: 'menu_dashboard' },
  { label: 'Órgãos',         icon: '👥', href: '/(app)/(tabs)/contacts', menuKey: 'menu_contacts' },
  { label: 'Boletim',       icon: '📰', href: '/(app)/boletim', menuKey: 'menu_boletim' },
  { label: 'Licitações',   icon: '🤝', href: '/(app)/(tabs)/negotiations', menuKey: 'menu_negotiations' },
  { label: 'Relatórios',    icon: '📈', href: '/(app)/reports', menuKey: 'menu_reports' },
  {
    label: 'Inteligência de Mercado', icon: '🧠', href: '/(app)/market-intelligence', menuKey: 'menu_market_intelligence',
    children: [
      { label: 'Dashboard', icon: '📊', href: '/(app)/market-intelligence/dashboard' },
      { label: 'Listagem',  icon: '📋', href: '/(app)/market-intelligence/listagem' },
    ],
  },
];
const SETTINGS_NAV: NavItem = { label: 'Configurações', icon: '⚙️', href: '/(app)/settings', menuKey: 'menu_settings' };
const FINANCE_NAV: NavItem  = { label: 'Financeiro',     icon: '💰', href: '/(app)/finance', menuKey: 'menu_finance' };

// ─── Company Switcher Modal ───────────────────────────────────────────────────
/** Modal para alternar entre empresas/tenants: lista as empresas disponíveis e troca o contexto recarregando dados. */
function CompanySwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user        = useAuthStore((s) => s.user);
  const router      = useRouter();
  const loadFunnels  = useFunnelStore((s) => s.loadFunnels);
  const loadDeals    = useDealStore((s) => s.loadDeals);
  const loadContacts = useContactStore((s) => s.loadContacts);

  const [companies, setCompanies] = useState<{ id: string; name: string; slug: string; plan: string; isActive: boolean }[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError]         = useState('');

  const MASTER_ID = '00000000-0000-0000-0000-000000000001';
  useEffect(() => {
    if (!visible) return;
    setError('');
    listCompanies()
      .then((list) => {
        // A tenant Default fica SEMPRE em primeiro; as demais por nome.
        const sorted = [...list].sort((a, b) =>
          a.id === MASTER_ID ? -1 : b.id === MASTER_ID ? 1 : a.name.localeCompare(b.name));
        setCompanies(sorted);
      })
      .catch((e) => setError(e?.message ?? 'Erro ao carregar empresas'));
  }, [visible]);

  // Troca a empresa ativa, recarrega funis/deals/contatos e navega para o dashboard.
  const handleSwitch = async (companyId: string) => {
    if (companyId === user?.companyId) { onClose(); return; }
    setSwitching(companyId);
    try {
      await switchCompany(companyId);
      await Promise.all([loadFunnels(), loadDeals(), loadContacts()]);
      onClose();
      router.replace('/(app)/(tabs)/dashboard');
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao trocar empresa');
    } finally { setSwitching(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={ms.modal} onPress={(e) => e.stopPropagation()}>
          <Text style={ms.title}>Trocar Empresa</Text>
          {error ? <Text style={ms.error}>{error}</Text> : null}
          <ScrollView style={{ maxHeight: 340 }}>
            {companies.map((c) => {
              const active = c.id === user?.companyId;
              const busy   = switching === c.id;
              return (
                <Pressable key={c.id} style={[ms.companyRow, active && ms.companyRowActive]} onPress={() => handleSwitch(c.id)}>
                  <View style={ms.companyLeft}>
                    <Text style={[ms.companyName, active && ms.companyNameActive]} numberOfLines={1}>{c.name}</Text>
                    <Text style={ms.companySlug}>{c.slug}</Text>
                  </View>
                  <View style={ms.companyRight}>
                    <Text style={[ms.planBadge, { color: c.plan === 'enterprise' ? '#7c3aed' : c.plan === 'pro' ? '#0891b2' : '#16a34a' }]}>
                      {c.plan.toUpperCase()}
                    </Text>
                    {active && <Text style={ms.activeBadge}>✓ Ativa</Text>}
                    {busy   && <ActivityIndicator size="small" color={COLORS.primary} />}
                  </View>
                </Pressable>
              );
            })}
            {companies.length === 0 && !error && (
              <Text style={{ color: COLORS.gray[400], textAlign: 'center', padding: SPACING.lg }}>Carregando...</Text>
            )}
          </ScrollView>
          <Pressable style={ms.closeBtn} onPress={onClose}>
            <Text style={ms.closeTxt}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
/** Modal de perfil do usuário: edita nome, avatar (com redimensionamento na web) e troca de senha. */
function ProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);

  const [displayName, setDisplayName]     = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd]       = useState('');
  const [newPwd, setNewPwd]               = useState('');
  const [confirmPwd, setConfirmPwd]       = useState('');
  const [showPwd, setShowPwd]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');
  const fileInputRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setDisplayName(user?.displayName ?? '');
      setAvatarPreview(user?.avatarUrl ?? null);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setError(''); setSuccess('');
    }
  }, [visible, user?.displayName, user?.avatarUrl]);

  // Abre o seletor de arquivo de imagem (apenas web) para escolher um novo avatar.
  const pickAvatar = () => {
    if (Platform.OS === 'web' && fileInputRef.current) fileInputRef.current.click();
  };

  // Lê a imagem escolhida, redimensiona para no máximo 256px e gera o preview em data URL JPEG.
  const onFileChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = (document as any).createElement('img');
      img.onload = () => {
        const maxSize = 256;
        let { width, height } = img;
        if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
        else { width = Math.round(width * maxSize / height); height = maxSize; }
        const canvas = (document as any).createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setAvatarPreview(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target!.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Valida os campos, persiste nome/avatar/senha via updateProfile e exibe feedback de sucesso ou erro.
  const handleSave = async () => {
    setError(''); setSuccess('');
    if (!displayName.trim()) { setError('Nome é obrigatório'); return; }
    if (newPwd && newPwd.length < 8) { setError('Nova senha deve ter pelo menos 8 caracteres'); return; }
    if (newPwd && newPwd !== confirmPwd) { setError('As senhas não coincidem'); return; }
    if (newPwd && !currentPwd) { setError('Informe a senha atual para alterá-la'); return; }
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatarUrl: avatarPreview,
        ...(newPwd ? { password: newPwd, currentPassword: currentPwd } : {}),
      });
      setSuccess('Perfil atualizado com sucesso!');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar perfil');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={[ms.modal, { width: 360 }]} onPress={(e) => e.stopPropagation()}>
          <Text style={ms.title}>Meu Perfil</Text>

          <View style={pf.avatarSection}>
            <Pressable style={pf.avatarWrap} onPress={pickAvatar}>
              {avatarPreview
                ? <Image source={{ uri: avatarPreview }} style={pf.avatarImg} />
                : <View style={pf.avatar}><Text style={pf.avatarTxt}>{(user?.displayName ?? 'U')[0].toUpperCase()}</Text></View>
              }
              <View style={pf.cameraOverlay}><Text style={pf.cameraIcon}>📷</Text></View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={pf.role}>{user?.role ?? ''}</Text>
              <Text style={pf.email}>{user?.email ?? ''}</Text>
              <Pressable onPress={pickAvatar}><Text style={pf.changePhotoTxt}>Alterar foto</Text></Pressable>
            </View>
          </View>

          {Platform.OS === 'web' && (
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
          )}

          {error   && <View style={pf.errorBanner}><Text style={pf.errorTxt}>⚠ {error}</Text></View>}
          {success && <View style={pf.successBanner}><Text style={pf.successTxt}>✓ {success}</Text></View>}

          <Text style={pf.label}>Nome *</Text>
          <TextInput style={pf.input} value={displayName} onChangeText={setDisplayName} placeholder="Seu nome" />

          <Text style={[pf.label, { marginTop: SPACING.md }]}>Alterar senha</Text>
          <Text style={pf.hint}>Deixe em branco para manter a senha atual</Text>
          <TextInput style={pf.input} value={currentPwd} onChangeText={setCurrentPwd} placeholder="Senha atual" secureTextEntry={!showPwd} />
          <TextInput style={pf.input} value={newPwd} onChangeText={setNewPwd} placeholder="Nova senha (mín. 8 caracteres)" secureTextEntry={!showPwd} />
          <TextInput style={pf.input} value={confirmPwd} onChangeText={setConfirmPwd} placeholder="Confirmar nova senha" secureTextEntry={!showPwd} />
          <Pressable onPress={() => setShowPwd((v) => !v)} style={{ marginBottom: SPACING.md }}>
            <Text style={{ fontSize: FONTS.sm, color: COLORS.primary }}>{showPwd ? '🙈 Ocultar senhas' : '👁 Mostrar senhas'}</Text>
          </Pressable>

          <View style={pf.btnRow}>
            <Pressable style={pf.cancelBtn} onPress={onClose}><Text style={pf.cancelTxt}>Fechar</Text></Pressable>
            <Pressable style={[pf.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={pf.saveTxt}>{saving ? 'Salvando...' : 'Salvar'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
/** Barra lateral de navegação: links principais (com itens condicionais por papel), modos recolhido/mobile e ações de perfil, troca de empresa e logout. */
export function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const user     = useAuthStore((s) => s.user);
  const collapsed       = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar   = useUIStore((s) => s.toggleSidebar);
  const mobileOpen      = useUIStore((s) => s.sidebarMobileOpen);
  const setMobileOpen   = useUIStore((s) => s.setSidebarMobileOpen);

  const isAdmin         = user?.role === 'admin';
  const canFinance      = user?.role === 'admin' || user?.role === 'manager';
  // Visibilidade por perfil ACL: menu aparece a menos que explicitamente desligado.
  const perms = user?.permissions;
  const menuVisible = (key?: string) => !key || !perms || perms[key] !== false;
  // Histórico de Mineração: SÓ o operador Default (empresa master + admin) ou quem tem
  // o grant mining_history_view no perfil — admin de filha NÃO fura (booleano do servidor).
  const canMining = !!user?.canMiningHistory;
  const baseItems = BASE_NAV_ITEMS.map((it) =>
    (it.menuKey === 'menu_market_intelligence' && canMining)
      ? { ...it, children: [...(it.children ?? []), { label: 'Histórico de Mineração', icon: '⛏️', href: '/(app)/market-intelligence/historico' }] }
      : it
  );
  // Só usuários criados na tenant Default podem trocar de empresa (filhas: nunca aparece).
  const canSwitchCompany = !!user?.isDefaultTenantUser;
  const NAV_ITEMS = [
    ...baseItems,
    ...(canFinance ? [FINANCE_NAV] : []),
    SETTINGS_NAV,                       // Configurações é SEMPRE o último da lista
  ].filter((item) => menuVisible(item.menuKey));

  const [menuOpen, setMenuOpen]                   = useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [showProfile, setShowProfile]             = useState(false);

  // Encerra a sessão do usuário e redireciona para a tela de login.
  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/(auth)/login');
  };

  // Indica se um item de navegação corresponde à rota atual (ignorando os grupos de rota do Expo).
  const isActive = (href: string) => {
    const clean = href.replace('/(app)', '').replace('/(tabs)', '');
    return pathname === clean || pathname.startsWith(clean + '/');
  };

  const sidebarContent = (
    <View style={[st.sidebar, collapsed && st.sidebarCollapsed]}>
      {/* Header with toggle */}
      <View style={[st.header, collapsed && st.headerCollapsed]}>
        {!collapsed && (
          <View style={st.logo}>
            {user?.companyLogo ? (
              <View style={st.logoWrap}>
                <Image source={{ uri: user.companyLogo }} style={st.logoImg} resizeMode="contain" />
                {/* Miniatura do logo da Default sobreposta no canto sup. direito (só nas filhas). */}
                {!user.isMasterCompany && user.masterLogo ? (
                  <Image source={{ uri: user.masterLogo }} style={st.logoBadge} resizeMode="contain" />
                ) : null}
              </View>
            ) : (
              <>
                <Text style={st.logoText}>CRM</Text>
                <Text style={st.logoSub} numberOfLines={1}>{user?.companyName || 'Workspace'}</Text>
              </>
            )}
          </View>
        )}
        <Pressable
          onPress={toggleSidebar}
          hitSlop={8}
          style={({ hovered, pressed }: any) => [
            st.toggleBtn,
            hovered && st.toggleBtnHover,
            pressed && st.toggleBtnPressed,
          ]}
          {...(Platform.OS === 'web' ? { 'aria-label': collapsed ? 'Expandir menu' : 'Recolher menu', title: collapsed ? 'Expandir menu' : 'Recolher menu' } as any : {})}
        >
          <Text style={st.toggleIcon}>{collapsed ? '›' : '‹'}</Text>
        </Pressable>
      </View>

      {/* Nav */}
      <ScrollView style={st.nav} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const go = (href: string) => { setMobileOpen(false); setMenuOpen(false); router.push(href as never); };
          const expanded = !collapsed && !!item.children && active;
          return (
            <View key={item.href}>
              <Pressable
                style={[st.navItem, active && st.navItemActive, collapsed && st.navItemCollapsed]}
                onPress={() => go(item.children ? item.children[0].href : item.href)}
              >
                <Text style={[st.navIcon, collapsed && st.navIconCollapsed]}>{item.icon}</Text>
                {!collapsed && <Text style={[st.navLabel, active && st.navLabelActive]}>{item.label}</Text>}
                {!collapsed && item.children && <Text style={st.navCaret}>{expanded ? '▾' : '▸'}</Text>}
              </Pressable>
              {expanded && item.children!.map((child) => {
                const childActive = isActive(child.href);
                return (
                  <Pressable
                    key={child.href}
                    style={[st.subItem, childActive && st.subItemActive]}
                    onPress={() => go(child.href)}
                  >
                    <Text style={[st.subIcon, childActive && { opacity: 1 }]}>{child.icon}</Text>
                    <Text style={[st.subLabel, childActive && st.subLabelActive]}>{child.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Inline dropdown */}
      {menuOpen && !collapsed && (
        <View style={st.dropMenu}>
          <Pressable style={st.dropItem} onPress={() => { setMenuOpen(false); setShowProfile(true); }}>
            <Text style={st.dropIcon}>👤</Text>
            <Text style={st.dropLabel}>Meu Perfil</Text>
          </Pressable>
          {canSwitchCompany && (
            <>
              <View style={st.dropDivider} />
              <Pressable style={st.dropItem} onPress={() => { setMenuOpen(false); setShowCompanySwitcher(true); }}>
                <Text style={st.dropIcon}>🏢</Text>
                <Text style={st.dropLabel}>Trocar Empresa</Text>
              </Pressable>
            </>
          )}
          <View style={st.dropDivider} />
          <Pressable style={[st.dropItem, { paddingBottom: SPACING.sm }]} onPress={handleSignOut}>
            <Text style={st.dropIcon}>🚪</Text>
            <Text style={[st.dropLabel, { color: '#ef4444' }]}>Sair</Text>
          </Pressable>
        </View>
      )}

      {/* Collapsed icon actions */}
      {collapsed && (
        <View style={st.collapsedActions}>
          <Pressable style={st.collapsedActionBtn} onPress={() => { setShowProfile(true); }}>
            <Text style={st.collapsedActionIcon}>👤</Text>
          </Pressable>
          {canSwitchCompany && (
            <Pressable style={st.collapsedActionBtn} onPress={() => { setShowCompanySwitcher(true); }}>
              <Text style={st.collapsedActionIcon}>🏢</Text>
            </Pressable>
          )}
          <Pressable style={st.collapsedActionBtn} onPress={handleSignOut}>
            <Text style={st.collapsedActionIcon}>🚪</Text>
          </Pressable>
        </View>
      )}

      {/* User footer */}
      {!collapsed && (
        <Pressable style={[st.footer, menuOpen && st.footerActive]} onPress={() => setMenuOpen((v) => !v)}>
          <View style={st.userRow}>
            {user?.avatarUrl
              ? <Image source={{ uri: user.avatarUrl }} style={st.avatarImg} />
              : <View style={st.avatar}><Text style={st.avatarText}>{(user?.displayName ?? 'U')[0].toUpperCase()}</Text></View>
            }
            <View style={st.userInfo}>
              <Text style={st.userName} numberOfLines={1}>{user?.displayName ?? 'Usuário'}</Text>
              <Text style={st.userEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
            </View>
            <Text style={st.chevron}>{menuOpen ? '▲' : '▼'}</Text>
          </View>
        </Pressable>
      )}

      <CompanySwitcherModal visible={showCompanySwitcher} onClose={() => setShowCompanySwitcher(false)} />
      <ProfileModal         visible={showProfile}         onClose={() => setShowProfile(false)} />
    </View>
  );

  // Mobile: render as overlay drawer
  if (Platform.OS === 'web') {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const effectiveWidth = collapsed ? SIDEBAR_COL : SIDEBAR_W;
    return (
      <>
        {/* Mobile overlay backdrop */}
        {mobileOpen && (
          <Pressable style={st.backdrop} onPress={() => setMobileOpen(false)} />
        )}
        {/* On mobile web, position as overlay when open */}
        <View style={[
          st.sidebarWrapper,
          collapsed && st.sidebarWrapperCollapsed,
          // Mobile: absolute overlay; respect collapsed width here too
          isMobile
            ? (mobileOpen
                ? [st.sidebarWrapperMobileOpen, { width: effectiveWidth }]
                : [st.sidebarWrapperMobileHidden, { width: effectiveWidth, left: -effectiveWidth - 10 }])
            : undefined,
        ]}>
          {sidebarContent}
        </View>
      </>
    );
  }

  return sidebarContent;
}

// ─── Hamburger button (for mobile web — rendered in layout) ──────────────────
/** Botão de menu (hambúrguer) que abre/fecha a sidebar no modo mobile web. */
export function HamburgerButton() {
  const setMobileOpen = useUIStore((s) => s.setSidebarMobileOpen);
  const mobileOpen    = useUIStore((s) => s.sidebarMobileOpen);
  return (
    <Pressable style={hb.btn} onPress={() => setMobileOpen(!mobileOpen)}>
      <Text style={hb.icon}>{mobileOpen ? '✕' : '☰'}</Text>
    </Pressable>
  );
}
const hb = StyleSheet.create({
  btn:  { padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100], margin: SPACING.sm },
  icon: { fontSize: 20, color: COLORS.gray[700] },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  sidebarWrapper:           { flexShrink: 0, width: SIDEBAR_W, transition: 'width 0.25s ease' } as any,
  sidebarWrapperCollapsed:  { width: SIDEBAR_COL } as any,
  sidebarWrapperMobileOpen: { position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100, width: SIDEBAR_W, boxShadow: '4px 0 20px rgba(0,0,0,0.25)' } as any,
  sidebarWrapperMobileHidden: { position: 'fixed', left: -SIDEBAR_W - 10, top: 0, bottom: 0, zIndex: 100, width: SIDEBAR_W, transition: 'left 0.25s ease' } as any,

  backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 99 } as any,

  sidebar:          { backgroundColor: THEME.sidebarBg, height: '100%' as any, flexDirection: 'column', overflow: 'hidden' as any },
  sidebarCollapsed: {},

  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl, borderBottomWidth: 1, borderBottomColor: THEME.sidebarBorder },
  headerCollapsed:  { justifyContent: 'center', paddingHorizontal: SPACING.sm },

  logo:    { flex: 1 },
  logoText:{ fontSize: FONTS['2xl'], fontWeight: '900', color: COLORS.primary, letterSpacing: 2 },
  logoSub: { fontSize: FONTS.sm, color: THEME.sidebarTextFaint, marginTop: 2 },
  logoWrap:{ position: 'relative', alignSelf: 'flex-start', maxWidth: 170 },
  logoImg: { width: 160, height: 46 },
  // Miniatura da Default (canto sup. ESQUERDO), SEM fundo — mescla com a cor da sidebar
  // (um PNG transparente fica sobre o navy; sem caixa branca).
  logoBadge:{ position: 'absolute', top: -7, left: -7, width: 30, height: 30, backgroundColor: 'transparent' },

  // Sem círculo: apenas o chevron. Pequena área de toque + micro-interação no hover/press.
  toggleBtn: {
    paddingHorizontal: SPACING.xs, paddingVertical: SPACING.xs,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer', transitionProperty: 'opacity, transform', transitionDuration: '150ms', transitionTimingFunction: 'ease' } as any
      : {}),
  },
  toggleBtnHover:   { opacity: 0.7, transform: [{ scale: 1.12 }] },
  toggleBtnPressed: { opacity: 0.5, transform: [{ scale: 0.9 }] },
  // Cor SEGUE a fonte da sidebar (THEME.sidebarText) → visível em qualquer tema.
  toggleIcon:       { fontSize: 26, lineHeight: 26, color: THEME.sidebarText, fontWeight: '600', textAlign: 'center', includeFontPadding: false as any },

  nav:           { flex: 1, paddingTop: SPACING.md },
  navItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, marginHorizontal: SPACING.sm, marginVertical: 2, borderRadius: RADIUS.md, gap: SPACING.sm },
  navItemActive: { backgroundColor: COLORS.primary + '22' },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0, marginHorizontal: SPACING.xs },
  navIcon:          { fontSize: 18, width: 24, textAlign: 'center' },
  navIconCollapsed: { fontSize: 20, width: 'auto' as any },
  navLabel:         { fontSize: FONTS.base, color: THEME.sidebarTextDim, fontWeight: '400', flex: 1 },
  navLabelActive:   { color: COLORS.primary, fontWeight: '600' },
  navCaret:         { fontSize: 11, color: THEME.sidebarTextFaint },

  subItem:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, paddingLeft: SPACING.xl + SPACING.md, paddingRight: SPACING.lg, marginHorizontal: SPACING.sm, marginVertical: 1, borderRadius: RADIUS.md },
  subItemActive:  { backgroundColor: COLORS.primary + '22' },
  subIcon:        { fontSize: 13, width: 18, textAlign: 'center', opacity: 0.7 },
  subLabel:       { fontSize: FONTS.sm, color: THEME.sidebarTextFaint, fontWeight: '400' },
  subLabelActive: { color: COLORS.primary, fontWeight: '600' },

  collapsedActions:    { borderTopWidth: 1, borderTopColor: THEME.sidebarBorder, paddingVertical: SPACING.sm },
  collapsedActionBtn:  { alignItems: 'center', paddingVertical: SPACING.sm },
  collapsedActionIcon: { fontSize: 18 },

  dropMenu:    { backgroundColor: THEME.sidebarHover, borderTopWidth: 1, borderTopColor: THEME.sidebarBorder },
  dropItem:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  dropIcon:    { fontSize: 14, width: 20, textAlign: 'center' },
  dropLabel:   { fontSize: FONTS.sm, color: THEME.sidebarTextDim, fontWeight: '500' },
  dropDivider: { height: 1, backgroundColor: THEME.sidebarBorder, marginHorizontal: SPACING.lg },

  footer:       { padding: SPACING.md, borderTopWidth: 1, borderTopColor: THEME.sidebarBorder },
  footerActive: { backgroundColor: THEME.sidebarHover },
  userRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImg:    { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  avatarText:   { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
  userInfo:     { flex: 1, overflow: 'hidden' as any },
  userName:     { fontSize: FONTS.sm, fontWeight: '600', color: THEME.sidebarText },
  userEmail:    { fontSize: 11, color: THEME.sidebarTextFaint },
  chevron:      { fontSize: 10, color: THEME.sidebarTextFaint },
});

// Modal styles
const ms = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal:            { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.xl, width: 340, maxWidth: '90%' as any, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },
  title:            { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.gray[900], marginBottom: SPACING.lg },
  error:            { fontSize: FONTS.sm, color: '#dc2626', marginBottom: SPACING.md, backgroundColor: '#fef2f2', padding: SPACING.sm, borderRadius: RADIUS.md },
  companyRow:       { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.gray[100] },
  companyRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '0a' },
  companyLeft:      { flex: 1 },
  companyName:      { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[800] },
  companyNameActive:{ color: COLORS.primary },
  companySlug:      { fontSize: FONTS.xs, color: COLORS.gray[400], marginTop: 2 },
  companyRight:     { alignItems: 'flex-end', gap: 4 },
  planBadge:        { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  activeBadge:      { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  closeBtn:         { marginTop: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100], alignItems: 'center' },
  closeTxt:         { fontSize: FONTS.base, color: COLORS.gray[600], fontWeight: '600' },
});

const pf = StyleSheet.create({
  avatarSection:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg, padding: SPACING.md, backgroundColor: COLORS.gray[50], borderRadius: RADIUS.md },
  avatarWrap:     { position: 'relative' as any },
  avatar:         { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImg:      { width: 56, height: 56, borderRadius: 28 },
  avatarTxt:      { color: COLORS.white, fontWeight: '800', fontSize: FONTS.xl },
  cameraOverlay:  { position: 'absolute' as any, bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.gray[700], alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  cameraIcon:     { fontSize: 10 },
  changePhotoTxt: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.xs },
  role:           { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[600], textTransform: 'capitalize' as any },
  email:          { fontSize: FONTS.sm, color: COLORS.gray[400] },
  label:          { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: 4 },
  hint:           { fontSize: 11, color: COLORS.gray[400], marginBottom: SPACING.sm },
  input:          { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.white, marginBottom: SPACING.sm },
  errorBanner:    { backgroundColor: '#fef2f2', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#fecaca' },
  errorTxt:       { fontSize: FONTS.sm, color: '#dc2626', fontWeight: '600' },
  successBanner:  { backgroundColor: '#f0fdf4', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#bbf7d0' },
  successTxt:     { fontSize: FONTS.sm, color: '#16a34a', fontWeight: '600' },
  btnRow:         { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn:      { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelTxt:      { color: COLORS.gray[600], fontWeight: '600', fontSize: FONTS.base },
  saveBtn:        { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveTxt:        { color: COLORS.white, fontWeight: '600', fontSize: FONTS.base },
});
