import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useUIStore } from '../../../stores/uiStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

export function DealFilesTab() {
  const showToast = useUIStore((s) => s.showToast);
  return (
    <View style={styles.container}>
      <Pressable style={styles.uploadBtn} onPress={() => showToast('Upload de arquivos disponível em breve')}>
        <Text style={styles.uploadIcon}>📎</Text>
        <Text style={styles.uploadText}>Anexar Arquivo</Text>
      </Pressable>
      <Text style={styles.empty}>Nenhum arquivo anexado.</Text>
      <Text style={styles.hint}>Você poderá anexar documentos, propostas e imagens à esta negociação.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 2,
    borderStyle: 'dashed', borderColor: COLORS.primary, marginBottom: SPACING.xl,
  },
  uploadIcon: { fontSize: 20 },
  uploadText: { color: COLORS.primary, fontSize: FONTS.base, fontWeight: '600' },
  empty: { fontSize: FONTS.base, color: COLORS.gray[500], marginBottom: SPACING.sm },
  hint: { fontSize: FONTS.sm, color: COLORS.gray[400], textAlign: 'center', maxWidth: 300 },
});
