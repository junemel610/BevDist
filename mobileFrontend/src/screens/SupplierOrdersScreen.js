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
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { hasValidSupplierOrderItems, RETURNED_CASE_TYPES, supplierOrderTotals } from '../components/supplierOrders/supplierOrderUtils';
import { casePackOptionsForProduct, casePacksForProduct } from '../components/orders/casePacks';
import { stockForCasePack } from '../components/inventory/inventoryUtils';
import { confirmAction } from '../utils/confirmAction';

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function SupplierOrdersScreen() {
  const { products, suppliers: savedSuppliers, casePackTypes = [], restockRecords, addRestockRecord } = useApp();
  const [selectedSupplier, setSupplier] = useState('');
  const [supplierDraft, setSupplierDraft] = useState(null);
  const [supplierEditorVisible, setSupplierEditorVisible] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', address: '' });
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productEditorVisible, setProductEditorVisible] = useState(false);
  const [productName, setProductName] = useState('');
  const [selectedPackIds, setSelectedPackIds] = useState([]);
  const [casePrices, setCasePrices] = useState({});
  const [newProducts, setNewProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [returnedCases, setReturnedCases] = useState(RETURNED_CASE_TYPES.map(item => ({ ...item, quantity: 0, creditPerUnit: '' })));
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
    setItems(current => [...current, { rowKey: `${product.id}:${pack.id}`, productId: product.id, productName: product.name, packId: pack.id, packLabel: pack.label, quantity: '', unitCost: '' }]);
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
    if (!selectedPackIds.length) { setError('Select at least one case type.'); return; }
    if (selectedPackIds.some(packId => !/^\d+(\.\d{1,2})?$/.test(String(casePrices[packId])) || !(Number(casePrices[packId]) > 0))) { setError('Enter a numeric selling price for every selected case type.'); return; }
    const key = `new-product-${Date.now()}`;
    const packs = casePackOptionsForProduct({ name, casePackTypes }).filter(pack => selectedPackIds.includes(pack.id));
    if (!packs.length) { setError('The selected case types do not match this product name. Review the case types.'); return; }
    const product = { key, name, packs: packs.map(pack => ({ ...pack, casePrice: Number(casePrices[pack.id]) })) };
    setNewProducts(current => [...current, product]);
    setItems(current => [...current, ...product.packs.map(pack => ({
      rowKey: `${key}:${pack.id}`, newProductKey: key, productName: name,
      packId: pack.id, packLabel: pack.label, casePrice: pack.casePrice, quantity: '', unitCost: '',
    }))]);
    setProductEditorVisible(false);
    setPickerVisible(false);
    setProductName('');
    setSelectedPackIds([]);
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

  const adjustReturnedCase = (type, delta) => {
    setReturnedCases(current => current.map(item => item.type === type
      ? { ...item, quantity: Math.max(0, Math.round((Number(item.quantity) + delta) * 2) / 2) }
      : item));
  };

  const updateReturnPrice = (type, creditPerUnit) => {
    setReturnedCases(current => current.map(item => item.type === type ? { ...item, creditPerUnit } : item));
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

    const recordedReturns = numericReturns.filter(item => item.quantity > 0);
    if (returnedCases.some(item => item.quantity > 0 && (!/^\d+(\.\d{1,2})?$/.test(String(item.creditPerUnit)) || Number(item.creditPerUnit) <= 0))) {
      setError('Enter a credit price for each returned case type with a quantity.');
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
        setReturnedCases(RETURNED_CASE_TYPES.map(item => ({ ...item, quantity: 0, creditPerUnit: '' })));
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
        <Text style={styles.subtitle}>Enter supplier purchase costs. Returned cases are optional.</Text>
          </View>
          <View style={styles.headingIcon}>
            <MaterialIcons name="local-shipping" size={23} color={theme.colors.onPrimary} accessible={false} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text style={styles.sectionTitle}>Supplier</Text>
              <Text style={styles.sectionHint}>{supplier || 'Choose or add a supplier'}</Text>
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
              <Text style={styles.sectionHint}>{supplierProducts.length} products from {supplier}</Text>
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
                  <Text style={styles.itemMeta}>{item.newProductKey ? `${item.packLabel} · new product; stock is added when saved` : `${item.packLabel} · current stock: ${stockForCasePack(products.find(product => product.id === item.productId), item.packId).totalStock} cases`}</Text>
                </View>
                <Pressable onPress={() => removeItem(item.rowKey)} accessibilityRole="button" accessibilityLabel={`Remove ${item.productName} ${item.packLabel}`} style={styles.removeButton}>
                  <MaterialIcons name="delete-outline" size={21} color={theme.colors.danger} accessible={false} />
                </Pressable>
              </View>
              <View style={styles.fieldsRow}>
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>Quantity (cases)</Text>
                  <TextInput
                    value={String(item.quantity)}
                    onChangeText={value => updateItem(item.rowKey, 'quantity', value)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    accessibilityLabel={`${item.productName} quantity in cases`}
                    style={styles.input}
                  />
                </View>
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>Supplier cost per case (₱)</Text>
                  <TextInput
                    value={String(item.unitCost)}
                    onChangeText={value => updateItem(item.rowKey, 'unitCost', value)}
                    keyboardType="decimal-pad"
                    placeholder="Enter numbers, e.g. 950"
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
              <Text style={styles.sectionHint}>Credits reduce the supplier order cost.</Text>
            </View>
            <MaterialIcons name="replay" size={21} color={theme.colors.textLight} accessible={false} />
          </View>
          {returnedCases.map(item => (
            <View key={item.type} style={styles.returnRow}>
              <View style={styles.returnHeading}>
                <Text style={styles.returnName}>{item.type}</Text>
                <View style={styles.returnPriceField}>
                  <Text style={styles.fieldLabel}>Credit per case</Text>
                  <TextInput
                    value={String(item.creditPerUnit ?? '')}
                    onChangeText={value => updateReturnPrice(item.type, value)}
                    keyboardType="decimal-pad"
                    placeholder="₱0.00"
                    accessibilityLabel={`${item.type} return credit per case`}
                    style={styles.returnPriceInput}
                  />
                </View>
              </View>
              <View style={styles.returnControls}>
                <Text style={styles.returnCredit}>Quantity (half-case steps)</Text>
                <View style={styles.returnStepper}>
                  <Pressable onPress={() => adjustReturnedCase(item.type, -0.5)} accessibilityRole="button" accessibilityLabel={`Remove half case of ${item.type}`} disabled={!item.quantity} accessibilityState={{ disabled: !item.quantity }} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                    <MaterialIcons name="remove" size={20} color={theme.colors.primary} accessible={false} />
                  </Pressable>
                  <Text accessibilityLabel={`${item.quantity} cases returned`} style={styles.stepValue}>{Number(item.quantity).toLocaleString('en-PH', { maximumFractionDigits: 1 })}</Text>
                  <Pressable onPress={() => adjustReturnedCase(item.type, 0.5)} accessibilityRole="button" accessibilityLabel={`Add half case of ${item.type}`} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                    <MaterialIcons name="add" size={20} color={theme.colors.primary} accessible={false} />
                  </Pressable>
                </View>
                <Text style={styles.returnAmount}>{formatPeso((Number(item.quantity) || 0) * (Number(item.creditPerUnit) || 0))}</Text>
              </View>
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
                placeholder="Search products or case type"
                accessibilityLabel="Search products"
                style={styles.searchInput}
              />
            </View>
            <ScrollView>
              <Pressable onPress={() => { setError(''); setProductName(''); setSelectedPackIds([]); setCasePrices({}); setPickerVisible(false); setProductEditorVisible(true); }} accessibilityRole="button" style={({ pressed }) => [styles.createProductOption, pressed && styles.pressed]}>
                <MaterialIcons name="add-box" size={20} color={theme.colors.primary} accessible={false} />
                <View style={styles.headingCopy}>
                  <Text style={styles.optionName}>Create a new product</Text>
                  <Text style={styles.optionMeta}>Add case types, selling prices, and received stock</Text>
                </View>
                <MaterialIcons name="chevron-right" size={21} color={theme.colors.primary} accessible={false} />
              </Pressable>
              {filteredProducts.length ? filteredProducts.map(({ product, pack }) => (
                <Pressable key={`${product.id}:${pack.id}`} onPress={() => addProduct(product, pack)} accessibilityRole="button" style={({ pressed }) => [styles.productOption, pressed && styles.pressed]}>
                  <View style={styles.itemIcon}>
                    <MaterialIcons name="local-drink" size={19} color={theme.colors.primary} accessible={false} />
                  </View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.optionName}>{product.name} · {pack.label}</Text>
                    <Text style={styles.optionMeta}>{stockForCasePack(product, pack.id).totalStock} cases in stock</Text>
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
            <TextInput value={supplierForm.name} onChangeText={name => setSupplierForm(current => ({ ...current, name }))} placeholder="Supplier name" style={styles.input} accessibilityLabel="New supplier name" />
            <Text style={styles.fieldLabel}>Contact (optional)</Text>
            <TextInput value={supplierForm.contact} onChangeText={contact => setSupplierForm(current => ({ ...current, contact }))} placeholder="Phone or contact person" style={styles.input} accessibilityLabel="New supplier contact" />
            <Text style={styles.fieldLabel}>Address (optional)</Text>
            <TextInput value={supplierForm.address} onChangeText={address => setSupplierForm(current => ({ ...current, address }))} placeholder="Supplier address" style={styles.input} accessibilityLabel="New supplier address" />
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
            <TextInput value={productName} onChangeText={setProductName} placeholder="Product name" style={styles.input} accessibilityLabel="New product name" />
            <Text style={styles.fieldLabel}>Case types and selling price per case *</Text>
            {casePackOptionsForProduct({ name: productName, casePackTypes }).map(pack => {
              const selected = selectedPackIds.includes(pack.id);
              return (
                <View key={pack.id} style={styles.newProductPack}>
                  <Pressable onPress={() => setSelectedPackIds(current => selected ? current.filter(id => id !== pack.id) : [...current, pack.id])} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} aria-checked={selected} style={styles.packChoice}>
                    <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={21} color={selected ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                    <Text style={styles.optionName}>{pack.label}</Text>
                  </Pressable>
                  {selected ? <TextInput value={casePrices[pack.id] || ''} onChangeText={value => setCasePrices(current => ({ ...current, [pack.id]: value }))} placeholder="Numbers only, e.g. 1200" keyboardType="decimal-pad" accessibilityLabel={`${pack.label} selling price per case in pesos`} style={[styles.input, styles.priceInput]} /> : null}
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
                    <Text style={styles.historyMeta}>{item.packLabel ? `${item.packLabel} · ` : ''}{item.quantity} {item.quantity === 1 ? 'case' : 'cases'} × {formatPeso(item.unitCost)} per case</Text>
                  </View>
                  <Text style={styles.detailAmount}>{formatPeso(item.quantity * item.unitCost)}</Text>
                </View>
              ))}
              <Text style={styles.detailSectionTitle}>Returned cases</Text>
              {selectedRecord?.returnedCases?.length ? selectedRecord.returnedCases.map((item, index) => (
                <View key={`${item.type}-${index}`} style={styles.detailRow}>
                  <Text style={styles.historySupplier}>{item.type} · {item.quantity} cases</Text>
                  <Text style={styles.creditValue}>−{formatPeso(item.quantity * item.creditPerUnit)}</Text>
                </View>
              )) : <Text style={styles.historyMeta}>No returned cases recorded.</Text>}
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
  input: { minHeight: 48, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.base },
  lineTotal: { minWidth: 72, alignItems: 'flex-end', paddingBottom: 12 },
  lineTotalValue: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  returnRow: { paddingVertical: theme.spacing.sm, gap: theme.spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.border },
  returnHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  returnPriceField: { width: 150 },
  returnPriceInput: { minHeight: 42, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.fontSize.sm },
  returnControls: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  returnStepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  stepValue: { minWidth: 44, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, textAlign: 'center' },
  returnName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  returnCredit: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 2 },
  returnAmount: { minWidth: 76, color: theme.colors.success, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, textAlign: 'right' },
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
  pickerTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  productOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  optionName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  optionMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  toast: { position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, bottom: theme.spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primary, elevation: 5 },
  toastText: { flex: 1, color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
