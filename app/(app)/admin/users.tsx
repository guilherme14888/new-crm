import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert, Platform,
} from 'react-native';
import { useCRMUserStore } from '../../../src/stores/crmUserStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { CRMUser, UserRole } from '../../../src/types/models';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';

const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', manager: 'Gerente', user: 'Usuário' };
const ROLE_COLORS: Record<UserRole, string> = { admin: '#7c3aed', manager: '#0891b2', user: '#4b5563' };

interface UserForm { email: string; displayName: string; role: UserRole; }
const emptyForm = (): UserForm => ({ email: '', displayName: '', role: 'user' });

export default function AdminUsersScreen() {
  const { users, isLoading, loadUsers, createUser, updateUser, deleteUser } = useCRMUserStore();
  const currentUser = useAuthStore((s) => s.user);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<CRMUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [search, setSearch] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditingUser(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (u: CRMUser) => {
    setEditingUser(u);
    setForm({ email: u.email, displayName: u.displayName, role: u.role });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.email.trim() || !form.displayName.trim()) return;
    if (editingUser) {
      await updateUser(editingUser.id, { displayName: form.displayName.trim(), role: form.role });
    } else {
      await createUser({ email: form.email.trim(), displayName: form.displayName.trim(), role: form.role, avatarUrl: null });
    }
    setShowModal(false);
  };

  const confirmToggleActive = (u: CRMUser) => {
    if (u.id === currentUser?.id) return;
    const label = u.isActive ? 'Desativar' : 'Ativar';
    const doToggle = () => updateUser(u.id, { isActive: !u.isActive });
    if (Platform.OS === 'web') {
      if (window.confirm(`${label} usuário "${u.displayName}"?`)) doToggle();
    } else {
      Alert.alert(label, `${label} "${u.displayName}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: label, onPress: doToggle },
      ]);
    }
  };

  const confirmDelete = (u: CRMUser) => {
    if (u.id === currentUser?.id) return;
    const doDelete = () => deleteUser(u.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir usuário "${u.displayName}"?`)) doDelete();
    } else {
      Alert.alert('Excluir', `Excluir "${u.displayName}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Usuários</Text>
          <Text style={styles.sub}>{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ Novo Usuário</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Table */}
      <ScrollView style={styles.list}>
        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Usuário</Text>
          <Text style={[styles.th, { flex: 1 }]}>Papel</Text>
          <Text style={[styles.th, { flex: 1 }]}>Status</Text>
          <Text style={[styles.th, { width: 120 }]}>Ações</Text>
        </View>

        {filtered.map((u) => (
          <View key={u.id} style={[styles.tableRow, !u.isActive && styles.rowInactive]}>
            <View style={[styles.td, { flex: 2 }]}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>{u.displayName[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.userName}>
                  {u.displayName}
                  {u.id === currentUser?.id && <Text style={styles.youBadge}> (você)</Text>}
                </Text>
                <Text style={styles.userEmail}>{u.email}</Text>
              </View>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[u.role] + '18' }]}>
                <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[u.role] }]}>
                  {ROLE_LABELS[u.role]}
                </Text>
              </View>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <View style={[styles.statusDot, { backgroundColor: u.isActive ? COLORS.success : COLORS.gray[300] }]} />
              <Text style={[styles.statusText, { color: u.isActive ? COLORS.success : COLORS.gray[400] }]}>
                {u.isActive ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
            <View style={[styles.td, { width: 120, gap: SPACING.xs }]}>
              <Pressable style={styles.iconBtn} onPress={() => openEdit(u)}>
                <Text style={styles.iconBtnText}>✏️</Text>
              </Pressable>
              {u.id !== currentUser?.id && (
                <>
                  <Pressable style={styles.iconBtn} onPress={() => confirmToggleActive(u)}>
                    <Text style={styles.iconBtnText}>{u.isActive ? '🚫' : '✅'}</Text>
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => confirmDelete(u)}>
                    <Text style={styles.iconBtnText}>🗑</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))}

        {filtered.length === 0 && !isLoading && (
          <Text style={styles.empty}>Nenhum usuário encontrado.</Text>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</Text>

            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={styles.input}
              value={form.displayName}
              onChangeText={(v) => setForm((f) => ({ ...f, displayName: v }))}
              placeholder="Nome completo"
              autoFocus
            />

            <Text style={styles.label}>E-mail *</Text>
            <TextInput
              style={[styles.input, !!editingUser && styles.inputDisabled]}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="email@empresa.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!editingUser}
            />

            <Text style={styles.label}>Papel</Text>
            <View style={styles.roleRow}>
              {(['admin', 'manager', 'user'] as UserRole[]).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, form.role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                  onPress={() => setForm((f) => ({ ...f, role: r }))}
                >
                  <Text style={[styles.roleBtnText, form.role === r && { color: COLORS.white }]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, (!form.email.trim() || !form.displayName.trim()) && styles.disabledBtn]}
                onPress={handleSave}
              >
                <Text style={styles.confirmBtnText}>{editingUser ? 'Salvar' : 'Criar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  title: { fontSize: FONTS['2xl'], fontWeight: '700', color: COLORS.gray[900] },
  sub: { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  addBtnText: { color: COLORS.white, fontWeight: '600', fontSize: FONTS.base },
  searchBar: { padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  searchInput: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.base, color: COLORS.gray[900], backgroundColor: COLORS.gray[50],
  },
  list: { flex: 1 },
  tableHeader: {
    flexDirection: 'row', backgroundColor: COLORS.gray[50],
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  th: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[500], textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[50],
    backgroundColor: COLORS.white,
  },
  rowInactive: { opacity: 0.55 },
  td: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
  userName: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900] },
  youBadge: { fontSize: FONTS.sm, color: COLORS.gray[400], fontWeight: '400' },
  userEmail: { fontSize: FONTS.sm, color: COLORS.gray[400] },
  roleBadge: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  roleBadgeText: { fontSize: FONTS.sm, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FONTS.sm, fontWeight: '500' },
  iconBtn: { padding: 4 },
  iconBtnText: { fontSize: 16 },
  empty: { textAlign: 'center', color: COLORS.gray[400], margin: SPACING.xl },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 440, maxWidth: '92%' as unknown as number },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.lg },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.base, color: COLORS.gray[900], marginBottom: SPACING.md, backgroundColor: COLORS.white,
  },
  inputDisabled: { backgroundColor: COLORS.gray[50], color: COLORS.gray[400] },
  roleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  roleBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center',
  },
  roleBtnText: { fontSize: FONTS.sm, color: COLORS.gray[600], fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end', marginTop: SPACING.sm },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gray[100] },
  cancelBtnText: { color: COLORS.gray[600], fontWeight: '600' },
  confirmBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmBtnText: { color: COLORS.white, fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
});
