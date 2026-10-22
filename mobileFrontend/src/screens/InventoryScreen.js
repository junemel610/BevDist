import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { availableStock, createProductProfile, filterInventoryProducts, isValidInventoryUpdate, stockState } from '../components/inventory/inventoryUtils';
import { caseAvailabilityLabel } from '../components/orders/casePacks';
import { confirmAction } from '../utils/confirmAction';

const FILTERS = [
  { key: 'all', label: 'All products' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
];

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH')}`;
const STATUS = {
  healthy: { label: 'Healthy', color: theme.colors.success, background: theme.colors.successSoft, icon: 'check-circle-outline' },
  low: { label: 'Low stock', color: theme.colors.warning, background: theme.colors.warningSoft, icon: 'warning-amber' },
  out: { label: 'Out of stock', color: theme.colors.danger, background: theme.colors.dangerSoft, icon: 'error-outline' },
};

export function InventoryScreen() {
  const { products, addProduct, updateProductInventory } = useApp();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [editingProduct, setEditingProduct] = useState(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [stockInput, setStockInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const { width } = useWindowDimensions();
  const compact = width < 370;

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const suppliers = useMemo(() => ['All', ...new Set(products.map(product => product.supplier))], [products]);
  const counts = useMemo(() => products.reduce((result, product) => {
    result[stockState(availableStock(product))] += 1;
    return result;
  }, { all: products.length, healthy: 0, low: 0, out: 0 }), [products]);
  const visibleProducts = useMemo(() => {
    return filterInventoryProducts(products, { search, supplier: supplierFilter, status: activeFilter });
  }, [products, search, supplierFilter, activeFilter]);

  const startEditing = product => {
    setAddingProduct(false);
    setEditingProduct(product);
    setStockInput(String(product.totalStock));
    setPriceInput(String(product.unitPrice));
    setError('');
  };

  const startAdding = () => {
    setAddingProduct(true);
    setEditingProduct({ name: 'New product', reservedStock: 0 });
    setProductName('');
    setSupplierName('');
    setStockInput('0');
    setPriceInput('');
    setError('');
  };

  const saveProduct = () => {
    const totalStock = Number(stockInput);
    const unitPrice = Number(priceInput);
    if (addingProduct) {
      const { error: validationError } = createProductProfile(products, {
        name: productName,
        supplier: supplierName,
        totalStock,
        unitPrice,
      });
      if (validationError) {
        setError(validationError);
        return;
      }
      confirmAction({
        title: 'Add product to inventory?',
        message: `${productName.trim()} will be added with ${totalStock} cases.`,
        confirmLabel: 'Add product',
        onConfirm: () => {
          const product = addProduct({ name: productName, supplier: supplierName, totalStock, unitPrice });
          if (!product) {
            setError('Could not add this product. Check the details and try again.');
            return;
          }
          setEditingProduct(null);
          setAddingProduct(false);
          setToast(`${product.name}: ${caseAvailabilityLabel(totalStock)}`);
        },
      });
      return;
    }
    if (!isValidInventoryUpdate(editingProduct, totalStock, Number(priceInput))) {
      if (!Number.isFinite(totalStock) || !Number.isInteger(totalStock * 2) || totalStock < editingProduct.reservedStock) {
        setError(`Enter a half-case increment at least ${editingProduct.reservedStock}; reserved stock cannot be reduced.`);
        return;
      }
      setError('Enter a price greater than ₱0.');
      return;
    }
    confirmAction({
      title: 'Save inventory changes?',
      message: `${editingProduct.name}: set total stock to ${totalStock} cases and base unit price to ${formatPeso(unitPrice)}.`,
      confirmLabel: 'Save changes',
      onConfirm: () => {
        if (!updateProductInventory(editingProduct.id, { totalStock, unitPrice })) {
          setError('Could not save these inventory values. Check them and try again.');
          return;
        }
        const available = totalStock - editingProduct.reservedStock;
        setEditingProduct(null);
        setToast(`${editingProduct.name}: ${caseAvailabilityLabel(available)}`);
      },
    });
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <FlatList
        data={visibleProducts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>Inventory</Text>
                <Text style={styles.subtitle}>{products.length} products tracked</Text>
              </View>
              <Pressable onPress={startAdding} accessibilityRole="button" style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                <MaterialIcons name="add" size={19} color={theme.colors.onPrimary} accessible={false} />
                <Text style={styles.addButtonLabel}>Add product</Text>
              </Pressable>
              <View style={styles.summary}>
                <SummaryCount count={counts.healthy} label="Healthy" color={theme.colors.success} />
                <SummaryCount count={counts.low} label="Low" color={theme.colors.warning} />
                <SummaryCount count={counts.out} label="Out" color={theme.colors.danger} />
              </View>
            </View>

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={22} color={theme.colors.textLight} accessible={false} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search products or suppliers"
                placeholderTextColor={theme.colors.textLight}
                accessibilityLabel="Search inventory by product or supplier"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} style={styles.clearSearch}>
                  <MaterialIcons name="close" size={19} color={theme.colors.textLight} accessible={false} />
                </Pressable>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} accessibilityLabel="Stock status filters">
              {FILTERS.map(filter => {
                const selected = activeFilter === filter.key;
                const count = filter.key === 'all' ? counts.all : counts[filter.key];
                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setActiveFilter(filter.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}
                  >
                    {selected && <MaterialIcons name="check" size={15} color={theme.colors.onPrimary} accessible={false} />}
                    <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{filter.label}</Text>
                    <Text style={[styles.filterCount, selected && styles.filterCountSelected]}>{count}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.supplierRow} accessibilityLabel="Supplier filters">
              {suppliers.map(supplier => {
                const selected = supplierFilter === supplier;
                return (
                  <Pressable
                    key={supplier}
                    onPress={() => setSupplierFilter(supplier)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.supplierChip, selected && styles.supplierChipSelected, pressed && styles.pressed]}
                  >
                    {selected && <MaterialIcons name="check-circle" size={16} color={theme.colors.primary} accessible={false} />}
                    <Text style={[styles.supplierLabel, selected && styles.supplierLabelSelected]}>{supplier}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.resultCount}>{visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <InventoryCard product={item} compact={compact} onEdit={() => startEditing(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="inventory-2" size={26} color={theme.colors.primary} accessible={false} />
            </View>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>{search ? 'Try another product or supplier name.' : 'No products match these filters.'}</Text>
          </View>
        )}
      />

      <Modal visible={Boolean(editingProduct)} transparent animationType="fade" onRequestClose={() => { setEditingProduct(null); setAddingProduct(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.editDialog}>
            <View style={styles.modalHeading}>
              <View style={styles.modalHeadingText}>
                <Text style={styles.modalTitle}>{addingProduct ? 'Add product' : 'Edit inventory'}</Text>
                <Text style={styles.modalSubtitle} numberOfLines={2}>{addingProduct ? 'Enter product details and starting stock.' : editingProduct?.name}</Text>
              </View>
              <Pressable onPress={() => setEditingProduct(null)} accessibilityRole="button" accessibilityLabel="Close inventory editor" hitSlop={8} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>
            {addingProduct ? (
              <>
                <Text style={styles.fieldLabel}>Product name</Text>
                <TextInput value={productName} onChangeText={value => { setProductName(value); setError(''); }} placeholder="e.g. Mucho Red Horse" placeholderTextColor={theme.colors.textLight} accessibilityLabel="Product name" style={styles.fieldInput} />
                <Text style={[styles.fieldLabel, styles.priceLabel]}>Supplier</Text>
                <TextInput value={supplierName} onChangeText={value => { setSupplierName(value); setError(''); }} placeholder="Supplier name" placeholderTextColor={theme.colors.textLight} accessibilityLabel="Supplier name" style={styles.fieldInput} />
              </>
            ) : null}
            <Text style={styles.fieldLabel}>Total stock (cases)</Text>
            <TextInput
              value={stockInput}
              onChangeText={value => { setStockInput(value); setError(''); }}
              keyboardType="decimal-pad"
              accessibilityLabel="Total stock in cases"
              style={styles.fieldInput}
            />
            <Text style={styles.helperText}>{addingProduct ? 'Cases can be entered in half-case steps.' : `Reserved stock: ${editingProduct?.reservedStock ?? 0} cases. Total must cover reserved stock.`}</Text>
            <Text style={[styles.fieldLabel, styles.priceLabel]}>Base price reference</Text>
            <TextInput
              value={priceInput}
              onChangeText={value => { setPriceInput(value); setError(''); }}
              keyboardType="decimal-pad"
              accessibilityLabel="Product base price reference in pesos"
              style={styles.fieldInput}
            />
            <Text style={styles.helperText}>Invoice case prices use this reference and the selected case pack.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditingProduct(null)} accessibilityRole="button" style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveProduct} accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                <Text style={styles.saveLabel}>{addingProduct ? 'Add product' : 'Save changes'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
          <MaterialIcons name={toast.includes('left.') ? 'warning-amber' : 'check-circle'} size={20} color={theme.colors.onPrimary} accessible={false} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SummaryCount({ count, label, color }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function InventoryCard({ product, compact, onEdit }) {
  const available = availableStock(product);
  const state = STATUS[stockState(available)];
  const total = Math.max(product.totalStock, 1);
  return (
    <View style={styles.productCard}>
      <View style={styles.productTop}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.supplierName}>{product.supplier}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: state.background }]}>
          <MaterialIcons name={state.icon} size={15} color={state.color} accessible={false} />
          <Text style={[styles.statusLabel, { color: state.color }]}>{state.label}</Text>
        </View>
      </View>

      <View style={styles.stockNumbers}>
        <View style={styles.stockMetric}>
          <Text style={styles.stockValue}>{available}</Text>
          <Text style={styles.stockLabel}>Available cases</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.stockMetric}>
          <Text style={styles.stockValue}>{product.reservedStock}</Text>
          <Text style={styles.stockLabel}>Reserved cases</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.stockMetric}>
          <Text style={styles.stockValue}>{product.totalStock}</Text>
          <Text style={styles.stockLabel}>Total cases</Text>
        </View>
      </View>
      <Text style={styles.caseAvailability}>{caseAvailabilityLabel(available)}</Text>
      <View accessibilityLabel={`Available stock ${available} of ${product.totalStock} cases`} style={styles.stockTrack}>
        <View style={[styles.stockFill, { width: `${Math.min(Math.max((available / total) * 100, 0), 100)}%`, backgroundColor: state.color }]} />
      </View>

      <View style={styles.productFooter}>
        <Text style={styles.price}>{formatPeso(product.unitPrice)} <Text style={styles.perUnit}>base price</Text></Text>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${product.name} inventory`}
          style={({ pressed }) => [styles.editButton, compact && styles.editButtonCompact, pressed && styles.pressed]}
        >
          <MaterialIcons name="edit" size={17} color={theme.colors.primary} accessible={false} />
          {!compact && <Text style={styles.editLabel}>Edit</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  headerContent: { marginBottom: theme.spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  heading: { flex: 1 },
  addButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.primary },
  addButtonLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  title: { color: theme.colors.text, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, marginTop: 3 },
  summary: { flexDirection: 'row', gap: theme.spacing.md, marginLeft: theme.spacing.sm },
  summaryItem: { alignItems: 'center', minWidth: 36 },
  summaryCount: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  summaryLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  searchInput: { flex: 1, minHeight: 46, color: theme.colors.text, fontSize: theme.fontSize.base, paddingVertical: 0 },
  clearSearch: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  filterRow: { gap: theme.spacing.sm, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  filterChip: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 22, backgroundColor: theme.colors.surface },
  filterChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  filterLabelSelected: { color: theme.colors.onPrimary, fontWeight: theme.fontWeight.semibold },
  filterCount: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  filterCountSelected: { color: theme.colors.onPrimary },
  supplierRow: { gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  supplierChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted },
  supplierChipSelected: { backgroundColor: theme.colors.primarySoft },
  supplierLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  supplierLabelSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  resultCount: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginBottom: theme.spacing.sm },
  productCard: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  productTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
  productInfo: { flex: 1 },
  productName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, lineHeight: 22 },
  supplierName: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  statusBadge: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing.sm, borderRadius: 20 },
  statusLabel: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  stockNumbers: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  caseAvailability: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, lineHeight: 18, marginTop: theme.spacing.sm },
  stockMetric: { flex: 1 },
  stockValue: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  stockLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 2 },
  metricDivider: { width: 1, height: 32, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.sm },
  stockTrack: { height: 6, overflow: 'hidden', borderRadius: 4, backgroundColor: theme.colors.surfaceMuted },
  stockFill: { height: '100%', borderRadius: 4 },
  productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  price: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  perUnit: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.regular },
  editButton: { minWidth: 72, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  editButtonCompact: { minWidth: 44, width: 44 },
  editLabel: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  cardSeparator: { height: theme.spacing.md },
  emptyState: { alignItems: 'center', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing['2xl'] },
  emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md, borderRadius: 28, backgroundColor: theme.colors.primarySoft },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  emptyText: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, textAlign: 'center', marginTop: theme.spacing.xs },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.overlay },
  editDialog: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: theme.spacing.lg, borderRadius: 18, backgroundColor: theme.colors.surface },
  modalHeading: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.lg },
  modalHeadingText: { flex: 1 },
  modalTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  modalSubtitle: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, marginTop: 4 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -theme.spacing.xs, marginRight: -theme.spacing.xs },
  fieldLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xs },
  fieldInput: { minHeight: 48, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.base },
  helperText: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xs },
  priceLabel: { marginTop: theme.spacing.md },
  errorText: { color: theme.colors.danger, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  cancelButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted },
  cancelLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  saveButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primary },
  saveLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  toast: { position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, bottom: theme.spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primary, elevation: 5 },
  toastText: { flex: 1, color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
