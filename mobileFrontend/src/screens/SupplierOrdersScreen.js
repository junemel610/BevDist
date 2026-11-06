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
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { hasValidSupplierOrderItems, supplierOrderTotals } from '../components/supplierOrders/supplierOrderUtils';
import { casePackDisplay, casePackOptionsForProduct, casePacksForProduct } from '../components/orders/casePacks';
import { formatCaseQuantity } from '../components/orders/caseQuantity';
import { stockForCasePack } from '../components/inventory/inventoryUtils';
import { confirmAction } from '../utils/confirmAction';

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const { width } = useWindowDimensions();
  const compact = width < 380;

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const suppliers = useMemo(() => savedSuppliers.map(entry => entry.name), [savedSuppliers]);
  const filteredSuppliers = suppliers.filter(name => name.toLocaleLowerCase().includes(supplierSearch.trim().toLocaleLowerCase()));
  const savedSupplier = savedSuppliers.find(entry => entry.name === selectedSupplier) || savedSuppliers[0] || null;
  const supplierRecord = supplierDraft || savedSupplier;
  const supplier = supplierRecord?.name || '';
  const supplierProducts = useMemo(() => supplierDraft ? [] : products.filter(product => product.supplierId === supplierRecord?.id), [products, supplierDraft, supplierRecord?.id]);
  const availableProducts = supplierProducts.flatMap(product => casePacksForProduct(product).map(pack => ({ product, pack })))
    .filter(({ product, pack }) => !items.some(item => item.productId === product.id && item.packId === pack.id));
  const filteredProducts = availableProducts.filter(({ product, pack }) => `${product.name} ${pack.label}`.toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase()));
  const numericReturns = returnedCases.map(item => ({ ...item, quantity: Number(item.quantity) || 0, creditPerUnit: Number(item.creditPerUnit) || 0 }));
  const totals = supplierOrderTotals(items.map(item => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unitCost: Number(item.unitCost) || 0,
  })), numericReturns);
  const todayLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date());

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

  const addProduct = (product, pack) => {
    setItems(current => [...current, { rowKey: `${product.id}:${pack.id}`, productId: product.id, productName: product.name, packId: pack.id, packLabel: casePackDisplay(pack), quantity: '', unitCost: '' }]);
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
      packId: pack.id, packLabel: casePackDisplay(pack), casePrice: pack.casePrice, quantity: '', unitCost: '',
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

  const addReturnedCase = () => {
    setReturnedCases(current => [...current, { rowKey: `return-${Date.now()}-${current.length}`, type: '', quantity: 0, creditPerUnit: '' }]);
  };

  const removeReturnedCase = rowKey => setReturnedCases(current => current.filter(item => item.rowKey !== rowKey));

  const adjustReturnedCase = (rowKey, delta) => {
    setReturnedCases(current => current.map(item => item.rowKey === rowKey
      ? { ...item, quantity: Math.max(0, Math.round((Number(item.quantity) + delta) * 2) / 2) }
      : item));
  };

  const updateReturnedCase = (rowKey, field, value) => {
    setReturnedCases(current => current.map(item => item.rowKey === rowKey ? { ...item, [field]: value } : item));
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
      },
    });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.pageHeading, styles.pageHeadingBand]}>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={styles.title}>Supplier order</Text>
            <Text style={styles.subtitle}>Record products received and returned cases.</Text>
          </View>
          <View style={styles.headingIcon}>
            <MaterialIcons name="local-shipping" size={23} color={theme.colors.onPrimary} accessible={false} />
          </View>
        </View>

        <View style={styles.orderMeta}>
          <View>
            <Text style={styles.metaCaption}>ORDER NO.</Text>
            <Text style={styles.metaValue}>Assigned when saved</Text>
          </View>
          <View style={styles.metaDate}>
            <Text style={styles.metaCaption}>DATE</Text>
            <Text style={styles.metaValue}>{todayLabel}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text style={styles.sectionTitle}>Supplier details</Text>
              <Text style={styles.sectionHint}>{supplier || 'Select an existing supplier or add a new one.'}</Text>
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
              <Text style={styles.sectionHint}>{supplierProducts.length} {supplierProducts.length === 1 ? 'product' : 'products'} from {supplier || 'selected supplier'}</Text>
            </View>
            <Pressable
              onPress={() => { setProductSearch(''); setPickerVisible(true); }}
              disabled={!supplierRecord}
              accessibilityRole="button" accessibilityLabel="Add product"
              style={({ pressed }) => [styles.addButton, !supplierRecord && styles.disabled, pressed && styles.pressed]}
            >
              <MaterialIcons name="add" size={20} color={theme.colors.onPrimary} accessible={false} />
              {!compact && <Text style={styles.addButtonLabel}>Add product</Text>}
            </Pressable>
          </View>

          <View style={styles.productTableHeader}>
            <Text style={styles.tableHeading}>ITEMS RECEIVED</Text>
            <Text style={styles.tableHint}>Quantity · Cost per case · Line total</Text>
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
                <View style={styles.itemIcon}>
                  <MaterialIcons name="local-drink" size={19} color={theme.colors.primary} accessible={false} />
                </View>
                <View style={styles.itemNameBlock}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>{item.newProductKey ? `${item.packLabel} · new product; stock is added when saved` : `${item.packLabel} · current stock: ${formatCaseQuantity(stockForCasePack(products.find(product => product.id === item.productId), item.packId).totalStock)} cases`}</Text>
                </View>
                <Pressable onPress={() => removeItem(item.rowKey)} accessibilityRole="button" accessibilityLabel={`Remove ${item.productName} ${item.packLabel}`} style={styles.removeButton}>
                  <MaterialIcons name="delete-outline" size={21} color={theme.colors.danger} accessible={false} />
                </Pressable>
              </View>
              <View style={styles.fieldsRow}>
                <View style={[styles.itemField, styles.quantityField]}>
                  <Text style={styles.fieldLabel}>Quantity (cases)</Text>
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
                <View style={[styles.itemField, styles.costField]}>
                  <Text style={styles.fieldLabel}>Supplier cost per case</Text>
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
              <Text style={styles.sectionHint}>Add returned containers or items. Their refund reduces the supplier order cost.</Text>
            </View>
            <MaterialIcons name="replay" size={21} color={theme.colors.textLight} accessible={false} />
          </View>
          {returnedCases.map((item, index) => (
            <View key={item.rowKey} style={styles.returnRow}>
              <View style={styles.returnHeading}>
                <Text style={styles.returnName}>Return line {index + 1}</Text>
                <Pressable onPress={() => removeReturnedCase(item.rowKey)} accessibilityRole="button" accessibilityLabel={`Remove return line ${index + 1}`} style={styles.removeButton}>
                  <MaterialIcons name="delete-outline" size={21} color={theme.colors.danger} accessible={false} />
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>What container or item?</Text>
              <TextInput
                value={item.type}
                onChangeText={value => updateReturnedCase(item.rowKey, 'type', value)}
                placeholder="e.g. Bottle crate"
                placeholderTextColor={theme.colors.placeholder}
                accessibilityLabel={`Return line ${index + 1} container or item`}
                style={styles.input}
              />
              <View style={styles.returnEntryRow}>
                <View style={styles.returnQuantityField}>
                  <Text style={styles.fieldLabel}>Quantity (cases)</Text>
                  <View style={styles.returnStepper}>
                    <Pressable onPress={() => adjustReturnedCase(item.rowKey, -0.5)} accessibilityRole="button" accessibilityLabel={`Decrease quantity for return line ${index + 1}`} disabled={!item.quantity} accessibilityState={{ disabled: !item.quantity }} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                      <MaterialIcons name="remove" size={20} color={theme.colors.primary} accessible={false} />
                    </Pressable>
                    <Text accessibilityLabel={`${formatCaseQuantity(item.quantity)} cases returned`} style={styles.stepValue}>{formatCaseQuantity(item.quantity)}</Text>
                    <Pressable onPress={() => adjustReturnedCase(item.rowKey, 0.5)} accessibilityRole="button" accessibilityLabel={`Increase quantity for return line ${index + 1}`} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                      <MaterialIcons name="add" size={20} color={theme.colors.primary} accessible={false} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.returnPriceField}>
                  <Text style={styles.fieldLabel}>Refund per case</Text>
                  <PesoInput
                    value={String(item.creditPerUnit ?? '')}
                    onChangeText={value => updateReturnedCase(item.rowKey, 'creditPerUnit', value)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.colors.placeholder}
                    accessibilityLabel={`Return line ${index + 1} refund per case in pesos`}
                    style={styles.returnPriceInput}
                  />
                </View>
                <Text style={styles.returnAmount}>{formatPeso((Number(item.quantity) || 0) * (Number(item.creditPerUnit) || 0))}</Text>
              </View>
            </View>
          ))}
          <Pressable onPress={addReturnedCase} accessibilityRole="button" style={({ pressed }) => [styles.addReturnButton, pressed && styles.pressed]}>
            <MaterialIcons name="add" size={19} color={theme.colors.primary} accessible={false} />
            <Text style={styles.addReturnLabel}>Add return line</Text>
          </Pressable>
          <View style={styles.creditTotal}>
            <Text style={styles.creditTotalLabel}>Total return refund</Text>
            <Text style={styles.creditTotalValue}>−{formatPeso(totals.returnCredit)}</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Order total</Text>
          <SummaryLine label="Products received" amount={totals.productCost} />
          <SummaryLine label="Returned case credits" amount={totals.returnCredit} negative />
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
            <Pressable key={record.id} onPress={() => setSelectedRecord(record)} accessibilityRole="button" accessibilityLabel={`View ${record.supplier} supplier order from ${record.date}`} accessibilityHint="Opens supplier order details" style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
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
              <MaterialIcons name="chevron-right" size={22} color={theme.colors.textLight} accessible={false} />
            </Pressable>
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
            <ScrollView>
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
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  headingCopy: { flex: 1 },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.onPrimary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.onPrimary, opacity: 0.82, fontSize: theme.fontSize.sm, marginTop: theme.spacing.xs },
  orderMeta: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  metaCaption: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold, letterSpacing: 0.5 },
  metaValue: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginTop: 4 },
  metaDate: { alignItems: 'flex-end' },
  headingIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  section: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
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
  productTableHeader: { minHeight: 40, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border, marginTop: theme.spacing.xs },
  tableHeading: { color: theme.colors.textLight, fontSize: 10, fontWeight: theme.fontWeight.bold, letterSpacing: 0.45 },
  tableHint: { color: theme.colors.textLight, fontSize: 10 },
  orderItem: { paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  orderItemHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  itemIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.colors.primarySoft },
  itemNameBlock: { flex: 1 },
  itemName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  itemMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.sm, paddingLeft: 46 },
  itemField: { flexGrow: 1, flexBasis: 120, minWidth: 110 },
  quantityField: { maxWidth: 150 },
  costField: { maxWidth: 190 },
  fieldLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginBottom: 5 },
  input: { minHeight: 48, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.base },
  lineTotal: { minWidth: 72, alignItems: 'flex-end', paddingBottom: 12 },
  lineTotalValue: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  returnRow: { paddingVertical: theme.spacing.sm, gap: theme.spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.border },
  returnHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  returnEntryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  returnQuantityField: { flexGrow: 1, flexBasis: 160, minWidth: 150 },
  returnPriceField: { flexGrow: 1, flexBasis: 130, maxWidth: 180 },
  returnPriceInput: { minHeight: 42, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.sm },
  returnStepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  stepValue: { minWidth: 44, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, textAlign: 'center' },
  returnName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  returnAmount: { minWidth: 76, color: theme.colors.success, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, textAlign: 'right' },
  addReturnButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  addReturnLabel: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
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
  historySection: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
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
