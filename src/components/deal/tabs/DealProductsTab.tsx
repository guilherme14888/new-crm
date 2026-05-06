import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList, TextInput } from 'react-native';
import { useProductStore } from '../../../stores/productStore';
import { formatCurrency } from '../../../utils/currency';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

interface Props { dealId: string; }

export function DealProductsTab({ dealId }: Props) {
  const { catalog, dealProducts, loadCatalog, loadDealProducts, addProductToDeal, removeProductFromDeal } = useProductStore();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [discount, setDiscount] = useState('0');

  useEffect(() => {
    loadCatalog();
    loadDealProducts(dealId);
  }, [dealId]);

  const handleAdd = async () => {
    if (!selectedProductId) return;
    await addProductToDeal(dealId, {
      productId: selectedProductId,
      quantity: parseFloat(qty) || 1,
      discount: parseFloat(discount) || 0,
    });
    setShowPicker(false);
    setSelectedProductId(''); setQty('1'); setDiscount('0');
  };

  const total = dealProducts.reduce((sum, dp) => {
    const subtotal = dp.quantity * dp.unitPrice * (1 - dp.discount / 100);
    return sum + subtotal;
  }, 0);

  return (
    <View style={styles.container}>
      <Pressable style={styles.addBtn} onPress={() => setShowPicker(true)}>
        <Text style={styles.addBtnText}>+ Adicionar Produto</Text>
      </Pressable>

      {dealProducts.length === 0 ? (
        <Text style={styles.empty}>Nenhum produto adicionado.</Text>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={[styles.col, { flex: 2 }]}>Produto</Text>
            <Text style={[styles.col, styles.colRight]}>Qtd</Text>
            <Text style={[styles.col, styles.colRight]}>Preço</Text>
            <Text style={[styles.col, styles.colRight]}>Desc.</Text>
            <Text style={[styles.col, styles.colRight]}>Total</Text>
            <Text style={{ width: 32 }} />
          </View>
          {dealProducts.map((dp) => {
            const subtotal = dp.quantity * dp.unitPrice * (1 - dp.discount / 100);
            return (
              <View key={dp.id} style={styles.tableRow}>
                <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{dp.productName}</Text>
                <Text style={[styles.cell, styles.colRight]}>{dp.quantity}</Text>
                <Text style={[styles.cell, styles.colRight]}>{formatCurrency(dp.unitPrice)}</Text>
                <Text style={[styles.cell, styles.colRight]}>{dp.discount}%</Text>
                <Text style={[styles.cell, styles.colRight]}>{formatCurrency(Math.round(subtotal))}</Text>
                <Pressable onPress={() => removeProductFromDeal(dealId, dp.id)}>
                  <Text style={styles.removeBtn}>×</Text>
                </Pressable>
              </View>
            );
          })}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(Math.round(total))}</Text>
          </View>
        </>
      )}

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Adicionar Produto</Text>
            <FlatList
              data={catalog}
              keyExtractor={(p) => p.id}
              style={{ maxHeight: 200, marginBottom: SPACING.md }}
              renderItem={({ item: p }) => (
                <Pressable
                  style={[styles.productItem, selectedProductId === p.id && styles.productItemActive]}
                  onPress={() => setSelectedProductId(p.id)}
                >
                  <Text style={[styles.productName, selectedProductId === p.id && { color: COLORS.primary }]}>{p.name}</Text>
                  <Text style={styles.productPrice}>{formatCurrency(p.unitPrice)}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum produto no catálogo. Adicione em Configurações.</Text>}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Quantidade</Text>
                <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Desconto (%)</Text>
                <TextInput style={styles.input} value={discount} onChangeText={setDiscount} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowPicker(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, !selectedProductId && styles.saveBtnDisabled]} onPress={handleAdd} disabled={!selectedProductId}>
                <Text style={styles.saveText}>Adicionar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md },
  addBtn: { padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', marginBottom: SPACING.md },
  addBtnText: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.gray[400], paddingVertical: SPACING.xl, fontSize: FONTS.sm },
  tableHeader: { flexDirection: 'row', paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.gray[200], marginBottom: SPACING.xs },
  col: { flex: 1, fontSize: FONTS.xs, color: COLORS.gray[500], fontWeight: '700', textTransform: 'uppercase' },
  colRight: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100], alignItems: 'center' },
  cell: { flex: 1, fontSize: FONTS.sm, color: COLORS.gray[800] },
  removeBtn: { width: 32, textAlign: 'center', fontSize: 20, color: COLORS.gray[400] },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: SPACING.md, gap: SPACING.md },
  totalLabel: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.gray[700] },
  totalValue: { fontSize: FONTS.base, fontWeight: '800', color: COLORS.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 380, maxWidth: '92%' },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.gray[900], marginBottom: SPACING.md },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  productItemActive: { backgroundColor: '#eff6ff' },
  productName: { fontSize: FONTS.sm, color: COLORS.gray[800], fontWeight: '500' },
  productPrice: { fontSize: FONTS.sm, color: COLORS.gray[500] },
  row: { flexDirection: 'row', gap: SPACING.md },
  inputLabel: { fontSize: FONTS.xs, color: COLORS.gray[500], fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: FONTS.sm, color: COLORS.gray[900] },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  cancelBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' },
  cancelText: { color: COLORS.gray[600], fontSize: FONTS.sm, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: COLORS.gray[300] },
  saveText: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '700' },
});
