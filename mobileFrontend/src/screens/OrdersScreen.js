import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
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
import { stockNotice } from '../components/inventory/stockNotice';
import { FeedbackToast } from '../components/FeedbackToast';
import { CustomerPaymentModal } from '../components/balances/CustomerPaymentModal';
import { DeliveryBadge } from '../components/orders/DeliveryBadge';
import { ContainerReturnEditor } from '../components/orders/ContainerReturnEditor';
import { prepareContainerReturns, refundAmount, caseLineAmount } from '../components/orders/containerReturns';
import { invoiceEditorProducts } from '../components/orders/pendingInvoice';
import { invoiceSummary } from '../components/dashboard/salesSummary';
import { availableCases, casePacksForProduct, invoiceCaseItem, caseQuantityInputError } from '../components/orders/casePacks';
import { groupOpenCustomerBalances } from '../components/balances/customerAccounts';
import theme from '../styles/theme';
import { confirmAction } from '../utils/confirmAction';
import { exportInvoiceExcel, exportInvoicePdf } from '../components/orders/invoiceExport';

const FILTERS = [
  { key: 'all', label: 'All invoices' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'paid', label: 'Fully paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS = {
  unpaid: { label: 'Unpaid', color: theme.colors.danger, background: theme.colors.dangerSoft, icon: 'error-outline' },
  partial: { label: 'Partial', color: theme.colors.warning, background: theme.colors.warningSoft, icon: 'schedule' },
  paid: { label: 'Fully paid', color: theme.colors.success, background: theme.colors.successSoft, icon: 'check-circle-outline' },
  cancelled: { label: 'Cancelled', color: theme.colors.danger, background: theme.colors.dangerSoft, icon: 'cancel' },
};

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH')}`;

export function OrdersScreen({ navigation, route }) {
  const { orders, balances, products, customers, saveCustomer, createOrder, editPendingInvoice, updateOrderStatus, getAvailableStock } = useApp();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [exporting, setExporting] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const invoiceProducts = useMemo(() => invoiceEditorProducts(products, editingOrder), [products, editingOrder]);
  const [selectedCustomer, setSelectedCustomer] = useState(customers[0]);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact: '', address: '' });
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [containerReturns, setContainerReturns] = useState([]);
  const [cart, setCart] = useState({});
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [caseToast, setCaseToast] = useState('');
  const [stockFeedback, setStockFeedback] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 390 * Math.min(fontScale, 1.25);

  useEffect(() => {
    if (!caseToast) return undefined;
    const timer = setTimeout(() => setCaseToast(''), 6500);
    return () => clearTimeout(timer);
  }, [caseToast]);

  const invoiceFor = useCallback(order => invoiceSummary(order, balances.find(balance => balance.orderId === order.id)), [balances]);
  const exportInvoice = async format => {
    if (!invoiceOrder) return;
    setExporting(format);
    try {
      const balance = balances.find(item => item.orderId === invoiceOrder.id);
      if (format === 'pdf') await exportInvoicePdf(invoiceOrder, balance);
      else await exportInvoiceExcel(invoiceOrder, balance);
    } catch (error) {
      console.error('Invoice export failed:', error);
      const message = error?.message || 'Could not create this invoice file. Please try again.';
      if (Platform.OS === 'web') globalThis.alert?.(`Export failed: ${message}`);
      else Alert.alert('Export failed', message);
    } finally {
      setExporting('');
    }
  };
  const counts = useMemo(() => {
    const result = { all: orders.length, outstanding: 0, paid: 0, cancelled: 0 };
    orders.forEach(order => {
      const status = invoiceFor(order).status;
      if (status === 'unpaid' || status === 'partial') result.outstanding += 1;
      else if (status === 'paid') result.paid += 1;
      else if (status === 'cancelled') result.cancelled += 1;
    });
    return result;
  }, [orders, invoiceFor]);

  const visibleOrders = useMemo(() => orders
    .map(order => ({ ...order, lifecycleStatus: order.status, ...invoiceFor(order) }))
    .filter(order => activeFilter === 'all'
      || (activeFilter === 'outstanding' && ['unpaid', 'partial'].includes(order.status))
      || order.status === activeFilter)
    .filter(order => {
      const query = search.trim().toLocaleLowerCase();
      return !query || order.invoiceNumber.toLocaleLowerCase().includes(query)
        || order.customer.name.toLocaleLowerCase().includes(query);
    })
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date)), [orders, invoiceFor, activeFilter, search]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <FlatList
        data={visibleOrders}
        keyExtractor={order => order.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.headingBlock}>
            <View style={[styles.titleRow, styles.pageHeadingBand]}>
                <View style={styles.headingBlock}>
                  <Text accessibilityRole="header" style={styles.title}>Invoice management</Text>
                  <Text style={styles.subtitle}>{orders.length} total {orders.length === 1 ? 'invoice' : 'invoices'}</Text>
                </View>
                <Pressable
                  onPress={() => setCreatingInvoice(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Create invoice"
                  style={({ pressed }) => [styles.createButton, styles.headerActionButton, pressed && styles.pressed]}
                >
                  <MaterialIcons name="add" size={20} color={theme.colors.primary} accessible={false} />
                  <Text style={[styles.createButtonText, styles.headerActionText]}>{compact ? 'Create' : 'Create invoice'}</Text>
                </Pressable>
              </View>
            </View>
            <Pressable onPress={() => navigation.navigate('CustomerProfiles')} accessibilityRole="button" style={({ pressed }) => [styles.customerProfilesLink, pressed && styles.pressed]}>
              <MaterialIcons name="groups" size={18} color={theme.colors.primary} accessible={false} />
              <Text style={styles.customerProfilesLinkText}>Manage customer profiles</Text>
            </Pressable>

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={22} color={theme.colors.textLight} accessible={false} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by invoice or customer"
                placeholderTextColor={theme.colors.textLight}
                accessibilityLabel="Search invoices by invoice number or customer"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {!!search && (
                <Pressable
                  onPress={() => setSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear invoice search"
                  hitSlop={8}
                  style={styles.clearSearch}
                >
                  <MaterialIcons name="close" size={20} color={theme.colors.textLight} accessible={false} />
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              accessibilityLabel="Filter invoices by payment status"
            >
              {FILTERS.map(filter => {
                const selected = activeFilter === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setActiveFilter(filter.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${filter.label}, ${counts[filter.key]} ${counts[filter.key] === 1 ? 'invoice' : 'invoices'}`}
                    accessibilityState={{ selected }}
                    {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
                    style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}
                  >
                    {selected && <MaterialIcons name="check" size={15} color={theme.colors.onPrimary} accessible={false} />}
                    <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{filter.label}</Text>
                    <Text style={[styles.filterCount, selected && styles.filterCountSelected]}>{counts[filter.key]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            compact={compact}
            onView={() => setDetailOrder(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="receipt-long" size={26} color={theme.colors.primary} accessible={false} />
            </View>
            <Text style={styles.emptyTitle}>No invoices found</Text>
            <Text style={styles.emptyText}>{search ? 'Try another invoice number or customer name.' : 'There are no invoices in this status yet.'}</Text>
          </View>
        )}
      />

      <OrderDetailModal
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onEdit={() => {
          if (!detailOrder) return;
          setEditingOrder(detailOrder);
          setContainerReturns((detailOrder.containerReturns || []).map(row => ({ ...row })));
          setSelectedCustomer(detailOrder.customer);
          setIsNewCustomer(false);
          setCart(Object.fromEntries(detailOrder.items.map(item => [`${item.productId}:${item.packId}`, item.quantity])));
          setDetailOrder(null);
        }}
        onShowInvoice={() => {
          setInvoiceOrder(detailOrder);
          setDetailOrder(null);
        }}
        onPay={() => { setPaymentInvoice(detailOrder); setDetailOrder(null); }}
        onMarkDelivered={() => {
          if (!detailOrder) return;
          confirmAction({
            title: 'Mark invoice as delivered?',
            message: `${detailOrder.invoiceNumber} for ${detailOrder.customer.name}. It will be completed once it is fully paid.`,
            confirmLabel: 'Mark delivered',
            onConfirm: async () => {
              if (await updateOrderStatus(detailOrder.id, 'completed')) setDetailOrder(null);
              else Alert.alert('Could not update invoice', 'This invoice may already be delivered or cancelled.');
            },
          });
        }}
        onCancel={() => {
          if (!detailOrder) return;
          confirmAction({
            title: 'Cancel invoice?',
            message: 'Reserved stock will be released. This action cannot be undone.',
            confirmLabel: 'Cancel invoice',
            destructive: true,
            onConfirm: async () => {
              if (await updateOrderStatus(detailOrder.id, 'cancelled')) setDetailOrder(null);
              else Alert.alert('Could not cancel', 'Delivered or completed invoices cannot be cancelled here.');
            },
          });
        }}
      />
      <CreateInvoiceModal
        visible={creatingInvoice || Boolean(route.params?.openCreateInvoiceToken) || Boolean(editingOrder)}
        width={width}
        products={invoiceProducts}
        customers={customers}
        balances={balances}
        orders={orders}
        cart={cart}
        editingOrder={editingOrder}
        containerReturns={containerReturns}
        onChangeReturns={setContainerReturns}
        customer={selectedCustomer}
        isNewCustomer={isNewCustomer}
        newCustomer={newCustomer}
        getAvailableStock={getAvailableStock}
        onSelectCustomer={setSelectedCustomer}
        onSelectCustomerMode={setIsNewCustomer}
        onChangeNewCustomer={(field, value) => setNewCustomer(current => ({ ...current, [field]: value }))}
        onChangeQuantity={(productId, packId, quantity) => setCart(current => ({ ...current, [`${productId}:${packId}`]: quantity }))}
        onClose={() => {
          setCreatingInvoice(false);
          setEditingOrder(null);
          setCart({});
          setContainerReturns([]);
          navigation.setParams({ openCreateInvoiceToken: undefined });
        }}
        onSave={() => {
          const items = invoiceProducts.flatMap(product => casePacksForProduct(product).flatMap(pack => {
            const quantity = Number(cart[`${product.id}:${pack.id}`]) || 0;
            const item = quantity > 0 ? invoiceCaseItem(product, pack, quantity) : null;
            return item ? [item] : [];
          }));
          if (!items.length) return;
          const customerName = isNewCustomer ? newCustomer.name.trim() : selectedCustomer?.name;
          if (!customerName) {
            Alert.alert('Customer name required', 'Enter a customer name to save this profile.');
            return;
          }
          const subtotal = items.reduce((sum, item) => sum + Math.round(caseLineAmount(item.quantity, item.casePrice ?? item.unitPrice) * 100), 0) / 100;
          const settlement = balances.find(balance => balance.orderId === editingOrder?.id)?.amountPaid || 0;
          const prepared = prepareContainerReturns(containerReturns, subtotal, settlement);
          if (prepared.error) { Alert.alert('Check returned containers', prepared.error); return; }
          const total = prepared.total;
          confirmAction({
            title: editingOrder ? 'Save invoice changes?' : 'Create this invoice?',
            message: `${customerName} · ${items.length} product lines · ${formatPeso(total)} after ${formatPeso(prepared.refund)} container refunds${isNewCustomer ? '. A new customer profile will also be saved.' : ''}`,
            confirmLabel: editingOrder ? 'Save changes' : 'Create invoice',
            onConfirm: async () => {
              if (editingOrder) {
                const result = await editPendingInvoice(editingOrder.id, items, prepared.entries);
                if (result.error) {
                  Alert.alert('Could not update invoice', result.error);
                  return;
                }
                setStockFeedback(true);
                setCaseToast(stockNotice(items, result.products, `${editingOrder.invoiceNumber} updated`));
                setEditingOrder(null);
                setContainerReturns([]);
                setCart({});
                return;
              }
              const customer = isNewCustomer ? await saveCustomer(newCustomer) : selectedCustomer;
              if (!customer) {
                Alert.alert('Customer name required', 'Enter a customer name to save this profile.');
                return;
              }
              setSelectedCustomer(customer);
              setIsNewCustomer(false);
              const order = await createOrder(customer, items, prepared.entries);
              if (!order) {
                Alert.alert('Not enough stock', 'Available stock changed. Review the case quantities and try again.');
                return;
              }
              const invoiceNumber = order.invoiceNumber || `INV-2026-${String(orders.length + 1).padStart(3, '0')}`;
              setCart({});
              setContainerReturns([]);
              setNewCustomer({ name: '', contact: '', address: '' });
              setIsNewCustomer(false);
              setCreatingInvoice(false);
              navigation.setParams({ openCreateInvoiceToken: undefined });
              setStockFeedback(true);
              setCaseToast(stockNotice(items, order.products, `${invoiceNumber} created${order.appliedCredit > 0 ? ` · ${formatPeso(order.appliedCredit)} credit applied` : ''}`));

            },
          });
        }}
      />
      <InvoiceModal
        order={invoiceOrder}
        balance={balances.find(balance => balance.orderId === invoiceOrder?.id)}
        exporting={exporting}
        onPay={() => { setPaymentInvoice(invoiceOrder); setInvoiceOrder(null); }}
        onExportPdf={() => exportInvoice('pdf')}
        onExportExcel={() => exportInvoice('excel')}
        onClose={() => {
          setInvoiceOrder(null);
        }}
        width={width}
      />
      {paymentInvoice && <CustomerPaymentModal customerId={paymentInvoice.customerId || paymentInvoice.customer.id} invoiceNumber={paymentInvoice.invoiceNumber} onClose={() => setPaymentInvoice(null)} onSaved={message => { setStockFeedback(false); setCaseToast(message); }} />}
      <FeedbackToast message={caseToast} onDismiss={() => setCaseToast('')} onViewStock={stockFeedback ? () => { setCaseToast(''); navigation.getParent()?.navigate('Inventory'); } : undefined} />
    </SafeAreaView>
  );
}

function OrderCard({ order, compact, onView }) {
  const status = STATUS[order.status] ?? STATUS.unpaid;
  const caseCount = order.items.every(item => item.unitsPerCase)
    ? order.items.reduce((sum, item) => sum + item.quantity, 0)
    : null;
  return (
    <View style={styles.orderCard}>
      <View style={styles.cardTop}>
        <View style={styles.orderIdentity}>
          <Text style={styles.orderNumber}>{order.invoiceNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
            <MaterialIcons name={status.icon} size={14} color={status.color} accessible={false} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.orderDate}>{order.date}</Text>
      </View>

      <View style={styles.cardMiddle}>
        <View style={styles.customerBlock}>
          <Text style={styles.customerName} numberOfLines={1}>{order.customer.name}</Text>
          <Text style={styles.customerContact} numberOfLines={1}>{order.customer.contact}</Text>
          <DeliveryBadge order={order} />
          <Text style={styles.itemMeta}>{caseCount === null ? `${order.items.length} ${order.items.length === 1 ? 'item' : 'items'}` : `${caseCount} ${caseCount === 1 ? 'case' : 'cases'}`}</Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={styles.totalCaption}>Invoice total</Text>
          <Text style={styles.totalValue}>{formatPeso(order.grandTotal)}</Text>
          <Text style={styles.depositText}>Paid {formatPeso(order.amountPaid)}</Text>
          {order.remainingBalance > 0 && <Text style={styles.balanceText}>Due {formatPeso(order.remainingBalance)}</Text>}
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${order.invoiceNumber}`}
          accessibilityHint="Opens invoice delivery and payment details"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="visibility" size={18} color={theme.colors.primary} accessible={false} />
          <Text style={styles.secondaryButtonText}>{compact ? 'Details' : 'View details & invoice'}</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.colors.primary} accessible={false} />
        </Pressable>
      </View>
    </View>
  );
}

function OverlayModal({ visible, onClose, children, width }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={[styles.modalPanel, width > 720 && styles.wideModalPanel]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <View style={styles.modalHeader}>
      <View style={styles.modalHeading}>
        <Text style={styles.modalTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.modalSubtitle}>{subtitle}</Text>}
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={`Close ${title.toLowerCase()}`}
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
      >
        <MaterialIcons name="close" size={22} color={theme.colors.text} accessible={false} />
      </Pressable>
    </View>
  );
}

function CreateInvoiceModal({ containerReturns, onChangeReturns, visible, width, products, customers, balances, orders, cart, customer, isNewCustomer, newCustomer, editingOrder, getAvailableStock, onSelectCustomer, onSelectCustomerMode, onChangeNewCustomer, onChangeQuantity, onClose, onSave }) {
  const subtotal = products.reduce((sum, product) => {
    return sum + casePacksForProduct(product).reduce((productTotal, pack) => {
      const quantity = Number(cart[`${product.id}:${pack.id}`]) || 0;
      const item = quantity > 0 ? invoiceCaseItem(product, pack, quantity) : null;
      return productTotal + (item ? Math.round(caseLineAmount(item.quantity, item.casePrice ?? item.unitPrice) * 100) / 100 : 0);
    }, 0);
  }, 0);
  const prepared = prepareContainerReturns(containerReturns, subtotal, balances.find(balance => balance.orderId === editingOrder?.id)?.amountPaid || 0);
  const total = prepared.total ?? subtotal;
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0);
  const invalidQuantity = products.some(product => casePacksForProduct(product).some(pack => {
    const reserved = editingOrder?.items.filter(item => item.productId === product.id && item.packId === pack.id).reduce((sum, item) => sum + item.quantity, 0) || 0;
    return !!caseQuantityInputError(cart[`${product.id}:${pack.id}`] ?? '', getAvailableStock(product.id, pack.id) + reserved);
  }));
  const canCreate = !invalidQuantity && !prepared.error && itemCount > 0 && (editingOrder || (isNewCustomer ? !!newCustomer.name.trim() : !!customer?.id));
  const customerIdentity = isNewCustomer
    ? customers.find(item => item.name.trim().toLocaleLowerCase() === newCustomer.name.trim().toLocaleLowerCase()) || { name: newCustomer.name }
    : customer;
  const openAccount = customerIdentity
    ? groupOpenCustomerBalances(balances, orders).find(account => (
      customerIdentity.id ? account.customerId === customerIdentity.id
        : account.customerName.toLocaleLowerCase() === customerIdentity.name.trim().toLocaleLowerCase()
    ))
    : null;

  return (
    <OverlayModal visible={visible} onClose={onClose} width={width}>
      <ModalHeader title={editingOrder ? 'Edit pending invoice' : 'Create invoice'} subtitle={editingOrder ? `${editingOrder.invoiceNumber} · update products and quantities` : 'Choose a customer and add products'} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.createOrderBody} keyboardShouldPersistTaps="handled">
        {!editingOrder ? <View style={styles.createSection}>
          <Text style={styles.createSectionTitle}>Customer</Text>
          <View style={styles.customerMode}>
            {[false, true].map(isNew => (
              <Pressable
                key={String(isNew)}
                onPress={() => onSelectCustomerMode(isNew)}
                accessibilityRole="button"
                accessibilityState={{ selected: isNewCustomer === isNew }}
                {...(Platform.OS === 'web' ? { 'aria-pressed': isNewCustomer === isNew } : {})}
                style={[styles.customerModeButton, isNewCustomer === isNew && styles.customerModeButtonSelected]}
              >
                {isNewCustomer === isNew && <MaterialIcons name="check-circle" size={17} color={theme.colors.primary} accessible={false} />}
                <Text style={[styles.customerModeText, isNewCustomer === isNew && styles.customerModeTextSelected]}>
                  {isNew ? 'New customer' : 'Existing customer'}
                </Text>
              </Pressable>
            ))}
          </View>
          {isNewCustomer ? (
            <View style={styles.newCustomerFields}>
              <TextInput value={newCustomer.name} onChangeText={value => onChangeNewCustomer('name', value)} placeholder="Customer name (required)" placeholderTextColor={theme.colors.textLight} accessibilityLabel="New customer name, required" returnKeyType="next" style={styles.customerInput} />
              <TextInput value={newCustomer.contact} onChangeText={value => onChangeNewCustomer('contact', value)} placeholder="Contact number (optional)" placeholderTextColor={theme.colors.textLight} accessibilityLabel="New customer contact number, optional" keyboardType="phone-pad" style={styles.customerInput} />
              <TextInput value={newCustomer.address} onChangeText={value => onChangeNewCustomer('address', value)} placeholder="Address (optional)" placeholderTextColor={theme.colors.textLight} accessibilityLabel="New customer address, optional" style={styles.customerInput} />
            </View>
          ) : customers.map(option => {
            const selected = option.id === customer?.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => onSelectCustomer(option)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
                style={[styles.customerOption, selected && styles.customerOptionSelected]}
              >
                <View style={styles.customerOptionText}>
                  <Text style={styles.infoPrimary}>{option.name}</Text>
                  <Text style={styles.infoSecondary}>{option.contact}</Text>
                </View>
                {selected && <MaterialIcons name="check-circle" size={20} color={theme.colors.primary} accessible={false} />}
              </Pressable>
            );
          })}
          {openAccount ? (
            <View style={styles.openInvoiceNotice}>
              <Text style={styles.openInvoiceTitle}>Existing open invoices · {formatPeso(openAccount.outstanding)}</Text>
              {openAccount.balances.map(balance => (
                <View key={balance.id} style={styles.openInvoiceRow}>
                  <Text style={styles.openInvoiceNumber}>{balance.invoiceNumber}</Text>
                  <Text style={styles.openInvoiceAmount}>{formatPeso(balance.remainingBalance)} due</Text>
                </View>
              ))}
              <Text style={styles.openInvoiceHelp}>This sale creates a separate invoice. Payments apply to the oldest invoice first.</Text>
            </View>
          ) : null}
        </View> : (
          <View style={styles.createSection}>
            <Text style={styles.createSectionTitle}>Customer</Text>
            <Text style={styles.infoPrimary}>{editingOrder.customer.name}</Text>
            <Text style={styles.infoSecondary}>This invoice stays with its original customer.</Text>
          </View>
        )}
        <View style={styles.createSection}>
          <Text style={styles.createSectionTitle}>Products</Text>
          {products.map(product => {
            const productPacks = casePacksForProduct(product);
            return (
              <View key={product.id} style={styles.caseProductOption}>
                <View style={styles.productOptionInfo}>
                  <Text style={styles.infoPrimary}>{product.name}</Text>
                  <Text style={styles.infoSecondary}>Stock tracked by case type</Text>
                </View>
                {productPacks.map(pack => {
                  const quantity = Number(cart[`${product.id}:${pack.id}`]) || 0;
                  const existingQuantity = editingOrder?.items.reduce((sum, item) => (
                    item.productId === product.id && item.packId === pack.id ? sum + item.quantity : sum
                  ), 0) || 0;
                  const available = getAvailableStock(product.id, pack.id) + existingQuantity;
                  const maxCases = availableCases(available, pack);
                  const quantityError = caseQuantityInputError(cart[`${product.id}:${pack.id}`] ?? '', maxCases);
                  return (
                    <View key={pack.id} style={styles.caseQuantityRow}>
                      <View style={styles.packLabelBlock}>
                        <Text style={styles.packLabel}>{pack.label} · {formatPeso(pack.casePrice)} per case</Text>
                        <Text style={styles.infoSecondary}>{maxCases} cases available</Text>
                        {!!quantityError && <Text accessibilityRole="alert" style={styles.quantityError}>{quantityError}</Text>}
                      </View>
                      <View style={styles.quantityControls}>
                        <Pressable
                          onPress={() => onChangeQuantity(product.id, pack.id, Math.max(0, quantity - 0.5))}
                          disabled={!quantity}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove half a ${pack.label} case of ${product.name}`}
                          style={[styles.quantityButton, !quantity && styles.quantityButtonDisabled]}
                        >
                          <MaterialIcons name="remove" size={18} color={quantity ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                        </Pressable>
                        <TextInput
                          value={String(cart[`${product.id}:${pack.id}`] ?? '0')}
                          onChangeText={value => onChangeQuantity(product.id, pack.id, value)}
                          selectTextOnFocus keyboardType="decimal-pad"
                          accessibilityLabel={`${product.name}, ${pack.label}, quantity in cases`}
                          style={[styles.quantityEntry, quantityError && styles.quantityEntryError]}
                        />
                        <Pressable
                          onPress={() => onChangeQuantity(product.id, pack.id, quantity + 0.5)}
                          disabled={quantity + 0.5 > maxCases}
                          accessibilityRole="button"
                          accessibilityLabel={`Add half a ${pack.label} case of ${product.name}`}
                          style={[styles.quantityButton, quantity + 0.5 > maxCases && styles.quantityButtonDisabled]}
                        >
                          <MaterialIcons name="add" size={18} color={quantity + 0.5 <= maxCases ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
        <ContainerReturnEditor rows={containerReturns} onChange={onChangeReturns} error={prepared.error} />
        <SummaryLine label="Product subtotal" value={formatPeso(subtotal)} />
        <SummaryLine label="Container refunds" value={`−${formatPeso(prepared.refund || 0)}`} />
      </ScrollView>
      <View style={styles.createOrderFooter}>
        <View style={styles.createTotal}>
          <Text style={styles.infoSecondary}>{itemCount} {itemCount === 1 ? 'case' : 'cases'} selected</Text>
          <Text style={styles.createTotalValue}>{formatPeso(total)}</Text>
        </View>
        <Pressable
          onPress={onSave}
          disabled={!canCreate}
          accessibilityRole="button"
          accessibilityLabel={editingOrder ? 'Save invoice changes' : 'Create invoice'}
          style={({ pressed }) => [styles.createSubmit, !canCreate && styles.createSubmitDisabled, pressed && canCreate && styles.pressed]}
        >
          <Text style={styles.createSubmitText}>{editingOrder ? 'Save changes' : 'Create invoice'}</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function OrderDetailModal({ onPay, order, onClose, onShowInvoice, onEdit, onMarkDelivered, onCancel }) {
  if (!order) return null;
  const status = STATUS[order.status] ?? STATUS.unpaid;
  return (
    <OverlayModal visible={!!order} onClose={onClose}>
      <ModalHeader title="Invoice details" subtitle={`${order.invoiceNumber} · ${order.date}`} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.modalBody}>
        <View style={styles.infoGroup}>
          <Text style={styles.sectionLabel}>Customer</Text>
          <Text style={styles.infoPrimary}>{order.customer.name}</Text>
          <Text style={styles.infoSecondary}>{order.customer.contact}</Text>
          {!!order.customer.address && <Text style={styles.infoSecondary}>{order.customer.address}</Text>}
        </View>
        <View style={styles.infoGroup}>
          <Text style={styles.sectionLabel}>Invoice</Text>
          <View style={styles.infoLine}>
            <Text style={styles.infoSecondary}>Delivery</Text>
            <Text style={styles.infoValue}>{order.deliveryStatus === 'delivered' ? 'Delivered' : 'Pending delivery'}</Text>
          </View>
          <View style={styles.infoLine}>
            <Text style={styles.infoSecondary}>Overall status</Text>
            <Text style={styles.infoValue}>{order.lifecycleStatus === 'completed' ? 'Completed' : order.lifecycleStatus === 'cancelled' ? 'Cancelled' : 'Ongoing'}</Text>
          </View>
          <View style={styles.infoLine}>
            <Text style={styles.infoSecondary}>Payment status</Text>
            <Text style={[styles.infoValue, { color: status.color }]}>{status.label}</Text>
          </View>
          <View style={styles.infoLine}>
            <Text style={styles.infoSecondary}>Paid</Text>
            <Text style={styles.infoValue}>{formatPeso(order.amountPaid)}</Text>
          </View>
          <View style={styles.infoLine}>
            <Text style={styles.infoSecondary}>Balance due</Text>
            <Text style={styles.infoValue}>{formatPeso(order.remainingBalance)}</Text>
          </View>
        </View>
        <View>
          <Text style={styles.sectionLabel}>Items</Text>
          {order.items.map((item, index) => (
            <View key={`${item.productId}-${index}`} style={styles.itemRow}>
              <View style={styles.itemDescription}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.infoSecondary}>{item.unitsPerCase ? `${item.packLabel} · ${item.quantity} ${item.quantity === 1 ? 'case' : 'cases'} × ${formatPeso(item.casePrice ?? item.unitPrice)} per case` : 'Historical invoice line'}</Text>
              </View>
              <Text style={styles.itemAmount}>{formatPeso(item.quantity * (item.casePrice ?? item.unitPrice))}</Text>
            </View>
          ))}
        </View>
        <DeliveryBadge order={order} />
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Grand total</Text>
          <Text style={styles.grandTotalValue}>{formatPeso(order.grandTotal)}</Text>
        </View>
      </ScrollView>
      <View style={styles.modalFooter}>
        {order.status !== 'cancelled' && order.remainingBalance > 0 && <Pressable onPress={onPay} accessibilityRole="button" style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}><Text style={styles.paymentActionLabel}>Record payment</Text></Pressable>}
        <Pressable onPress={onShowInvoice} style={({ pressed }) => [styles.footerButton, styles.footerButtonOutline, pressed && styles.pressed]}>
          <Text style={styles.footerOutlineText}>Preview / export invoice</Text>
        </Pressable>
        {order.lifecycleStatus === 'pending' && order.deliveryStatus !== 'delivered' ? (
          <Pressable onPress={onEdit} style={({ pressed }) => [styles.footerButton, styles.footerButtonOutline, pressed && styles.pressed]}>
            <Text style={styles.footerOutlineText}>Edit invoice</Text>
          </Pressable>
        ) : null}
          {order.lifecycleStatus === 'pending' && order.deliveryStatus !== 'delivered' ? (
          <>
            {order.amountPaid === 0 ? (
              <Pressable onPress={onCancel} style={({ pressed }) => [styles.footerButton, styles.footerButtonOutline, pressed && styles.pressed]}>
                <Text style={styles.footerOutlineText}>Cancel invoice</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onMarkDelivered} style={({ pressed }) => [styles.footerButton, styles.createSubmit, pressed && styles.pressed]}>
              <Text style={styles.createSubmitText}>Mark delivered</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable onPress={onClose} style={({ pressed }) => [styles.footerButton, styles.footerButtonOutline, pressed && styles.pressed]}>
          <Text style={styles.footerOutlineText}>Close</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function InvoiceModal({ onPay, order, balance, onClose, onExportPdf, onExportExcel, exporting, width }) {
  if (!order) return null;
  const invoice = invoiceSummary(order, balance);
  const invoiceNumber = invoice.invoiceNumber;
  const status = STATUS[invoice.status] ?? STATUS.unpaid;
  return (
    <OverlayModal visible={!!order} onClose={onClose} width={width}>
      <ModalHeader title="Invoice preview" subtitle={invoiceNumber} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.invoiceBody}>
        <View style={styles.invoiceBrandRow}>
          <View style={styles.invoiceBusiness}>
            <Text style={styles.businessName}>BevDist Distribution Co.</Text>
            <Text style={styles.infoSecondary}>Beverage distributor</Text>
            <Text style={styles.infoSecondary}>Metro Manila, Philippines</Text>
          </View>
          <View style={styles.invoiceMark}>
            <Text style={styles.invoiceMarkText}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
            <Text style={styles.infoSecondary}>{order.date}</Text>
          </View>
        </View>

        <View style={styles.billedTo}>
          <Text style={styles.sectionLabel}>Billed to</Text>
          <Text style={styles.infoPrimary}>{order.customer.name}</Text>
          <Text style={styles.infoSecondary}>{order.customer.contact}</Text>
          {!!order.customer.address && <Text style={styles.infoSecondary}>{order.customer.address}</Text>}
        </View>

        <Text style={styles.sectionLabel}>Invoice items</Text>
        {order.items.map((item, index) => (
          <View key={`${item.productId}-${index}`} style={styles.invoiceItem}>
            <View style={styles.itemDescription}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.infoSecondary}>{item.unitsPerCase ? `${item.packLabel} · ${item.quantity} ${item.quantity === 1 ? 'case' : 'cases'} × ${formatPeso(item.casePrice ?? item.unitPrice)} per case` : 'Historical invoice line'}</Text>
            </View>
            <Text style={styles.itemAmount}>{formatPeso(item.quantity * (item.casePrice ?? item.unitPrice))}</Text>
          </View>
        ))}

        {(order.containerReturns || []).length > 0 && <View>
          <Text style={styles.sectionLabel}>Returned containers</Text>
          {order.containerReturns.map((entry, index) => <View key={entry.id || index} style={styles.invoiceItem}>
            <View style={styles.itemDescription}><Text style={styles.itemName}>{entry.type}</Text>
              <Text style={styles.infoSecondary}>{entry.quantity} cases × {formatPeso(entry.refundPerCase)} refund per case</Text></View>
            <Text style={styles.itemAmount}>−{formatPeso(refundAmount(entry))}</Text>
          </View>)}
        </View>}
        <DeliveryBadge order={order} />
        <View style={styles.invoiceSummary}>
          <SummaryLine label="Subtotal" value={formatPeso(order.subtotal)} />
          <SummaryLine label="Container refunds" value={`−${formatPeso(order.containerRefundTotal || 0)}`} />
          <SummaryLine label="Payments and credit applied" value={`−${formatPeso(invoice.amountPaid)}`} valueColor={theme.colors.success} />
          <SummaryLine label="Remaining balance" value={formatPeso(invoice.remainingBalance)} valueColor={invoice.remainingBalance > 0 ? theme.colors.danger : theme.colors.success} />
          <View style={styles.invoiceGrandTotal}>
            <Text style={styles.invoiceTotalLabel}>Grand total</Text>
            <Text style={styles.invoiceTotalValue}>{formatPeso(order.grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.invoiceStatusNote}>
          <MaterialIcons name={status.icon} size={17} color={status.color} accessible={false} />
          <Text style={[styles.invoiceStatusText, { color: status.color }]}>Payment status: {status.label}</Text>
        </View>
      </ScrollView>
      <View style={styles.invoiceModalFooter}>
        {invoice.status !== 'cancelled' && invoice.remainingBalance > 0 && <Pressable onPress={onPay} accessibilityRole="button" style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}><Text style={styles.paymentActionLabel}>Record payment</Text></Pressable>}
        <View style={styles.invoiceExportActions}>
          <Pressable
            onPress={onExportPdf}
            disabled={Boolean(exporting)}
            accessibilityRole="button"
            accessibilityLabel={`Export ${invoiceNumber} as PDF`}
            style={({ pressed }) => [styles.invoiceExportButton, pressed && styles.pressed, exporting && styles.exportDisabled]}
          >
            <MaterialIcons name="picture-as-pdf" size={19} color={theme.colors.primary} accessible={false} />
            <Text style={styles.invoiceExportLabel}>{exporting === 'pdf' ? 'Preparing…' : 'Export PDF'}</Text>
          </Pressable>
          <Pressable
            onPress={onExportExcel}
            disabled={Boolean(exporting)}
            accessibilityRole="button"
            accessibilityLabel={`Export ${invoiceNumber} as Excel`}
            style={({ pressed }) => [styles.invoiceExportButton, pressed && styles.pressed, exporting && styles.exportDisabled]}
          >
            <MaterialIcons name="table-chart" size={19} color={theme.colors.primary} accessible={false} />
            <Text style={styles.invoiceExportLabel}>{exporting === 'excel' ? 'Preparing…' : 'Export Excel'}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.footerButton, styles.footerButtonOutline, styles.invoiceCloseButton, pressed && styles.pressed]}>
          <Text style={styles.footerOutlineText}>Close preview</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function SummaryLine({ label, value, valueColor = theme.colors.text }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quantityEntry: { width: 66, minHeight: 44, paddingHorizontal: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, textAlign: 'center', fontSize: 16, color: theme.colors.text },
  quantityEntryError: { borderColor: theme.colors.danger }, quantityError: { color: theme.colors.danger, fontSize: 14 },
  paymentActionLabel: { color: theme.colors.onPrimary, fontSize: 16, fontWeight: '600' },
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'], flexGrow: 1 },
  headerContent: { gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  headingBlock: { marginBottom: theme.spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  createButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 9, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.primary },
  createButtonText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  customerProfilesLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: theme.spacing.sm },
  customerProfilesLinkText: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.onPrimary },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.onPrimary, opacity: 0.82, marginTop: 4 },
  headerActionButton: { backgroundColor: theme.colors.surface },
  headerActionText: { color: theme.colors.primary },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: theme.spacing.md },
  searchInput: { flex: 1, minHeight: 46, fontSize: theme.fontSize.base, color: theme.colors.text, paddingVertical: theme.spacing.sm },
  clearSearch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterList: { gap: theme.spacing.sm, paddingVertical: 2, paddingRight: theme.spacing.md },
  filterChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted },
  filterChipSelected: { backgroundColor: theme.colors.primary },
  filterLabel: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textLight },
  filterLabelSelected: { color: theme.colors.onPrimary, fontWeight: theme.fontWeight.semibold },
  filterCount: { minWidth: 22, textAlign: 'center', fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: theme.colors.textLight, overflow: 'hidden' },
  filterCountSelected: { color: theme.colors.onPrimary },
  orderCard: { backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, gap: theme.spacing.md },
  cardSeparator: { height: theme.spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  orderIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.sm },
  orderNumber: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  statusBadge: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  orderDate: { fontSize: theme.fontSize.xs, color: theme.colors.textLight },
  cardMiddle: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
  customerBlock: { flex: 1, minWidth: 0, gap: 3 },
  customerName: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  customerContact: { fontSize: theme.fontSize.sm, color: theme.colors.textLight },
  itemMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textLight, marginTop: 3 },
  totalBlock: { alignItems: 'flex-end', maxWidth: '47%' },
  totalCaption: { fontSize: theme.fontSize.xs, color: theme.colors.textLight },
  totalValue: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text, textAlign: 'right' },
  depositText: { fontSize: theme.fontSize.xs, color: theme.colors.success, marginTop: 2, textAlign: 'right' },
  balanceText: { fontSize: theme.fontSize.xs, color: theme.colors.danger, marginTop: 2, textAlign: 'right' },
  cardActions: { flexDirection: 'row', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm },
  secondaryButton: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, paddingHorizontal: theme.spacing.sm },
  secondaryButtonText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.primary },
  pressed: { opacity: 0.72 },
  emptyState: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
  emptyIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primarySoft, borderRadius: 16, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: { marginTop: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.textLight, textAlign: 'center', lineHeight: 21 },
  modalScrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.overlay },
  modalPanel: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: theme.colors.surface, borderRadius: 16, overflow: 'hidden' },
  wideModalPanel: { maxWidth: 760 },
  modalHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  modalHeading: { flex: 1 },
  modalTitle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.onPrimary },
  modalSubtitle: { fontSize: theme.fontSize.sm, color: theme.colors.onPrimaryMuted, marginTop: 3 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: theme.colors.onPrimaryOverlay },
  modalBody: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  createOrderBody: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  createSection: { gap: theme.spacing.sm },
  createSectionTitle: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.xs },
  customerMode: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  customerModeButton: { minHeight: 46, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9 },
  customerModeButtonSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  customerModeText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textLight },
  customerModeTextSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
  newCustomerFields: { gap: theme.spacing.sm },
  customerInput: { minHeight: 48, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, fontSize: theme.fontSize.sm },
  customerOption: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9 },
  customerOptionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  customerOptionText: { gap: 2 },
  openInvoiceNotice: { gap: theme.spacing.xs, padding: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  openInvoiceTitle: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, marginBottom: 2 },
  openInvoiceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  openInvoiceNumber: { color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  openInvoiceAmount: { color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
  openInvoiceHelp: { color: theme.colors.primary, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xs },
  caseProductOption: { gap: theme.spacing.sm, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  packLabelBlock: { flex: 1, minWidth: 130, gap: 2 },
  packLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  caseQuantityRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  productOptionInfo: { flex: 1, gap: 3 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  quantityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: theme.colors.primarySoft },
  quantityButtonDisabled: { opacity: 0.45 },
  createOrderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
  createTotal: { gap: 2 },
  createTotalValue: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  createSubmit: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: theme.spacing.lg, backgroundColor: theme.colors.primary },
  createSubmitDisabled: { opacity: 0.45 },
  createSubmitText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.onPrimary },
  infoGroup: { padding: theme.spacing.md, gap: 4, borderRadius: 10, backgroundColor: theme.colors.background },
  sectionLabel: { marginBottom: theme.spacing.sm, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoPrimary: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  infoSecondary: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, lineHeight: 20 },
  infoLine: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  infoValue: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  itemRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  itemDescription: { flex: 1, minWidth: 0, gap: 2 },
  itemName: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  itemAmount: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, textAlign: 'right' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  grandTotalLabel: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  grandTotalValue: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
  modalFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
  invoiceModalFooter: { gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
  invoiceExportActions: { flexDirection: 'row', gap: theme.spacing.sm },
  invoiceExportButton: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, borderRadius: 9, backgroundColor: theme.colors.primarySoft },
  invoiceExportLabel: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  invoiceCloseButton: { alignSelf: 'flex-end' },
  exportDisabled: { opacity: 0.6 },
  footerButton: { minHeight: 48, minWidth: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: theme.spacing.lg },
  footerButtonOutline: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  footerOutlineText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  invoiceBody: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  invoiceBrandRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md },
  invoiceBusiness: { flex: 1, gap: 3 },
  businessName: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text, marginBottom: 2 },
  invoiceMark: { alignItems: 'flex-end', gap: 3 },
  invoiceMarkText: { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, paddingHorizontal: theme.spacing.sm, paddingVertical: 5, borderRadius: 6, overflow: 'hidden' },
  invoiceNumber: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.text, textAlign: 'right' },
  billedTo: { padding: theme.spacing.md, gap: 3, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.background },
  invoiceItem: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  invoiceSummary: { width: '100%', maxWidth: 340, alignSelf: 'flex-end', gap: theme.spacing.sm },
  summaryLine: { minHeight: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  summaryLabel: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.textLight },
  summaryValue: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, textAlign: 'right' },
  invoiceGrandTotal: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: 9, backgroundColor: theme.colors.primary },
  invoiceTotalLabel: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.onPrimary },
  invoiceTotalValue: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.onPrimary },
  invoiceStatusNote: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: 8, backgroundColor: theme.colors.background },
  invoiceStatusText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
});
