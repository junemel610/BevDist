import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  Platform,
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
import { DiscardDraftModal } from '../components/ui/DiscardDraftModal';
import { ContainerReturnEditor } from '../components/orders/ContainerReturnEditor';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { hasValidSupplierOrderItems, supplierOrderTotals } from '../components/supplierOrders/supplierOrderUtils';
import { casePackDisplay, casePackOptionsForProduct, casePacksForProduct } from '../components/orders/casePacks';
import { formatCaseQuantity } from '../components/orders/caseQuantity';
import { stockForCasePack } from '../components/inventory/inventoryUtils';
import { confirmAction } from '../utils/confirmAction';
import { nextSupplierOrderNumber } from '../components/supplierOrders/orderNumberPreview';
import { PaginationControls, PAGE_SIZE } from '../components/ui/PaginationControls';
import { ProductPickerTrigger } from '../components/orders/ProductPickerTrigger';

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const HISTORY_PERIODS = [
  ['all', 'All time'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['previousMonth', 'Last month'], ['custom', 'Date range'],
];

function manilaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function periodRange(period, today) {
  if (period === 'today') return [today, today];
  if (period === 'week') {
    const date = new Date(`${today}T00:00:00Z`);
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    return [shiftDate(today, -mondayOffset), shiftDate(today, 6 - mondayOffset)];
  }
  if (period === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (period === 'previousMonth') {
    const first = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    first.setUTCDate(0);
    return [`${first.toISOString().slice(0, 7)}-01`, first.toISOString().slice(0, 10)];
  }
  return null;
}

export function SupplierOrdersScreen() {
  const { products, suppliers: savedSuppliers, restockRecords, addRestockRecord } = useApp();
  const [selectedSupplier, setSupplier] = useState('');
  const [supplierDraft, setSupplierDraft] = useState(null);
  const [supplierEditorVisible, setSupplierEditorVisible] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', address: '' });
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productEditorVisible, setProductEditorVisible] = useState(false);
  const [productName, setProductName] = useState('');
  const selectedPackIds = ['B'];
  const [casePrices, setCasePrices] = useState({});
  const [newProducts, setNewProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [returnedCases, setReturnedCases] = useState([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [discardOrderVisible, setDiscardOrderVisible] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [historyMode, setHistoryMode] = useState(true);
  const [historyPeriod, setHistoryPeriod] = useState('all');
  const [historySupplier, setHistorySupplier] = useState('All suppliers');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const { width } = useWindowDimensions();
  const compact = width < 380;

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const suppliers = useMemo(() => savedSuppliers.map(entry => entry.name), [savedSuppliers]);
  const filteredSuppliers = suppliers.filter(name => name.toLocaleLowerCase().includes(supplierSearch.trim().toLocaleLowerCase()));
  const savedSupplier = savedSuppliers.find(entry => entry.name === selectedSupplier) || null;
  const supplierRecord = supplierDraft || savedSupplier;
  const supplier = supplierRecord?.name || '';
  const supplierProducts = useMemo(() => supplierDraft ? [] : products.filter(product => product.supplierId === supplierRecord?.id), [products, supplierDraft, supplierRecord?.id]);
  const availableProducts = supplierProducts.flatMap(product => casePacksForProduct(product).map(pack => ({ product, pack })))
    .filter(({ product, pack }) => !items.some(item => item.productId === product.id && item.packId === pack.id));
  const filteredProducts = availableProducts.filter(({ product, pack }) => `${product.name} ${pack.label}`.toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase()));
  const numericReturns = returnedCases.map(item => ({ ...item, quantity: Number(item.quantity) || 0, creditPerUnit: Number(item.creditPerUnit) || 0 }));
  const returnEditorRows = returnedCases.map(item => ({ ...item, kind: 'return', amountPerCase: item.creditPerUnit }));
  const totals = supplierOrderTotals(items.map(item => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unitCost: Number(item.unitCost) || 0,
  })), numericReturns);
  const todayLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date());
  const today = manilaDate();
  const orderNumberPreview = useMemo(() => nextSupplierOrderNumber(restockRecords), [restockRecords]);
  const historySuppliers = useMemo(() => ['All suppliers', ...new Set(restockRecords.map(record => record.supplier).filter(Boolean).sort((a, b) => a.localeCompare(b)))], [restockRecords]);
  const historyRecords = useMemo(() => {
    const range = historyPeriod === 'custom' ? [historyStart || '', historyEnd || '9999-12-31'] : periodRange(historyPeriod, today);
    return restockRecords.filter(record => record.date
      && (historySupplier === 'All suppliers' || record.supplier === historySupplier)
      && (!range || ((!range[0] || record.date >= range[0]) && record.date <= range[1])))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [restockRecords, historyPeriod, historySupplier, historyStart, historyEnd, today]);
  const historyPageCount = Math.max(1, Math.ceil(historyRecords.length / PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const pagedHistoryRecords = historyRecords.slice((currentHistoryPage - 1) * PAGE_SIZE, currentHistoryPage * PAGE_SIZE);
  const changeHistoryFilter = setter => value => { setter(value); setHistoryPage(1); };

  const changeSupplier = nextSupplier => {
    if (nextSupplier === supplier && !supplierDraft) return;
    const apply = () => {
      setSupplierDraft(null);
      setSupplier(nextSupplier);
      setItems([]);
      setNewProducts([]);
      setError('');
    };
    if (items.length) {
      confirmAction({ title: 'Change supplier?', message: 'Changing suppliers will clear the products in this order.', confirmLabel: 'Change supplier', onConfirm: apply });
      return;
    }
    apply();
  };

  const requestCloseOrder = () => setDiscardOrderVisible(true);
  const discardSupplierOrder = () => {
    setDiscardOrderVisible(false);
    setPickerVisible(false);
    setSupplierEditorVisible(false);
    setProductEditorVisible(false);
    setSupplier('');
    setSupplierDraft(null);
    setItems([]);
    setNewProducts([]);
    setReturnedCases([]);
    setError('');
    setHistoryMode(true);
  };

  const addProduct = (product, pack) => {
    const savedCost = product.supplierCosts?.[pack.id] ?? pack.casePrice ?? '';
    setItems(current => [...current, { rowKey: `${product.id}:${pack.id}`, productId: product.id, productName: product.name, packId: pack.id, packLabel: casePackDisplay(pack), quantity: '', unitCost: String(savedCost) }]);
    setPickerVisible(false);
    setError('');
  };

  const startNewSupplier = () => {
    setSupplierForm({ name: '', contact: '', address: '' });
    setSupplierEditorVisible(true);
    setError('');
  };

  const saveSupplierDraft = () => {
    const name = supplierForm.name.trim();
    if (!name) { setError('Enter a supplier name.'); return; }
    if (savedSuppliers.some(entry => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('A supplier with this name already exists. Select it from the saved suppliers.');
      return;
    }
    const apply = () => {
      setItems([]);
      setNewProducts([]);
      setSupplierDraft({ ...supplierForm, name });
      setSupplier('');
      setSupplierEditorVisible(false);
      setError('');
    };
    if (items.length) confirmAction({ title: 'Change supplier?', message: 'Changing suppliers will clear the products in this order.', confirmLabel: 'Change supplier', onConfirm: apply });
    else apply();
  };

  const saveNewProductDraft = () => {
    const name = productName.trim();
    if (!name) { setError('Enter a product name.'); return; }
    const duplicate = [...supplierProducts, ...newProducts].some(product => product.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (duplicate) { setError('This supplier already has a product with that name. Choose the saved product instead.'); return; }
    if (selectedPackIds.length !== 1 || selectedPackIds[0] !== 'B') { setError('Choose the case unit.'); return; }
    if (selectedPackIds.some(packId => !/^\d+(\.\d{1,2})?$/.test(String(casePrices[packId])) || !(Number(casePrices[packId]) > 0))) { setError('Enter a numeric selling price per case.'); return; }
    const key = `new-product-${Date.now()}`;
    const packs = casePackOptionsForProduct({ name }).filter(pack => selectedPackIds.includes(pack.id));
    if (!packs.length) { setError('Choose the case unit.'); return; }
    const product = { key, name, packs: packs.map(pack => ({ ...pack, casePrice: Number(casePrices[pack.id]) })) };
    setNewProducts(current => [...current, product]);
    setItems(current => [...current, ...product.packs.map(pack => ({
      rowKey: `${key}:${pack.id}`, newProductKey: key, productName: name,
      packId: pack.id, packLabel: casePackDisplay(pack), casePrice: pack.casePrice, quantity: '', unitCost: String(pack.casePrice),
    }))]);
    setProductEditorVisible(false);
    setPickerVisible(false);
    setProductName('');
    setCasePrices({});
    setError('');
  };

  const removeItem = rowKey => {
    const removed = items.find(item => item.rowKey === rowKey);
    setItems(current => current.filter(item => item.rowKey !== rowKey));
    if (removed?.newProductKey) {
      const remainingPacks = items.filter(item => item.newProductKey === removed.newProductKey && item.rowKey !== rowKey);
      setNewProducts(current => current.flatMap(product => {
        if (product.key !== removed.newProductKey) return [product];
        if (!remainingPacks.length) return [];
        return [{ ...product, packs: product.packs.filter(pack => pack.id !== removed.packId) }];
      }));
    }
  };

  const updateItem = (rowKey, field, value) => {
    setItems(current => current.map(item => item.rowKey === rowKey ? { ...item, [field]: value } : item));
    setError('');
  };

  const saveOrder = () => {
    if (!supplierRecord) { setError('Choose a supplier or add a new one.'); return; }
    if (!items.length) { setError('Add at least one product line before saving.'); return; }
    const orderItems = items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      unitCost: Number(item.unitCost) || 0,
    }));
    if (!hasValidSupplierOrderItems(orderItems)) {
      setError('Enter a half-case quantity and purchase cost for every product line.');
      return;
    }

    const existingItems = orderItems.filter(item => !item.newProductKey);
    const newProductPayload = newProducts.map(product => ({
      name: product.name,
      packs: product.packs.map(pack => {
        const line = orderItems.find(item => item.newProductKey === product.key && item.packId === pack.id);
        return { packId: pack.id, casePrice: pack.casePrice, quantity: line.quantity, unitCost: line.unitCost };
      }),
    }));

    const recordedReturns = numericReturns.filter(item => item.quantity > 0).map(({ rowKey, ...item }) => item);
    if (returnedCases.some(item => item.quantity > 0 && !item.type.trim())) {
      setError('Enter a name for each returned container or item.');
      return;
    }
    if (returnedCases.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0 || !Number.isInteger(Number(item.quantity) * 2))) {
      setError('Returned quantities must use half-case steps, starting at 0.5 case.');
      return;
    }
    if (returnedCases.some(item => item.quantity > 0 && (!/^\d+(\.\d{1,2})?$/.test(String(item.creditPerUnit)) || Number(item.creditPerUnit) <= 0))) {
      setError('Enter a refund per case for each returned item.');
      return;
    }
    const productCost = orderItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const returnCredit = recordedReturns.reduce((sum, item) => sum + item.quantity * item.creditPerUnit, 0);
    if (returnCredit > productCost) { setError('Return credits cannot exceed the product cost.'); return; }
    confirmAction({
      title: 'Save supplier order?',
      message: `${supplier}: ${orderItems.length} ${orderItems.length === 1 ? 'product' : 'products'} · Net cost ${formatPeso(Math.max(0, productCost - returnCredit))}. Inventory stock will be updated.`,
      confirmLabel: 'Save order',
      onConfirm: async () => {
        await addRestockRecord(supplierRecord, existingItems, recordedReturns, newProductPayload);
        setItems([]);
        setNewProducts([]);
        setSupplierDraft(null);
        setSupplier('');
        setReturnedCases([]);
        setError('');
        setNotice('Supplier order saved. Inventory updated.');
        setHistoryMode(true);
      },
    });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.pageHeading, styles.pageHeadingBand]}>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={styles.title}>Supplier orders</Text>
            <Text style={styles.subtitle}>{`${restockRecords.length} received ${restockRecords.length === 1 ? 'order' : 'orders'}`}</Text>
          </View>
          <Pressable
            onPress={() => {
              setError('');
              setHistoryMode(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Create supplier order"
            style={({ pressed }) => [styles.headingAction, pressed && styles.pressed]}
          >
            <MaterialIcons name="add" size={20} color={theme.colors.primary} accessible={false} />
            <Text style={styles.headingActionLabel}>{compact ? 'Create' : 'Create supplier order'}</Text>
          </Pressable>
        </View>

        {historyMode && <View style={styles.historySection}>
          <View style={styles.historyHeading}>
            <View>
              <Text style={styles.sectionTitle}>Supplier order history</Text>
              <Text style={styles.sectionHint}>{historyRecords.length} matching {historyRecords.length === 1 ? 'order' : 'orders'}</Text>
            </View>
            <MaterialIcons name="history" size={22} color={theme.colors.primary} accessible={false} />
          </View>
          <Text style={styles.fieldLabel}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyFilterRow}>
            {HISTORY_PERIODS.map(([value, label]) => <Pressable key={value} onPress={() => changeHistoryFilter(setHistoryPeriod)(value)} accessibilityRole="button" accessibilityState={{ selected: historyPeriod === value }} style={[styles.historyFilterChip, historyPeriod === value && styles.historyFilterChipSelected]}>
              <Text style={[styles.historyFilterText, historyPeriod === value && styles.historyFilterTextSelected]}>{label}</Text>
            </Pressable>)}
          </ScrollView>
          {historyPeriod === 'custom' ? <View style={styles.customRangeRow}>
            <TextInput value={historyStart} onChangeText={changeHistoryFilter(setHistoryStart)} placeholder="Start · YYYY-MM-DD" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Order history start date" style={styles.rangeInput} />
            <TextInput value={historyEnd} onChangeText={changeHistoryFilter(setHistoryEnd)} placeholder="End · YYYY-MM-DD" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Order history end date" style={styles.rangeInput} />
          </View> : null}
          <Text style={styles.fieldLabel}>Supplier</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyFilterRow}>
            {historySuppliers.map(name => <Pressable key={name} onPress={() => changeHistoryFilter(setHistorySupplier)(name)} accessibilityRole="button" accessibilityState={{ selected: historySupplier === name }} style={[styles.historyFilterChip, historySupplier === name && styles.historyFilterChipSelected]}>
              <Text style={[styles.historyFilterText, historySupplier === name && styles.historyFilterTextSelected]}>{name}</Text>
            </Pressable>)}
          </ScrollView>
          <View style={styles.historyResults}>
            {historyRecords.length ? pagedHistoryRecords.map(record => (
              <Pressable key={record.id} onPress={() => setSelectedRecord(record)} accessibilityRole="button" accessibilityLabel={`View ${record.supplier} supplier order from ${record.date}`} accessibilityHint="Opens supplier order details" style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
                <View style={styles.historyIcon}><MaterialIcons name="local-shipping" size={18} color={theme.colors.primary} accessible={false} /></View>
                <View style={styles.historyCopy}>
                  <Text style={styles.historySupplier}>{record.supplier}</Text>
                  <Text style={styles.historyMeta}>{record.orderNumber ? `${record.orderNumber} · ` : ''}{record.date} · {record.items.length} {record.items.length === 1 ? 'product' : 'products'}</Text>
                </View>
                <View style={styles.historyTotal}>
                  <Text style={styles.historyAmount}>{formatPeso(record.netCost)}</Text>
                  <Text style={styles.historyCaption}>Net cost</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            )) : <Text style={styles.historyEmpty}>{restockRecords.length ? 'No supplier orders match these filters.' : 'Saved supplier orders will appear here.'}</Text>}
            <PaginationControls page={currentHistoryPage} totalItems={historyRecords.length} onPageChange={setHistoryPage} />
          </View>
        </View>}
        <Modal visible={!historyMode} animationType="slide" onRequestClose={requestCloseOrder}>
          <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
            <View style={styles.createModal}>
            <ScrollView style={styles.createScroll} contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled">
              <View style={styles.createHeader}>
                <View style={styles.createHeaderCopy}>
                  <Text accessibilityRole="header" style={styles.createTitle}>Supplier order</Text>
                  <Text style={styles.createSubtitle}>Record products received and returned cases.</Text>
                </View>
                <Pressable onPress={requestCloseOrder} accessibilityRole="button" accessibilityLabel="Close create supplier order" style={({ pressed }) => [styles.createClose, pressed && styles.pressed]}>
                  <MaterialIcons name="close" size={22} color={theme.colors.onPrimary} accessible={false} />
                </Pressable>
              </View>
        <View style={styles.orderMeta}>
          <View style={styles.orderNumberBlock}>
            <Text style={styles.metaCaption}>ORD:</Text>
            <Text style={styles.orderNumberValue} accessibilityLabel={`Order number ${orderNumberPreview}`}>{orderNumberPreview}</Text>
          </View>
          <View style={styles.orderDateBlock}>
            <Text style={styles.metaCaption}>Date:</Text>
            <Text style={styles.orderDateValue}>{todayLabel}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text style={styles.sectionTitle}>Select Supplier</Text>
              <Text style={styles.sectionHint}>{supplier ? `Selected: ${supplier}` : 'Choose the supplier that delivered these products.'}</Text>
            </View>
            <Pressable onPress={startNewSupplier} accessibilityRole="button" accessibilityLabel="New supplier" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <MaterialIcons name="person-add" size={18} color={theme.colors.primary} accessible={false} />
              {!compact && <Text style={styles.secondaryButtonLabel}>New supplier</Text>}
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={theme.colors.textLight} accessible={false} />
            <TextInput
              value={supplierSearch}
              onChangeText={setSupplierSearch}
              placeholder="Search suppliers"
              placeholderTextColor={theme.colors.placeholder}
              accessibilityLabel="Search saved suppliers"
              style={styles.searchInput}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.supplierList}>
            {filteredSuppliers.map(name => {
              const selected = !supplierDraft && supplier === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => changeSupplier(name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select supplier ${name}`}
                  accessibilityState={{ selected }}
                  {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
                  style={({ pressed }) => [styles.supplierChip, selected && styles.supplierChipSelected, pressed && styles.pressed]}
                >
                  <MaterialIcons name={selected ? 'check-circle' : 'inventory-2'} size={18} color={selected ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                  <Text style={[styles.supplierLabel, selected && styles.supplierLabelSelected]}>{name}</Text>
                </Pressable>
              );
            })}
            {supplierDraft ? (
              <View style={[styles.supplierChip, styles.supplierChipSelected]}>
                <MaterialIcons name="check-circle" size={18} color={theme.colors.primary} accessible={false} />
                <Text style={[styles.supplierLabel, styles.supplierLabelSelected]}>{supplierDraft.name} · new</Text>
              </View>
            ) : null}
          </ScrollView>
          {filteredSuppliers.length === 0 && !supplierDraft ? <Text style={styles.historyEmpty}>No saved suppliers match. Add a new supplier to enter one manually.</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text style={styles.sectionTitle}>Products</Text>
              <Text style={styles.sectionHint}>{supplier ? `${supplierProducts.length} ${supplierProducts.length === 1 ? 'product' : 'products'} from ${supplier}` : 'Select a supplier to view available products.'}</Text>
            </View>
          </View>

          <ProductPickerTrigger
            onPress={() => { setProductSearch(''); setPickerVisible(true); }}
            disabled={!supplierRecord}
            accessibilityLabel="Select supplier order products"
          />

          <View style={styles.productTableHeader}>
            <Text style={styles.tableHeading}>Products received</Text>
          </View>
          <View style={styles.productFieldHeadings}>
            <Text style={[styles.fieldHeading, styles.quantityField]}>Quantity (cases)</Text>
            <Text style={[styles.fieldHeading, styles.costField]}>Supplier cost / case</Text>
            <Text style={[styles.fieldHeading, styles.totalField]}>Line total</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyProducts}>
              <MaterialIcons name="add-shopping-cart" size={24} color={theme.colors.textLight} accessible={false} />
              <Text style={styles.emptyTitle}>No products added</Text>
              <Text style={styles.emptyHint}>Add an existing product or create one for this receipt.</Text>
            </View>
          ) : items.map(item => (
            <View key={item.rowKey} style={styles.orderItem}>
              <View style={styles.orderItemHeading}>
                <View style={styles.itemNameBlock}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>{item.newProductKey ? `${item.packLabel} · new product; stock is added when saved` : `${item.packLabel} · current stock: ${formatCaseQuantity(stockForCasePack(products.find(product => product.id === item.productId), item.packId).totalStock)} cases`}</Text>
                </View>
                <Pressable onPress={() => removeItem(item.rowKey)} accessibilityRole="button" accessibilityLabel={`Remove ${item.productName} ${item.packLabel}`} style={styles.removeButton}>
                  <MaterialIcons name="delete-outline" size={21} color={theme.colors.danger} accessible={false} />
                </Pressable>
              </View>
              <View style={styles.fieldsRow}>
                <View style={styles.quantityField}>
                  <TextInput
                    value={String(item.quantity)}
                    onChangeText={value => updateItem(item.rowKey, 'quantity', value)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.colors.placeholder}
                    accessibilityLabel={`${item.productName} quantity in cases`}
                    style={styles.input}
                  />
                </View>
                <View style={styles.costField}>
                  <PesoInput
                    value={String(item.unitCost)}
                    onChangeText={value => updateItem(item.rowKey, 'unitCost', value)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.colors.placeholder}
                    accessibilityLabel={`${item.productName} supplier cost per case in pesos`}
                    style={styles.input}
                  />
                </View>
                <View style={styles.lineTotal}>
                  <Text style={styles.lineTotalValue}>{formatPeso((Number(item.quantity) || 0) * (Number(item.unitCost) || 0))}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <ContainerReturnEditor
            rows={returnEditorRows}
            onChange={rows => setReturnedCases(rows.map(item => ({ rowKey: item.rowKey, type: item.type, quantity: item.quantity, creditPerUnit: item.amountPerCase })))}
            sectionTitle="Returned cases"
            helperText="Returned containers or items reduce the supplier order cost."
            showKindSelector={false}
            minimumQuantity={0}
            initialQuantity={0}
            addButtonLabel="Add return line"
            addAccessibilityLabel="Add return line"
            rowLabel="Return line"
            accessibilityPrefix="return line"
          />
          <View style={styles.creditTotal}>
            <Text style={styles.creditTotalLabel}>Total return refund</Text>
            <Text style={styles.creditTotalValue}>−{formatPeso(totals.returnCredit)}</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Order total</Text>
          <SummaryLine label="Products received" amount={totals.productCost} />
          <SummaryLine label="Returned case credits" amount={totals.returnCredit} negative />
        </View>
            </ScrollView>
            <View style={styles.createFooter}>
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <View style={styles.footerTotal}>
                <Text style={styles.footerCaption}>Net cost</Text>
                <Text style={styles.footerAmount}>{formatPeso(totals.netCost)}</Text>
              </View>
              <Pressable onPress={saveOrder} accessibilityRole="button" accessibilityLabel="Save supplier order" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                <MaterialIcons name="save" size={19} color={theme.colors.onPrimary} accessible={false} />
                <Text style={styles.saveLabel}>Save supplier order</Text>
              </Pressable>
            </View>
            </View>
          </SafeAreaView>
        </Modal>
      </ScrollView>

      <DiscardDraftModal
        visible={discardOrderVisible}
        title="Discard this supplier order?"
        message="This order has not been saved. Leaving now will discard the supplier, products, quantities, and return credits in this draft."
        onKeepEditing={() => setDiscardOrderVisible(false)}
        onDiscard={discardSupplierOrder}
        discardLabel="Discard order"
      />

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
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={theme.colors.textLight} accessible={false} />
              <TextInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Search products"
                placeholderTextColor={theme.colors.placeholder}
                accessibilityLabel="Search products"
                style={styles.searchInput}
              />
            </View>
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
              <Pressable onPress={() => { setError(''); setProductName(''); setCasePrices({}); setPickerVisible(false); setProductEditorVisible(true); }} accessibilityRole="button" style={({ pressed }) => [styles.createProductOption, pressed && styles.pressed]}>
                <MaterialIcons name="add-box" size={20} color={theme.colors.primary} accessible={false} />
                <View style={styles.headingCopy}>
                  <Text style={styles.optionName}>Create a new product</Text>
                  <Text style={styles.optionMeta}>Set the case price and received stock</Text>
                </View>
                <MaterialIcons name="chevron-right" size={21} color={theme.colors.primary} accessible={false} />
              </Pressable>
              {filteredProducts.length ? filteredProducts.map(({ product, pack }) => (
                <Pressable key={`${product.id}:${pack.id}`} onPress={() => addProduct(product, pack)} accessibilityRole="button" style={({ pressed }) => [styles.productOption, pressed && styles.pressed]}>
                  <View style={styles.itemIcon}>
                    <MaterialIcons name="local-drink" size={19} color={theme.colors.primary} accessible={false} />
                  </View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.optionName}>{product.name} · {casePackDisplay(pack)}</Text>
                    <Text style={styles.optionMeta}>{formatCaseQuantity(stockForCasePack(product, pack.id).totalStock)} cases in stock</Text>
                  </View>
                  <MaterialIcons name="add-circle-outline" size={21} color={theme.colors.primary} accessible={false} />
                </Pressable>
              )) : null}
              {!filteredProducts.length ? <Text style={styles.historyEmpty}>No matching products. You can create a new product above.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={supplierEditorVisible} transparent animationType="slide" onRequestClose={() => setSupplierEditorVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.formSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.pickerHeading}>
              <Text style={styles.pickerTitle}>New supplier</Text>
              <Pressable onPress={() => setSupplierEditorVisible(false)} accessibilityRole="button" accessibilityLabel="Close new supplier form" style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Supplier name *</Text>
            <TextInput value={supplierForm.name} onChangeText={name => setSupplierForm(current => ({ ...current, name }))} placeholder="Supplier name" placeholderTextColor={theme.colors.placeholder} style={styles.input} accessibilityLabel="New supplier name" />
            <Text style={styles.fieldLabel}>Contact (optional)</Text>
            <TextInput value={supplierForm.contact} onChangeText={contact => setSupplierForm(current => ({ ...current, contact }))} placeholder="Contact" placeholderTextColor={theme.colors.placeholder} style={styles.input} accessibilityLabel="New supplier contact" />
            <Text style={styles.fieldLabel}>Address (optional)</Text>
            <TextInput value={supplierForm.address} onChangeText={address => setSupplierForm(current => ({ ...current, address }))} placeholder="Supplier address" placeholderTextColor={theme.colors.placeholder} style={styles.input} accessibilityLabel="New supplier address" />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable onPress={saveSupplierDraft} accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
              <Text style={styles.saveLabel}>Use supplier in this order</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={productEditorVisible} transparent animationType="slide" onRequestClose={() => setProductEditorVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.formSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.pickerHeading}>
              <View style={styles.headingCopy}>
                <Text style={styles.pickerTitle}>New product</Text>
                <Text style={styles.sectionHint}>Supplier: {supplier}</Text>
              </View>
              <Pressable onPress={() => setProductEditorVisible(false)} accessibilityRole="button" accessibilityLabel="Close new product form" style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Product name *</Text>
            <TextInput value={productName} onChangeText={setProductName} placeholder="Product name" placeholderTextColor={theme.colors.placeholder} style={styles.input} accessibilityLabel="New product name" />
            <Text style={styles.fieldLabel}>Unit and selling price per case *</Text>
            {casePackOptionsForProduct({ name: productName }).map(pack => {
              return (
                <View key={pack.id} style={styles.newProductPack}>
                  <View style={styles.packChoice}>
                    <MaterialIcons name="check-circle" size={21} color={theme.colors.primary} accessible={false} />
                    <Text style={styles.optionName}>{casePackDisplay(pack)}</Text>
                  </View>
                  <View style={styles.priceEditor}>
                    <Text style={styles.sellingPriceLabel}>Selling price / case</Text>
                    <PesoInput value={casePrices[pack.id] || ''} onChangeText={value => setCasePrices(current => ({ ...current, [pack.id]: value }))} placeholder="0" placeholderTextColor={theme.colors.placeholder} keyboardType="decimal-pad" accessibilityLabel={`${casePackDisplay(pack)} selling price per case in pesos`} style={[styles.input, styles.priceInput]} />
                  </View>
                </View>
              );
            })}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable onPress={saveNewProductDraft} accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
              <Text style={styles.saveLabel}>Add product lines</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedRecord)} transparent animationType="fade" onRequestClose={() => setSelectedRecord(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.pickerHeading}>
              <View style={styles.headingCopy}>
                <Text style={styles.pickerTitle}>Supplier order details</Text>
                <Text style={styles.sectionHint}>{selectedRecord?.supplier} · {selectedRecord?.date}</Text>
              </View>
              <Pressable onPress={() => setSelectedRecord(null)} accessibilityRole="button" accessibilityLabel="Close supplier order details" style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailSectionTitle}>Products received</Text>
              {selectedRecord?.items.map((item, index) => (
                <View key={`${item.productId}-${index}`} style={styles.detailRow}>
                  <View style={styles.headingCopy}>
                    <Text style={styles.historySupplier}>{item.productName}</Text>
                    <Text style={styles.historyMeta}>{item.packLabel ? `${casePackDisplay({ id: item.packId, label: item.packLabel, unitsPerCase: item.unitsPerCase })} · ` : ''}{formatCaseQuantity(item.quantity)} {item.quantity === 1 ? 'case' : 'cases'} × {formatPeso(item.unitCost)} per case</Text>
                  </View>
                  <Text style={styles.detailAmount}>{formatPeso(item.quantity * item.unitCost)}</Text>
                </View>
              ))}
              <View style={styles.modalDivider} />
              <Text style={styles.detailSectionTitle}>Returned cases</Text>
              {selectedRecord?.returnedCases?.length ? selectedRecord.returnedCases.map((item, index) => (
                <View key={`${item.type}-${index}`} style={styles.detailRow}>
                  <Text style={styles.historySupplier}>{item.type} · {formatCaseQuantity(item.quantity)} cases</Text>
                  <Text style={styles.creditValue}>−{formatPeso(item.quantity * item.creditPerUnit)}</Text>
                </View>
              )) : <Text style={styles.historyMeta}>No returned cases recorded.</Text>}
              <View style={styles.modalDivider} />
              <View style={styles.detailSummary}>
                <SummaryLine label="Product cost" amount={selectedRecord?.totalProductCost ?? selectedRecord?.totalCost ?? 0} />
                <SummaryLine label="Return credits" amount={selectedRecord?.totalReturnedCredit ?? 0} negative />
                <View style={styles.netRow}>
                  <Text style={styles.netLabel}>Net cost</Text>
                  <Text style={styles.netValue}>{formatPeso(selectedRecord?.netCost)}</Text>
                </View>
              </View>
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
  content: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'], gap: theme.spacing.md },
  createModal: { flex: 1, backgroundColor: theme.colors.background },
  createScroll: { flex: 1 },
  createContent: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, gap: theme.spacing.lg },
  createHeader: { minHeight: 116, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, backgroundColor: theme.colors.primary },
  createHeaderCopy: { flex: 1, alignItems: 'center' },
  createTitle: { color: theme.colors.onPrimary, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, textAlign: 'center' },
  createSubtitle: { color: theme.colors.onPrimaryMuted, fontSize: theme.fontSize.sm, marginTop: 2, textAlign: 'center' },
  createClose: { position: 'absolute', right: theme.spacing.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: theme.colors.onPrimaryOverlay },
  createFooter: { gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
  footerTotal: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, borderRadius: 9, backgroundColor: theme.colors.primary },
  footerCaption: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  footerAmount: { color: theme.colors.onPrimary, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  headingCopy: { flex: 1 },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.onPrimary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.onPrimary, opacity: 0.82, fontSize: theme.fontSize.sm, marginTop: theme.spacing.xs },
  orderMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.md, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  orderNumberBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.xs },
  orderDateBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.xs },
  metaCaption: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  orderNumberValue: { minWidth: 132, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: theme.colors.text, color: theme.colors.text, fontSize: theme.fontSize.xs },
  orderDateValue: { minWidth: 110, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: theme.colors.text, color: theme.colors.text, fontSize: theme.fontSize.xs, textAlign: 'center' },
  headingAction: { minHeight: 46, maxWidth: 210, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.surface },
  closeHeadingAction: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: theme.colors.surface },
  headingActionLabel: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  section: { gap: theme.spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  sectionHint: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.surface },
  searchInput: { flex: 1, minHeight: 46, color: theme.colors.text, fontSize: theme.fontSize.sm },
  supplierList: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm, paddingBottom: 2 },
  supplierChip: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  supplierChipSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  supplierLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  supplierLabelSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  addButton: { minWidth: 48, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primary },
  addButtonLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  disabled: { opacity: 0.45 },
  emptyProducts: { alignItems: 'center', paddingVertical: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', borderRadius: 12 },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginTop: theme.spacing.sm },
  emptyHint: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  productTableHeader: { minHeight: 40, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border, marginTop: theme.spacing.xs },
  tableHeading: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  productFieldHeadings: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, paddingTop: theme.spacing.sm },
  fieldHeading: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  orderItem: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  orderItemHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  itemIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.colors.primarySoft },
  itemNameBlock: { flex: 1 },
  itemName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  itemMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  itemField: { flexGrow: 1, flexBasis: 120, minWidth: 110 },
  quantityField: { flex: 1, minWidth: 96 },
  costField: { flex: 1.35, minWidth: 150 },
  totalField: { flex: 0.8, minWidth: 82, textAlign: 'right' },
  fieldLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginBottom: 5 },
  input: { minHeight: 48, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.base },
  lineTotal: { flex: 0.8, minWidth: 82, alignItems: 'flex-end' },
  lineTotalValue: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  creditTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  creditTotalLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  creditTotalValue: { color: theme.colors.success, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  summarySection: { gap: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
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
  historySection: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  historyFilterRow: { flexDirection: 'row', gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
  historyFilterChip: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, backgroundColor: theme.colors.surface },
  historyFilterChipSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  historyFilterText: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  historyFilterTextSelected: { color: theme.colors.onPrimary },
  customRangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  rangeInput: { minHeight: 44, flexGrow: 1, flexBasis: 145, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.sm },
  historyResults: { marginTop: theme.spacing.sm },
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
  pickerSheet: { width: '100%', height: '88%', maxHeight: '94%', minHeight: '70%', maxWidth: 760, alignSelf: 'center', padding: theme.spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: theme.colors.surface },
  pickerList: { flex: 1 },
  detailSheet: { maxHeight: '85%', padding: theme.spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: theme.colors.surface },
  detailContent: { gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  detailSectionTitle: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, marginTop: theme.spacing.sm },
  modalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
  detailRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: theme.spacing.xs },
  detailAmount: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  creditValue: { color: theme.colors.success, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  detailSummary: { gap: theme.spacing.xs, marginTop: theme.spacing.sm, padding: theme.spacing.md, borderRadius: 11, backgroundColor: theme.colors.background },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  formSheet: { width: '100%', maxWidth: 620, maxHeight: '90%', alignSelf: 'center', padding: theme.spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: theme.colors.surface },
  secondaryButton: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  secondaryButtonLabel: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  createProductOption: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  newProductPack: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  packChoice: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  priceInput: { width: 160, minHeight: 44 },
  priceEditor: { width: 175, gap: 4 },
  sellingPriceLabel: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  pickerTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  productOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  optionName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  optionMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  toast: { position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, bottom: theme.spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primary, elevation: 5 },
  toastText: { flex: 1, color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
