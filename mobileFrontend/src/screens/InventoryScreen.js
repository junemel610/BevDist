import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { PesoInput } from '../components/ui/PesoInput';
import { randomUUID } from 'expo-crypto';
import { stockNotice } from '../components/inventory/stockNotice';
import { FeedbackToast } from '../components/FeedbackToast';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { createProductProfile, filterInventoryProducts, isValidInventoryUpdate, productStockState, stockForCasePack, stockState } from '../components/inventory/inventoryUtils';
import { casePackDisplay, casePackOptionsForProduct, casePacksForProduct } from '../components/orders/casePacks';
import { confirmAction } from '../utils/confirmAction';

const FILTERS = [
  { key: 'all', label: 'All products' },
  { key: 'healthy', label: 'In stock' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
];

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH')}`;
const alphabeticCaseCode = value => {
  let code = '';
  for (let number = value; number > 0; number = Math.floor((number - 1) / 26)) {
    code = String.fromCharCode(65 + ((number - 1) % 26)) + code;
  }
  return code;
};
const nextCaseCode = packs => {
  return alphabeticCaseCode(4 + packs.filter(pack => pack.family === 'custom').length);
};
const STATUS = {
  healthy: { label: 'In stock', color: theme.colors.success, background: theme.colors.successSoft, icon: 'check-circle-outline' },
  low: { label: 'Low stock', color: theme.colors.warning, background: theme.colors.warningSoft, icon: 'warning-amber' },
  out: { label: 'Out of stock', color: theme.colors.danger, background: theme.colors.dangerSoft, icon: 'error-outline' },
};

export function InventoryScreen() {
  const { products, suppliers: savedSuppliers = [], casePackTypes = [], addProduct, updateProductInventory, deleteProduct } = useApp();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [editingProduct, setEditingProduct] = useState(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierMode, setSupplierMode] = useState('existing');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [stockByCasePack, setStockByCasePack] = useState({});
  const [casePackIds, setCasePackIds] = useState([]);
  const [casePrices, setCasePrices] = useState({});
  const [newCasePackTypes, setNewCasePackTypes] = useState([]);
  const [customPackUnits, setCustomPackUnits] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const { width } = useWindowDimensions();
  const compact = width < 370;

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const suppliers = useMemo(() => ['All', ...new Set(products.map(product => product.supplier))], [products]);
  const counts = useMemo(() => products.reduce((result, product) => {
    result[productStockState(product)] += 1;
    return result;
  }, { all: products.length, healthy: 0, low: 0, out: 0 }), [products]);
  const visibleProducts = useMemo(() => {
    return filterInventoryProducts(products, { search, supplier: supplierFilter, status: activeFilter });
  }, [products, search, supplierFilter, activeFilter]);
  const selectedSupplier = savedSuppliers.find(supplier => supplier.id === selectedSupplierId);
  const productSupplier = supplierMode === 'existing' ? selectedSupplier?.name || '' : supplierName.trim();
  const matchingSuppliers = savedSuppliers.filter(supplier => supplier.name.toLocaleLowerCase().includes(supplierSearch.trim().toLocaleLowerCase()));
  const customPacks = [...casePackTypes.filter(pack => pack.family === 'custom'), ...newCasePackTypes];
  const casePackOptions = casePackOptionsForProduct({ name: addingProduct ? productName : editingProduct?.name, casePackTypes: customPacks });
  const selectedCasePackIds = casePackIds.filter(id => casePackOptions.some(pack => pack.id === id));
  const nextCustomCaseCode = nextCaseCode([...casePackTypes, ...newCasePackTypes]);

  const startEditing = useCallback(product => {
    setAddingProduct(false);
    setStockReason('');
    setEditingProduct(product);
    const packs = casePacksForProduct(product);
    setCasePackIds(packs.map(pack => pack.id));
    setNewCasePackTypes([]);
    setCustomPackUnits('');
    setCasePrices(Object.fromEntries(packs.map(pack => [pack.id, String(pack.casePrice)])));
    setStockByCasePack(Object.fromEntries(packs.map(pack => [pack.id, String(stockForCasePack(product, pack.id).totalStock)])));
    setError('');
  }, []);

  const renderInventoryItem = useCallback(({ item }) => (
    <InventoryCard product={item} compact={compact} onEdit={startEditing} />
  ), [compact, startEditing]);

  const startAdding = () => {
    setAddingProduct(true);
    setStockReason('Opening stock count');
    setEditingProduct({ name: 'New product', reservedStock: 0 });
    setProductName('');
    setSupplierName('');
    setSupplierMode(savedSuppliers.length ? 'existing' : 'new');
    setSelectedSupplierId('');
    setSupplierSearch('');
    setCasePackIds([]);
    setNewCasePackTypes([]);
    setCustomPackUnits('');
    setCasePrices({});
    setStockByCasePack({});
    setError('');
  };

  const saveProduct = () => {
    if (!stockReason.trim()) { setError('Enter a reason for this stock count.'); return; }
    const normalizedStock = Object.fromEntries(selectedCasePackIds.map(id => [id, { totalStock: Number(stockByCasePack[id]) }]));
    if (addingProduct) {
      if (supplierMode === 'new' && savedSuppliers.some(supplier => supplier.name.trim().toLocaleLowerCase() === productSupplier.toLocaleLowerCase())) {
        setError('This supplier is already saved. Choose Existing supplier.'); return;
      }
      const { error: validationError } = createProductProfile(products, {
        name: productName,
        supplier: productSupplier,
        stockByCasePack: normalizedStock,
        casePackIds: selectedCasePackIds,
        casePrices,
        casePackTypes: customPacks,
      });
      if (validationError) {
        setError(validationError);
        return;
      }
      confirmAction({
        title: 'Add product to inventory?',
        message: `${productName.trim()} from ${productSupplier}${supplierMode === 'new' ? ' (new supplier)' : ''} · ${selectedCasePackIds.map(id => `${casePackOptions.find(pack => pack.id === id)?.label || id}: ${stockByCasePack[id] || 0} cases · selling price ${formatPeso(casePrices[id])}/case`).join(' · ')}.`,
        confirmLabel: 'Add product',
        onConfirm: async () => {
          const product = await addProduct({ name: productName, supplier: productSupplier, supplierId: supplierMode === 'existing' ? selectedSupplierId : undefined, stockByCasePack: normalizedStock, casePackIds: selectedCasePackIds, casePrices, newCasePackTypes, stockReason });
          if (!product) {
            setError('Could not add this product. Check the details and try again.');
            return;
          }
          setEditingProduct(null);
          setAddingProduct(false);
          setToast(stockNotice(selectedCasePackIds.map(packId => ({ productId: product.id, packId })), [product], 'Product added'));
        },
      });
      return;
    }
    if (!isValidInventoryUpdate({ ...editingProduct, casePackTypes: customPacks }, normalizedStock, selectedCasePackIds, casePrices)) {
      setError('Enter half-case stock at least as high as reserved stock for each case type, and a price greater than ₱0.');
      return;
    }
    const priceSummary = selectedCasePackIds.map(id => `${id}: ${stockByCasePack[id] || 0} cases · ${formatPeso(casePrices[id])}/case`).join(' · ');
    confirmAction({
      title: 'Save inventory changes?',
      message: `${editingProduct.name}: ${priceSummary}.`,
      confirmLabel: 'Save changes',
      onConfirm: async () => {
        const updated = await updateProductInventory(editingProduct.id, { stockByCasePack: normalizedStock, casePackIds: selectedCasePackIds, casePrices, newCasePackTypes, stockReason }, editingProduct);
        if (!updated) {
          setError('Could not save these inventory values. Check them and try again.');
          return;
        }
        setEditingProduct(null);
        setToast(stockNotice(selectedCasePackIds.map(packId => ({ productId: updated.id, packId })), [updated], 'Stock updated'));
      },
    });
  };

  const addCustomCaseType = () => {
    const unitsPerCase = Number(customPackUnits);
    if (!/^\d+$/.test(customPackUnits) || unitsPerCase < 1 || unitsPerCase > 10000) {
      setError('Enter a whole-number bottle count.'); return;
    }
    const code = `CUSTOM_${randomUUID().replaceAll('-', '').toUpperCase()}`;
    const pack = { id: code, code, label: nextCustomCaseCode, unitsPerCase, family: 'custom' };
    setNewCasePackTypes(current => [...current, pack]);
    setCasePackIds(current => [...current, pack.id]);
    setCustomPackUnits(''); setError('');
  };

  const removeCustomCaseType = packId => {
    setNewCasePackTypes(current => current.filter(pack => pack.id !== packId));
    setCasePackIds(current => current.filter(id => id !== packId));
    setStockByCasePack(current => {
      const next = { ...current };
      delete next[packId];
      return next;
    });
    setCasePrices(current => {
      const next = { ...current };
      delete next[packId];
      return next;
    });
    setError('');
  };

  const confirmDeleteProduct = () => confirmAction({
    title: 'Delete this product?',
    message: `${editingProduct.name} will be archived. Physical and reserved stock must both be zero. Past invoices and supplier order history will remain.`,
    confirmLabel: 'Delete product',
    destructive: true,
    onConfirm: async () => {
      if (!await deleteProduct(editingProduct.id)) {
        setError('Clear physical stock and reservations before deleting this product.');
        return;
      }
      setEditingProduct(null);
      setToast(`${editingProduct.name} deleted from inventory.`);
    },
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <FlatList
        data={visibleProducts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={[styles.titleRow, styles.pageHeadingBand]}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>Inventory</Text>
                <Text style={styles.subtitle}>{products.length} products tracked</Text>
              </View>
              <Pressable onPress={startAdding} accessibilityRole="button" style={({ pressed }) => [styles.addButton, styles.headerActionButton, pressed && styles.pressed]}>
                <MaterialIcons name="add" size={19} color={theme.colors.primary} accessible={false} />
                <Text style={[styles.addButtonLabel, styles.headerActionText]}>Add product</Text>
              </Pressable>
            </View>
            <View style={styles.summary}>
              <SummaryCount count={counts.healthy} label="In stock" color={theme.colors.success} />
              <SummaryCount count={counts.low} label="Low stock" color={theme.colors.warning} />
              <SummaryCount count={counts.out} label="Out of stock" color={theme.colors.danger} />
            </View>

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={22} color={theme.colors.textLight} accessible={false} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search products"
                placeholderTextColor={theme.colors.placeholder}
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
                    {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
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
                    {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
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
        renderItem={renderInventoryItem}
        ItemSeparatorComponent={InventorySeparator}
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
                <Text style={styles.modalSubtitle} numberOfLines={2}>{addingProduct ? 'Set case types, selling prices, and starting stock.' : editingProduct?.name}</Text>
              </View>
              <Pressable onPress={() => setEditingProduct(null)} accessibilityRole="button" accessibilityLabel="Close inventory editor" hitSlop={8} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>
            <ScrollView style={styles.editorFields} keyboardShouldPersistTaps="handled">
              {addingProduct ? (
                <>
                  <Text style={styles.fieldLabel}>Product name</Text>
                  <TextInput value={productName} onChangeText={value => { setProductName(value); setError(''); }} placeholder="Product name" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Product name" style={styles.fieldInput} />
                  <Text style={[styles.fieldLabel, styles.priceLabel]}>Supplier</Text>
                  <View style={styles.caseTypeOptions}>
                    {[['existing', 'Existing supplier'], ['new', 'New supplier']].map(([mode, label]) => (
                      <Pressable key={mode} onPress={() => { setSupplierMode(mode); setError(''); }} accessibilityRole="radio" accessibilityState={{ checked: supplierMode === mode }} aria-checked={supplierMode === mode} style={[styles.caseTypeChip, supplierMode === mode && styles.caseTypeChipSelected]}>
                        <MaterialIcons name={supplierMode === mode ? 'radio-button-checked' : 'radio-button-unchecked'} size={18} color={theme.colors.primary} accessible={false} />
                        <Text style={styles.caseTypeText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {supplierMode === 'existing' ? <>
                    <TextInput value={supplierSearch} onChangeText={setSupplierSearch} placeholder="Search suppliers" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Search saved suppliers" style={styles.fieldInput} />
                    {selectedSupplier ? <Text style={styles.helperText}>Selected: {selectedSupplier.name}</Text> : null}
                    <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      <View style={styles.caseTypeOptions}>
                        {matchingSuppliers.map(supplier => <Pressable key={supplier.id} onPress={() => { setSelectedSupplierId(supplier.id); setError(''); }} accessibilityRole="radio" accessibilityLabel={`Select supplier ${supplier.name}`} accessibilityState={{ checked: selectedSupplierId === supplier.id }} aria-checked={selectedSupplierId === supplier.id} style={[styles.caseTypeChip, selectedSupplierId === supplier.id && styles.caseTypeChipSelected]}>
                          <MaterialIcons name={selectedSupplierId === supplier.id ? 'check-circle' : 'radio-button-unchecked'} size={18} color={theme.colors.primary} accessible={false} />
                          <Text style={styles.caseTypeText}>{supplier.name}</Text>
                        </Pressable>)}
                      </View>
                    </ScrollView>
                    {!matchingSuppliers.length ? <Text style={styles.helperText}>No suppliers found. Try another search or choose New supplier.</Text> : null}
                  </> : <>
                    <TextInput value={supplierName} onChangeText={value => { setSupplierName(value); setError(''); }} placeholder="Supplier name" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Supplier name" style={styles.fieldInput} />
                    <Text style={styles.helperText}>The new supplier will be saved with this product.</Text>
                  </>}

                </>
              ) : null}
              <View style={styles.sectionDivider} />
              <Text style={[styles.fieldLabel, styles.priceLabel]}>Case types and prices</Text>
              <Text style={styles.helperText}>Select the case types sold for this product. Add or remove types here; past records stay available.</Text>
              <View style={styles.caseTypeOptions}>
                {casePackOptions.map(pack => {
                  const selected = selectedCasePackIds.includes(pack.id);
                  const isNewCustomType = newCasePackTypes.some(newPack => newPack.id === pack.id);
                  return (
                    <View key={pack.id} style={styles.caseTypeOption}>
                      <Pressable
                        onPress={() => setCasePackIds(current => selected ? current.filter(id => id !== pack.id) : [...current, pack.id])}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        aria-checked={selected}
                        style={[styles.caseTypeChip, selected && styles.caseTypeChipSelected]}
                      >
                        {selected && <MaterialIcons name="check-circle" size={16} color={theme.colors.primary} accessible={false} />}
                        <Text style={[styles.caseTypeText, selected && styles.caseTypeTextSelected]}>{casePackDisplay(pack)}</Text>
                      </Pressable>
                      {isNewCustomType ? (
                        <Pressable onPress={() => removeCustomCaseType(pack.id)} accessibilityRole="button" accessibilityLabel={`Remove case type ${pack.label}`} style={styles.removeCaseTypeButton}>
                          <MaterialIcons name="close" size={16} color={theme.colors.danger} accessible={false} />
                          <Text style={styles.removeCaseTypeLabel}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              {selectedCasePackIds.map(id => {
                const pack = casePackOptions.find(option => option.id === id);
                return (
                  <View key={id} style={styles.casePriceRow}>
                    <Text style={styles.casePriceLabel}>{casePackDisplay(pack)}</Text>
                    <View style={styles.caseInputRow}>
                      <View style={styles.caseInputGroup}>
                        <Text style={styles.caseInputLabel}>Quantity (cases)</Text>
                        <TextInput
                          value={String(stockByCasePack[id] ?? '')}
                          onChangeText={value => { setStockByCasePack(current => ({ ...current, [id]: value })); setError(''); }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={theme.colors.placeholder}
                          accessibilityLabel={`${casePackDisplay(pack)} quantity in cases`}
                          style={styles.fieldInput}
                        />
                      </View>
                      <View style={styles.caseInputGroup}>
                        <Text style={[styles.caseInputLabel, styles.priceInputLabel]}>Selling price per case</Text>
                        <PesoInput
                          value={String(casePrices[id] ?? '')}
                          onChangeText={value => { setCasePrices(current => ({ ...current, [id]: value })); setError(''); }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={theme.colors.placeholder}
                          accessibilityLabel={`${casePackDisplay(pack)} selling price per case in pesos`}
                          style={styles.fieldInput}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
              <Text style={styles.fieldLabel}>Add case type {nextCustomCaseCode}</Text>
              <Text style={styles.helperText}>Enter the number of bottles in one case.</Text>
              <View style={styles.customCaseInputGroup}>
                <Text style={styles.caseInputLabel}>Bottles per case</Text>
                <TextInput value={customPackUnits} onChangeText={value => setCustomPackUnits(value.replace(/[^0-9]/g, ''))} placeholder="0" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Custom bottles per case" keyboardType="number-pad" maxLength={5} style={styles.fieldInput} />
              </View>
              <Pressable onPress={addCustomCaseType} accessibilityRole="button" accessibilityLabel="Add custom case type" style={[styles.caseTypeChip, styles.addCaseTypeButton]}><MaterialIcons name="add" size={18} color={theme.colors.primary} /><Text style={styles.caseTypeText}>Add type {nextCustomCaseCode}</Text></Pressable>
              {!selectedCasePackIds.length ? <Text style={styles.helperText}>Select at least one case type.</Text> : null}
              <View style={styles.sectionDivider} />
              <Text style={styles.fieldLabel}>Stock count reason</Text>
              <TextInput value={stockReason} onChangeText={setStockReason} placeholder="Reason" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Stock count reason" style={styles.fieldInput} />
              <Text style={styles.helperText}>{addingProduct ? 'Enter starting stock separately for each case type. Use half-case steps.' : 'Stock and reservations stay separate for each case type.'}</Text>
              {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              {!addingProduct ? (
                <Pressable onPress={confirmDeleteProduct} accessibilityRole="button" style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  <MaterialIcons name="delete-outline" size={18} color={theme.colors.danger} accessible={false} />
                  <Text style={styles.deleteLabel}>Delete</Text>
                </Pressable>
              ) : null}
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

      <FeedbackToast message={toast} onDismiss={() => setToast('')} />
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

const InventoryCard = memo(function InventoryCard({ product, onEdit }) {
  const state = STATUS[productStockState(product)];
  const packs = casePacksForProduct(product);
  return (
    <View style={styles.productCard}>
      <View style={styles.productTop}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.supplierName}>{product.supplier}</Text>
          <View style={[styles.statusBadge, { backgroundColor: state.background }]}>
            <MaterialIcons name={state.icon} size={15} color={state.color} accessible={false} />
            <Text style={[styles.statusLabel, { color: state.color }]}>{state.label}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => onEdit(product)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${product.name} inventory`}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="edit" size={17} color={theme.colors.primary} accessible={false} />
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.caseStockList}>
        {packs.map(pack => {
          const stock = stockForCasePack(product, pack.id);
          const packAvailable = stock.totalStock - stock.reservedStock;
          const packState = STATUS[stockState(packAvailable)];
          return (
            <View key={pack.id} style={styles.caseStockSummary} accessibilityLabel={`${casePackDisplay(pack)}: ${packState.label}, ${packAvailable} cases available`}>
              <View style={styles.caseStockSummaryHeading}>
                <Text style={styles.caseStockSummaryName}>{casePackDisplay(pack)}</Text>
                <View style={[styles.caseTypeHealthBadge, { backgroundColor: packState.background }]}>
                  <MaterialIcons name={packState.icon} size={14} color={packState.color} accessible={false} />
                  <Text style={[styles.caseTypeHealthLabel, { color: packState.color }]}>{packState.label}</Text>
                </View>
              </View>
              <Text style={styles.caseStockSummaryValue}>{packAvailable} available · {stock.reservedStock} reserved · {stock.totalStock} total</Text>
              <Text style={styles.caseStockSummaryPrice}>{formatPeso(pack.casePrice)} / case</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  headerContent: { marginBottom: theme.spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  heading: { flex: 1 },
  addButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primary },
  addButtonLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.onPrimary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.onPrimary, opacity: 0.82, fontSize: theme.fontSize.sm, marginTop: 3 },
  headerActionButton: { backgroundColor: theme.colors.surface },
  headerActionText: { color: theme.colors.primary },
  summary: { flexDirection: 'row', marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  summaryItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
  summaryCount: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  summaryLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, textAlign: 'center' },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  searchInput: { flex: 1, minHeight: 46, color: theme.colors.text, fontSize: theme.fontSize.base, paddingVertical: 0 },
  clearSearch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterRow: { gap: theme.spacing.sm, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  filterChip: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 22, backgroundColor: theme.colors.surface },
  filterChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  filterLabelSelected: { color: theme.colors.onPrimary, fontWeight: theme.fontWeight.semibold },
  filterCount: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  filterCountSelected: { color: theme.colors.onPrimary },
  supplierRow: { gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  supplierChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted },
  supplierChipSelected: { backgroundColor: theme.colors.primarySoft },
  supplierLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  supplierLabelSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  resultCount: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginBottom: theme.spacing.sm },
  productCard: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  productTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
  productInfo: { flex: 1 },
  productName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, lineHeight: 22 },
  supplierName: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  statusBadge: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing.sm, borderRadius: 20 },
  statusLabel: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  editButton: { minWidth: 72, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  editLabel: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  emptyState: { alignItems: 'center', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing['2xl'] },
  emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md, borderRadius: 28, backgroundColor: theme.colors.primarySoft },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  emptyText: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, textAlign: 'center', marginTop: theme.spacing.xs },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.overlay },
  editDialog: { width: '100%', maxWidth: 440, maxHeight: '92%', alignSelf: 'center', padding: theme.spacing.lg, borderRadius: 18, backgroundColor: theme.colors.surface },
  editorFields: { maxHeight: '72%' },
  modalHeading: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.lg },
  modalHeadingText: { flex: 1 },
  modalTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  modalSubtitle: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, marginTop: 4 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -theme.spacing.xs, marginRight: -theme.spacing.xs },
  fieldLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xs },
  fieldInput: { minHeight: 48, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.base },
  helperText: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xs },
  caseTypeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginVertical: theme.spacing.sm },
  caseTypeOption: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  removeCaseTypeButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: theme.spacing.xs, borderRadius: 9, backgroundColor: theme.colors.dangerSoft },
  removeCaseTypeLabel: { color: theme.colors.danger, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  caseTypeChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9 },
  caseTypeChipSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  caseTypeText: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
  caseTypeTextSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  casePriceRow: { gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  casePriceLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  caseInputRow: { flexDirection: 'row', gap: theme.spacing.sm },
  caseInputGroup: { flex: 1, gap: theme.spacing.xs },
  customCaseInputGroup: { gap: theme.spacing.xs },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
  caseInputLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
  priceInputLabel: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  addCaseTypeButton: { alignSelf: 'flex-start', marginTop: theme.spacing.sm },
  caseStockList: { gap: theme.spacing.xs, marginVertical: theme.spacing.md },
  caseStockSummary: { padding: theme.spacing.sm, borderRadius: 9, backgroundColor: theme.colors.surfaceMuted },
  caseStockSummaryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.xs },
  caseStockSummaryName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  caseTypeHealthBadge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: theme.spacing.xs, borderRadius: 12 },
  caseTypeHealthLabel: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  caseStockSummaryValue: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 2 },
  caseStockSummaryPrice: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold, marginTop: 2 },
  priceLabel: { marginTop: theme.spacing.md },
  errorText: { color: theme.colors.danger, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  cancelButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted },
  cancelLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  deleteButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 'auto', paddingHorizontal: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.dangerSoft },
  deleteLabel: { color: theme.colors.danger, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  saveButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primary },
  saveLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  pressed: { opacity: 0.75 },
});

function InventorySeparator() {
  return <View style={styles.cardSeparator} />;
}
