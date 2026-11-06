import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../../styles/theme';
import { availableCases, casePackDisplay, casePacksForProduct, caseQuantityInputError } from './casePacks';
import { formatCaseQuantity } from './caseQuantity';
import { DISTRIBUTOR_CATALOG, distributorIdForProduct, extraProductsForDistributor, findCatalogProduct, otherDistributorFilters } from './distributorCatalog';

const peso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH')}`;

export function InvoiceProductPicker({ products, cart, editingOrder, getAvailableStock, onChangeQuantity, onDone, onSetupProduct }) {
  const [distributor, setDistributor] = useState('all');
  const [search, setSearch] = useState('');
  const extraFilters = useMemo(() => otherDistributorFilters(products), [products]);
  const filters = useMemo(() => [{ id: 'all', name: 'All' }, ...DISTRIBUTOR_CATALOG.map(({ id, name }) => ({ id, name })), ...extraFilters], [extraFilters]);
  const selectedCount = Object.values(cart).reduce((sum, value) => sum + (Number(value) > 0 ? 1 : 0), 0);
  const query = search.trim().toLocaleLowerCase();
  const filteredCatalog = distributor === 'all' ? DISTRIBUTOR_CATALOG : DISTRIBUTOR_CATALOG.filter(item => item.id === distributor);
  const knownDistributors = new Set(DISTRIBUTOR_CATALOG.map(item => item.id));
  const filteredExtras = distributor === 'all'
    ? [...DISTRIBUTOR_CATALOG.flatMap(item => extraProductsForDistributor(products, item.id)), ...products.filter(product => !knownDistributors.has(distributorIdForProduct(product)))]
    : extraProductsForDistributor(products, distributor);

  const renderProduct = (product, displayName = product.name, configured = true, supplierName = product.supplier) => {
    const packs = configured ? casePacksForProduct(product) : [];
    const pack = packs[0];
    const key = pack ? `${product.id}:${pack.id}` : '';
    const quantity = key ? Number(cart[key]) || 0 : 0;
    const existing = editingOrder?.items.filter(item => item.productId === product.id && item.packId === pack?.id).reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
    const available = pack ? getAvailableStock(product.id, pack.id) + existing : 0;
    const maximum = pack ? availableCases(available, pack) : 0;
    const quantityError = key ? caseQuantityInputError(cart[key] ?? '', maximum) : '';
    const price = pack?.casePrice;
    const priceMissing = price == null || Number(price) <= 0;
    const unavailable = !configured || priceMissing || maximum < 0.5;
    return (
      <View key={configured ? product.id : `catalog:${displayName}`} style={styles.productRow}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{displayName}</Text>
          {configured ? <Text style={styles.productMeta}>{priceMissing ? 'Selling price not set' : `${peso(price)} / case`} · {formatCaseQuantity(maximum)} available</Text>
            : <Text style={styles.unavailableText}>Not in inventory yet. Add it to set its case price and opening stock.</Text>}
          {!!quantityError && <Text accessibilityRole="alert" style={styles.error}>{quantityError}</Text>}
        </View>
        {configured && !quantity && !priceMissing ? (
          <Pressable onPress={() => onChangeQuantity(product.id, pack.id, 0.5)} disabled={unavailable} accessibilityRole="button" accessibilityLabel={`Add ${displayName} to invoice`} style={[styles.addButton, unavailable && styles.disabled]}>
            <MaterialIcons name="add" size={19} color={unavailable ? theme.colors.textLight : theme.colors.primary} accessible={false} />
            <Text style={[styles.addButtonText, unavailable && styles.disabledText]}>{maximum < 0.5 ? 'Out of stock' : 'Add'}</Text>
          </Pressable>
        ) : configured && !priceMissing ? (
          <View style={styles.quantityControls}>
            <Pressable onPress={() => onChangeQuantity(product.id, pack.id, Math.max(0, quantity - 0.5))} accessibilityRole="button" accessibilityLabel={`Remove half a case of ${displayName}`} style={styles.quantityButton}>
              <MaterialIcons name="remove" size={18} color={theme.colors.primary} accessible={false} />
            </Pressable>
            <TextInput value={String(cart[key] ?? '0')} onChangeText={value => onChangeQuantity(product.id, pack.id, value)} selectTextOnFocus keyboardType="decimal-pad" accessibilityLabel={`${displayName}, ${casePackDisplay(pack)}, quantity in cases`} style={[styles.quantityInput, quantityError && styles.quantityInputError]} />
            <Pressable onPress={() => onChangeQuantity(product.id, pack.id, quantity + 0.5)} disabled={quantity + 0.5 > maximum} accessibilityRole="button" accessibilityLabel={`Add half a case of ${displayName}`} style={[styles.quantityButton, quantity + 0.5 > maximum && styles.disabled]}>
              <MaterialIcons name="add" size={18} color={quantity + 0.5 > maximum ? theme.colors.textLight : theme.colors.primary} accessible={false} />
            </Pressable>
          </View>
        ) : <Pressable onPress={() => onSetupProduct?.({ name: displayName, supplier: supplierName, ...(configured ? { productId: product.id } : {}) })} accessibilityRole="button" accessibilityLabel={`${priceMissing && configured ? 'Set price and stock for' : 'Add'} ${displayName} ${configured ? 'in inventory' : 'to inventory'}`} style={styles.setupButton}>
          <MaterialIcons name="add" size={17} color={theme.colors.primary} accessible={false} />
          <Text style={styles.setupButtonText}>{priceMissing && configured ? 'Set price' : 'Add to stock'}</Text>
        </Pressable>}
      </View>
    );
  };

  const shownInventoryIds = new Set();
  const catalogSections = filteredCatalog.map(item => ({
    id: item.id,
    name: item.name,
    groups: item.groups.map(group => ({
      ...group,
      rows: group.products
        .filter(name => !query || name.toLocaleLowerCase().includes(query))
        .map(name => {
          const found = findCatalogProduct(name, products, item.id);
          if (found) shownInventoryIds.add(found.id);
          return found ? renderProduct(found) : renderProduct({ id: name }, name, false, item.name);
        }),
    })).filter(group => group.rows.length),
  })).filter(item => item.groups.length);

  const extraGroups = filteredExtras.filter(product => !shownInventoryIds.has(product.id) && (!query || product.name.toLocaleLowerCase().includes(query)))
    .reduce((groups, product) => {
      const name = product.supplier || 'Other distributor';
      const group = groups.find(item => item.name === name) || { id: `extra:${name}`, name, rows: [] };
      if (!groups.includes(group)) groups.push(group);
      group.rows.push(renderProduct(product));
      return groups;
    }, []);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={20} color={theme.colors.textLight} accessible={false} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search products" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Search invoice products" style={styles.searchInput} returnKeyType="search" />
        {!!search && <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear product search" style={styles.clearButton}><MaterialIcons name="close" size={18} color={theme.colors.textLight} accessible={false} /></Pressable>}
      </View>
      <View style={styles.filters} testID="distributor-filters">
        {filters.map(filter => {
          const selected = distributor === filter.id;
          return <Pressable key={filter.id} onPress={() => setDistributor(filter.id)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${filter.name} distributor filter`} style={[styles.filterChip, selected && styles.filterChipSelected]}>
            {selected && <MaterialIcons name="check" size={15} color={theme.colors.onPrimary} accessible={false} />}
            <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.name}</Text>
          </Pressable>;
        })}
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {!catalogSections.length && !extraGroups.length ? <Text style={styles.empty}>No products match this search.</Text> : null}
        {catalogSections.map(section => <View key={section.id} style={styles.distributorSection}>
          <Text style={styles.distributorTitle}>{section.name}</Text>
          {section.groups.map(group => <View key={group.name} style={styles.productGroup}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            {group.rows}
          </View>)}
        </View>)}
        {extraGroups.map(group => <View key={group.id} style={styles.distributorSection}>
          <Text style={styles.distributorTitle}>{group.name}</Text>
          {group.rows}
        </View>)}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.selectedCount}>{selectedCount} {selectedCount === 1 ? 'product' : 'products'} selected</Text>
        <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel="Done selecting products" style={styles.doneButton}>
          <Text style={styles.doneText}>Done</Text>
          <MaterialIcons name="arrow-forward" size={18} color={theme.colors.onPrimary} accessible={false} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 46, color: theme.colors.text, fontSize: 16, paddingVertical: 8 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 16, paddingVertical: 8 },
  filterChip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, backgroundColor: theme.colors.surface },
  filterChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textLight, fontSize: 13, fontWeight: '600' },
  filterTextSelected: { color: theme.colors.onPrimary },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  distributorSection: { gap: 10, paddingTop: 8 },
  distributorTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700', borderBottomWidth: 1, borderColor: theme.colors.border, paddingBottom: 8 },
  productGroup: { gap: 4 },
  groupTitle: { color: theme.colors.textLight, fontSize: 13, fontWeight: '700', paddingVertical: 4 },
  productRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, paddingVertical: 8 },
  productInfo: { flex: 1, minWidth: 0, gap: 3 },
  productName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  productMeta: { color: theme.colors.textLight, fontSize: 13 },
  unavailableText: { color: theme.colors.textLight, fontSize: 12, lineHeight: 17 },
  setupButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 999, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 10 },
  setupButtonText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
  addButton: { minHeight: 44, minWidth: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 8, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 8 },
  addButtonText: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  disabledText: { color: theme.colors.textLight },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quantityButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: theme.colors.primarySoft },
  quantityInput: { width: 56, height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, textAlign: 'center', color: theme.colors.text, fontSize: 15 },
  quantityInputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: 12 },
  empty: { padding: 18, color: theme.colors.textLight, textAlign: 'center' },
  footer: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 16, backgroundColor: theme.colors.background },
  selectedCount: { color: theme.colors.textLight, fontSize: 14 },
  doneButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 18 },
  doneText: { color: theme.colors.onPrimary, fontSize: 15, fontWeight: '700' },
});
