import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { hasValidSupplierOrderItems, RETURNED_CASE_TYPES, supplierOrderTotals } from '../components/supplierOrders/supplierOrderUtils';

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function SupplierOrdersScreen() {
  const { products, restockRecords, addRestockRecord } = useApp();
  const [supplier, setSupplier] = useState('Coca-Cola');
  const [items, setItems] = useState([]);
  const [returnedCases, setReturnedCases] = useState(RETURNED_CASE_TYPES.map(item => ({ ...item, quantity: '' })));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { width } = useWindowDimensions();
  const compact = width < 380;

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const suppliers = useMemo(() => [...new Set(products.map(product => product.supplier))], [products]);
  const supplierProducts = useMemo(() => products.filter(product => product.supplier === supplier), [products, supplier]);
  const availableProducts = supplierProducts.filter(product => !items.some(item => item.productId === product.id));
  const numericReturns = returnedCases.map(item => ({ ...item, quantity: Number(item.quantity) || 0 }));
  const totals = supplierOrderTotals(items.map(item => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unitCost: Number(item.unitCost) || 0,
  })), numericReturns);

  const changeSupplier = nextSupplier => {
    if (nextSupplier === supplier) return;
    const apply = () => {
      setSupplier(nextSupplier);
      setItems([]);
      setError('');
    };
    if (items.length) {
      Alert.alert('Change supplier?', 'Changing suppliers will clear the products in this order.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Change supplier', onPress: apply },
      ]);
      return;
    }
    apply();
  };

  const addProduct = product => {
    setItems(current => [...current, { productId: product.id, productName: product.name, quantity: '', unitCost: '' }]);
    setPickerVisible(false);
    setError('');
  };

  const updateItem = (productId, field, value) => {
    setItems(current => current.map(item => item.productId === productId ? { ...item, [field]: value } : item));
    setError('');
  };

  const updateReturnQuantity = (type, quantity) => {
    setReturnedCases(current => current.map(item => item.type === type ? { ...item, quantity } : item));
  };

  const saveOrder = () => {
    const orderItems = items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      unitCost: Number(item.unitCost) || 0,
    })).filter(item => item.quantity > 0 && item.unitCost > 0);
    if (!hasValidSupplierOrderItems(orderItems)) {
      setError('Add at least one product with a quantity and unit cost.');
      return;
    }

    const recordedReturns = numericReturns.filter(item => item.quantity > 0);
    addRestockRecord(supplier, orderItems, recordedReturns);
    setItems([]);
    setReturnedCases(RETURNED_CASE_TYPES.map(item => ({ ...item, quantity: '' })));
    setError('');
    setNotice('Supplier order saved. Inventory updated.');
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHeading}>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={styles.title}>Supplier order</Text>
            <Text style={styles.subtitle}>Record deliveries and returned-case credits.</Text>
          </View>
          <View style={styles.headingIcon}>
            <MaterialIcons name="local-shipping" size={23} color={theme.colors.primary} accessible={false} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supplier</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.supplierList}>
            {suppliers.map(name => {
              const selected = supplier === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => changeSupplier(name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.supplierChip, selected && styles.supplierChipSelected, pressed && styles.pressed]}
                >
                  <MaterialIcons name="inventory-2" size={18} color={selected ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                  <Text style={[styles.supplierLabel, selected && styles.supplierLabelSelected]}>{name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text style={styles.sectionTitle}>Products</Text>
              <Text style={styles.sectionHint}>{supplierProducts.length} products from {supplier}</Text>
            </View>
            <Pressable
              onPress={() => setPickerVisible(true)}
              disabled={!availableProducts.length}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addButton, !availableProducts.length && styles.disabled, pressed && styles.pressed]}
            >
              <MaterialIcons name="add" size={20} color={theme.colors.onPrimary} accessible={false} />
              {!compact && <Text style={styles.addButtonLabel}>Add product</Text>}
            </Pressable>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyProducts}>
              <MaterialIcons name="add-shopping-cart" size={24} color={theme.colors.textLight} accessible={false} />
              <Text style={styles.emptyTitle}>No products added</Text>
              <Text style={styles.emptyHint}>Add products from the selected supplier.</Text>
            </View>
          ) : items.map(item => (
            <View key={item.productId} style={styles.orderItem}>
              <View style={styles.orderItemHeading}>
                <View style={styles.itemIcon}>
                  <MaterialIcons name="local-drink" size={19} color={theme.colors.primary} accessible={false} />
                </View>
                <View style={styles.itemNameBlock}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>Current stock: {products.find(product => product.id === item.productId)?.totalStock ?? 0} units</Text>
                </View>
                <Pressable onPress={() => setItems(current => current.filter(row => row.productId !== item.productId))} accessibilityRole="button" accessibilityLabel={`Remove ${item.productName}`} style={styles.removeButton}>
                  <MaterialIcons name="delete-outline" size={21} color={theme.colors.danger} accessible={false} />
                </Pressable>
              </View>
              <View style={styles.fieldsRow}>
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>Quantity (units)</Text>
                  <TextInput
                    value={String(item.quantity)}
                    onChangeText={value => updateItem(item.productId, 'quantity', value)}
                    keyboardType="number-pad"
                    placeholder="0"
                    accessibilityLabel={`${item.productName} quantity in units`}
                    style={styles.input}
                  />
                </View>
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>Unit cost</Text>
                  <TextInput
                    value={String(item.unitCost)}
                    onChangeText={value => updateItem(item.productId, 'unitCost', value)}
                    keyboardType="decimal-pad"
                    placeholder="₱0.00"
                    accessibilityLabel={`${item.productName} unit cost in pesos`}
                    style={styles.input}
                  />
                </View>
                <View style={styles.lineTotal}>
                  <Text style={styles.fieldLabel}>Line total</Text>
                  <Text style={styles.lineTotalValue}>{formatPeso((Number(item.quantity) || 0) * (Number(item.unitCost) || 0))}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text style={styles.sectionTitle}>Returned cases</Text>
              <Text style={styles.sectionHint}>Credits reduce the supplier order cost.</Text>
            </View>
            <MaterialIcons name="replay" size={21} color={theme.colors.textLight} accessible={false} />
          </View>
          {returnedCases.map(item => (
            <View key={item.type} style={styles.returnRow}>
              <View style={styles.returnCopy}>
                <Text style={styles.returnName}>{item.type}</Text>
                <Text style={styles.returnCredit}>{formatPeso(item.creditPerUnit)} credit / case</Text>
              </View>
              <TextInput
                value={String(item.quantity)}
                onChangeText={value => updateReturnQuantity(item.type, value)}
                keyboardType="number-pad"
                placeholder="0"
                accessibilityLabel={`${item.type} returned case quantity`}
                style={styles.returnInput}
              />
              <Text style={styles.returnAmount}>{formatPeso((Number(item.quantity) || 0) * item.creditPerUnit)}</Text>
            </View>
          ))}
          <View style={styles.creditTotal}>
            <Text style={styles.creditTotalLabel}>Return credits</Text>
            <Text style={styles.creditTotalValue}>−{formatPeso(totals.returnCredit)}</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Order summary</Text>
          <SummaryLine label="Product cost" amount={totals.productCost} />
          <SummaryLine label="Return credits" amount={totals.returnCredit} negative />
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net cost</Text>
            <Text style={styles.netValue}>{formatPeso(totals.netCost)}</Text>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={saveOrder}
            accessibilityRole="button"
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="save" size={19} color={theme.colors.onPrimary} accessible={false} />
            <Text style={styles.saveLabel}>Save supplier order</Text>
          </Pressable>
        </View>

        <View style={styles.historySection}>
          <View style={styles.historyHeading}>
            <Text style={styles.sectionTitle}>Recent supplier orders</Text>
            <Text style={styles.historyCount}>{restockRecords.length}</Text>
          </View>
          {restockRecords.length ? restockRecords.slice(0, 5).map(record => (
            <View key={record.id} style={styles.historyRow}>
              <View style={styles.historyIcon}>
                <MaterialIcons name="local-shipping" size={18} color={theme.colors.primary} accessible={false} />
              </View>
              <View style={styles.historyCopy}>
                <Text style={styles.historySupplier}>{record.supplier}</Text>
                <Text style={styles.historyMeta}>{record.date} · {record.items.length} {record.items.length === 1 ? 'product' : 'products'}</Text>
              </View>
              <View style={styles.historyTotal}>
                <Text style={styles.historyAmount}>{formatPeso(record.netCost)}</Text>
                <Text style={styles.historyCaption}>Net cost</Text>
              </View>
            </View>
          )) : (
            <Text style={styles.historyEmpty}>Saved supplier orders will appear here.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeading}>
              <View style={styles.headingCopy}>
                <Text style={styles.pickerTitle}>Add a product</Text>
                <Text style={styles.sectionHint}>{supplier}</Text>
              </View>
              <Pressable onPress={() => setPickerVisible(false)} accessibilityRole="button" accessibilityLabel="Close product list" style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>
            <ScrollView>
              {availableProducts.length ? availableProducts.map(product => (
                <Pressable key={product.id} onPress={() => addProduct(product)} accessibilityRole="button" style={({ pressed }) => [styles.productOption, pressed && styles.pressed]}>
                  <View style={styles.itemIcon}>
                    <MaterialIcons name="local-drink" size={19} color={theme.colors.primary} accessible={false} />
                  </View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.optionName}>{product.name}</Text>
                    <Text style={styles.optionMeta}>{product.totalStock} units in stock</Text>
                  </View>
                  <MaterialIcons name="add-circle-outline" size={21} color={theme.colors.primary} accessible={false} />
                </Pressable>
              )) : (
                <Text style={styles.historyEmpty}>All {supplierProducts.length ? 'supplier products are already added.' : 'products are already included.'}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {notice ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
          <MaterialIcons name="check-circle" size={20} color={theme.colors.onPrimary} accessible={false} />
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SummaryLine({ label, amount, negative = false }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryAmount, negative && styles.creditAmount]}>{negative ? '−' : ''}{formatPeso(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'], gap: theme.spacing.md },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  headingCopy: { flex: 1 },
  title: { color: theme.colors.text, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, marginTop: theme.spacing.xs },
  headingIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: theme.colors.primarySoft },
  section: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  sectionHint: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  supplierList: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm, paddingBottom: 2 },
  supplierChip: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  supplierChipSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  supplierLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  supplierLabelSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  addButton: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.primary },
  addButtonLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  disabled: { opacity: 0.45 },
  emptyProducts: { alignItems: 'center', paddingVertical: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', borderRadius: 12 },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginTop: theme.spacing.sm },
  emptyHint: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  orderItem: { padding: theme.spacing.md, marginTop: theme.spacing.sm, borderRadius: 12, backgroundColor: theme.colors.background },
  orderItemHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  itemIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.colors.primarySoft },
  itemNameBlock: { flex: 1 },
  itemName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  itemMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  itemField: { flex: 1 },
  fieldLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginBottom: 5 },
  input: { minHeight: 44, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.sm },
  lineTotal: { minWidth: 72, alignItems: 'flex-end', paddingBottom: 12 },
  lineTotalValue: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  returnRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  returnCopy: { flex: 1 },
  returnName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  returnCredit: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 2 },
  returnInput: { width: 62, minHeight: 42, textAlign: 'center', paddingHorizontal: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.sm },
  returnAmount: { width: 76, color: theme.colors.success, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, textAlign: 'right' },
  creditTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  creditTotalLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  creditTotalValue: { color: theme.colors.success, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  summarySection: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: theme.spacing.md },
  summaryLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm },
  summaryAmount: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  creditAmount: { color: theme.colors.success },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  netLabel: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  netValue: { color: theme.colors.primary, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  error: { color: theme.colors.danger, fontSize: theme.fontSize.sm, marginTop: theme.spacing.md },
  saveButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.lg, borderRadius: 11, backgroundColor: theme.colors.primary },
  saveLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  historySection: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  historyCount: { color: theme.colors.textLight, fontSize: theme.fontSize.sm },
  historyRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  historyIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.colors.primarySoft },
  historyCopy: { flex: 1 },
  historySupplier: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  historyMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  historyTotal: { alignItems: 'flex-end' },
  historyAmount: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  historyCaption: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 2 },
  historyEmpty: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, paddingVertical: theme.spacing.lg },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  pickerSheet: { maxHeight: '78%', padding: theme.spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: theme.colors.surface },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  pickerTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  productOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  optionName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  optionMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  toast: { position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, bottom: theme.spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primary, elevation: 5 },
  toastText: { flex: 1, color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
