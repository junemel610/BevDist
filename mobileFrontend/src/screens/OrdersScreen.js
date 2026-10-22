import React, { useMemo, useState } from 'react';
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
import { INITIAL_CUSTOMERS } from '../data/initialData';
import theme from '../styles/theme';

const FILTERS = [
  { key: 'all', label: 'All orders' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS = {
  pending: { label: 'Pending', color: theme.colors.warning, background: theme.colors.warningSoft, icon: 'schedule' },
  completed: { label: 'Completed', color: theme.colors.success, background: theme.colors.successSoft, icon: 'check-circle-outline' },
  cancelled: { label: 'Cancelled', color: theme.colors.danger, background: theme.colors.dangerSoft, icon: 'cancel' },
};

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH')}`;

export function OrdersScreen() {
  const { orders, balances, products, createOrder, getAvailableStock } = useApp();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(INITIAL_CUSTOMERS[0]);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact: '', address: '' });
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [cart, setCart] = useState({});
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 390 * Math.min(fontScale, 1.25);

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter(order => order.status === 'pending').length,
    completed: orders.filter(order => order.status === 'completed').length,
    cancelled: orders.filter(order => order.status === 'cancelled').length,
  }), [orders]);

  const visibleOrders = useMemo(() => orders
    .filter(order => activeFilter === 'all' || order.status === activeFilter)
    .filter(order => {
      const query = search.trim().toLocaleLowerCase();
      return !query || order.orderNumber.toLocaleLowerCase().includes(query)
        || order.customer.name.toLocaleLowerCase().includes(query);
    })
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date)), [orders, activeFilter, search]);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <FlatList
        data={visibleOrders}
        keyExtractor={order => order.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.headingBlock}>
              <View style={styles.titleRow}>
                <View style={styles.headingBlock}>
                  <Text accessibilityRole="header" style={styles.title}>Order management</Text>
                  <Text style={styles.subtitle}>{orders.length} total {orders.length === 1 ? 'order' : 'orders'}</Text>
                </View>
                <Pressable
                  onPress={() => setCreatingOrder(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Create order"
                  style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
                >
                  <MaterialIcons name="add" size={20} color={theme.colors.onPrimary} accessible={false} />
                  <Text style={styles.createButtonText}>{compact ? 'Create' : 'Create order'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={22} color={theme.colors.textLight} accessible={false} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by order or customer"
                placeholderTextColor={theme.colors.textLight}
                accessibilityLabel="Search orders by order number or customer"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {!!search && (
                <Pressable
                  onPress={() => setSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear order search"
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
              accessibilityLabel="Filter orders by status"
            >
              {FILTERS.map(filter => {
                const selected = activeFilter === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setActiveFilter(filter.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${filter.label}, ${counts[filter.key]} ${counts[filter.key] === 1 ? 'order' : 'orders'}`}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}
                  >
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
            onInvoice={() => setInvoiceOrder(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="receipt-long" size={26} color={theme.colors.primary} accessible={false} />
            </View>
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptyText}>{search ? 'Try another order number or customer name.' : 'There are no orders in this status yet.'}</Text>
          </View>
        )}
      />

      <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      <CreateOrderModal
        visible={creatingOrder}
        width={width}
        products={products}
        cart={cart}
        customer={selectedCustomer}
        isNewCustomer={isNewCustomer}
        newCustomer={newCustomer}
        getAvailableStock={getAvailableStock}
        onSelectCustomer={setSelectedCustomer}
        onSelectCustomerMode={setIsNewCustomer}
        onChangeNewCustomer={(field, value) => setNewCustomer(current => ({ ...current, [field]: value }))}
        onChangeQuantity={(productId, quantity) => setCart(current => ({ ...current, [productId]: quantity }))}
        onClose={() => setCreatingOrder(false)}
        onCreate={() => {
          const items = products.filter(product => cart[product.id] > 0).map(product => ({
            productId: product.id,
            productName: product.name,
            quantity: cart[product.id],
            unitPrice: product.unitPrice,
          }));
          if (!items.length) return;
          const customer = isNewCustomer
            ? { id: `new_${Date.now()}`, name: newCustomer.name.trim(), contact: newCustomer.contact.trim(), address: newCustomer.address.trim() }
            : selectedCustomer;
          const order = createOrder(customer, items);
          setCart({});
          setNewCustomer({ name: '', contact: '', address: '' });
          setIsNewCustomer(false);
          setCreatingOrder(false);
          Alert.alert('Order created', `${order.orderNumber} saved as pending.`);
        }}
      />
      <InvoiceModal
        order={invoiceOrder}
        balance={balances.find(balance => balance.orderId === invoiceOrder?.id)}
        onClose={() => {
          setInvoiceOrder(null);
        }}
        width={width}
      />
    </SafeAreaView>
  );
}

function OrderCard({ order, compact, onView, onInvoice }) {
  const status = STATUS[order.status] ?? STATUS.pending;
  const itemCount = order.items.length;
  return (
    <View style={styles.orderCard}>
      <View style={styles.cardTop}>
        <View style={styles.orderIdentity}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
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
          <Text style={styles.itemMeta}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={styles.totalCaption}>Grand total</Text>
          <Text style={styles.totalValue}>{formatPeso(order.grandTotal)}</Text>
          {order.deposit > 0 && <Text style={styles.depositText}>Deposit {formatPeso(order.deposit)}</Text>}
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${order.orderNumber}`}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="visibility" size={18} color={theme.colors.primary} accessible={false} />
          <Text style={styles.secondaryButtonText}>{compact ? 'Details' : 'View details'}</Text>
        </Pressable>
        <Pressable
          onPress={onInvoice}
          accessibilityRole="button"
          accessibilityLabel={`Preview invoice for ${order.orderNumber}`}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="description" size={18} color={theme.colors.primary} accessible={false} />
          <Text style={styles.secondaryButtonText}>Invoice</Text>
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

function CreateOrderModal({ visible, width, products, cart, customer, isNewCustomer, newCustomer, getAvailableStock, onSelectCustomer, onSelectCustomerMode, onChangeNewCustomer, onChangeQuantity, onClose, onCreate }) {
  const total = products.reduce((sum, product) => sum + (cart[product.id] || 0) * product.unitPrice, 0);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const canCreate = itemCount > 0 && (!isNewCustomer || !!newCustomer.name.trim());

  return (
    <OverlayModal visible={visible} onClose={onClose} width={width}>
      <ModalHeader title="Create order" subtitle="Choose a customer and add products" onClose={onClose} />
      <ScrollView contentContainerStyle={styles.createOrderBody} keyboardShouldPersistTaps="handled">
        <View style={styles.createSection}>
          <Text style={styles.createSectionTitle}>Customer</Text>
          <View style={styles.customerMode}>
            {[false, true].map(isNew => (
              <Pressable
                key={String(isNew)}
                onPress={() => onSelectCustomerMode(isNew)}
                accessibilityRole="button"
                accessibilityState={{ selected: isNewCustomer === isNew }}
                style={[styles.customerModeButton, isNewCustomer === isNew && styles.customerModeButtonSelected]}
              >
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
          ) : INITIAL_CUSTOMERS.map(option => {
            const selected = option.id === customer.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => onSelectCustomer(option)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
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
        </View>
        <View style={styles.createSection}>
          <Text style={styles.createSectionTitle}>Products</Text>
          {products.map(product => {
            const quantity = cart[product.id] || 0;
            const available = getAvailableStock(product.id);
            return (
              <View key={product.id} style={styles.productOption}>
                <View style={styles.productOptionInfo}>
                  <Text style={styles.infoPrimary}>{product.name}</Text>
                  <Text style={styles.infoSecondary}>{formatPeso(product.unitPrice)} · {available} available</Text>
                </View>
                <View style={styles.quantityControls}>
                  <Pressable
                    onPress={() => onChangeQuantity(product.id, Math.max(0, quantity - 1))}
                    disabled={!quantity}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove one ${product.name}`}
                    style={[styles.quantityButton, !quantity && styles.quantityButtonDisabled]}
                  >
                    <MaterialIcons name="remove" size={18} color={quantity ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                  </Pressable>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <Pressable
                    onPress={() => onChangeQuantity(product.id, quantity + 1)}
                    disabled={quantity >= available}
                    accessibilityRole="button"
                    accessibilityLabel={`Add one ${product.name}`}
                    style={[styles.quantityButton, quantity >= available && styles.quantityButtonDisabled]}
                  >
                    <MaterialIcons name="add" size={18} color={quantity < available ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.createOrderFooter}>
        <View style={styles.createTotal}>
          <Text style={styles.infoSecondary}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          <Text style={styles.createTotalValue}>{formatPeso(total)}</Text>
        </View>
        <Pressable
          onPress={onCreate}
          disabled={!canCreate}
          accessibilityRole="button"
          accessibilityLabel="Save order as pending"
          style={({ pressed }) => [styles.createSubmit, !canCreate && styles.createSubmitDisabled, pressed && canCreate && styles.pressed]}
        >
          <Text style={styles.createSubmitText}>Create order</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function OrderDetailModal({ order, onClose }) {
  if (!order) return null;
  const status = STATUS[order.status] ?? STATUS.pending;
  return (
    <OverlayModal visible={!!order} onClose={onClose}>
      <ModalHeader title="Order details" subtitle={`${order.orderNumber} · ${order.date}`} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.modalBody}>
        <View style={styles.infoGroup}>
          <Text style={styles.sectionLabel}>Customer</Text>
          <Text style={styles.infoPrimary}>{order.customer.name}</Text>
          <Text style={styles.infoSecondary}>{order.customer.contact}</Text>
          {!!order.customer.address && <Text style={styles.infoSecondary}>{order.customer.address}</Text>}
        </View>
        <View style={styles.infoGroup}>
          <Text style={styles.sectionLabel}>Order</Text>
          <View style={styles.infoLine}>
            <Text style={styles.infoSecondary}>Status</Text>
            <Text style={[styles.infoValue, { color: status.color }]}>{status.label}</Text>
          </View>
          <View style={styles.infoLine}>
            <Text style={styles.infoSecondary}>Deposit</Text>
            <Text style={styles.infoValue}>{formatPeso(order.deposit)}</Text>
          </View>
        </View>
        <View>
          <Text style={styles.sectionLabel}>Items</Text>
          {order.items.map((item, index) => (
            <View key={`${item.productId}-${index}`} style={styles.itemRow}>
              <View style={styles.itemDescription}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.infoSecondary}>{item.quantity} × {formatPeso(item.unitPrice)}</Text>
              </View>
              <Text style={styles.itemAmount}>{formatPeso(item.quantity * item.unitPrice)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Grand total</Text>
          <Text style={styles.grandTotalValue}>{formatPeso(order.grandTotal)}</Text>
        </View>
      </ScrollView>
      <View style={styles.modalFooter}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.footerButton, styles.footerButtonOutline, pressed && styles.pressed]}>
          <Text style={styles.footerOutlineText}>Close</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function InvoiceModal({ order, balance, onClose, width }) {
  if (!order) return null;
  const invoiceNumber = balance?.invoiceNumber || `INV-${order.orderNumber.replace('ORD-', '')}`;
  const remaining = balance?.remainingBalance ?? Math.max(0, order.grandTotal - order.deposit);
  const status = STATUS[order.status] ?? STATUS.pending;
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

        <Text style={styles.sectionLabel}>Order items</Text>
        {order.items.map((item, index) => (
          <View key={`${item.productId}-${index}`} style={styles.invoiceItem}>
            <View style={styles.itemDescription}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.infoSecondary}>{item.quantity} × {formatPeso(item.unitPrice)}</Text>
            </View>
            <Text style={styles.itemAmount}>{formatPeso(item.quantity * item.unitPrice)}</Text>
          </View>
        ))}

        <View style={styles.invoiceSummary}>
          <SummaryLine label="Subtotal" value={formatPeso(order.subtotal)} />
          <SummaryLine label="Deposit paid" value={`−${formatPeso(order.deposit)}`} valueColor={theme.colors.success} />
          <SummaryLine label="Remaining balance" value={formatPeso(remaining)} valueColor={remaining > 0 ? theme.colors.danger : theme.colors.success} />
          <View style={styles.invoiceGrandTotal}>
            <Text style={styles.invoiceTotalLabel}>Grand total</Text>
            <Text style={styles.invoiceTotalValue}>{formatPeso(order.grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.invoiceStatusNote}>
          <MaterialIcons name={status.icon} size={17} color={status.color} accessible={false} />
          <Text style={[styles.invoiceStatusText, { color: status.color }]}>Order status: {status.label}</Text>
        </View>
      </ScrollView>
      <View style={styles.modalFooter}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.footerButton, styles.footerButtonOutline, pressed && styles.pressed]}>
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
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'], flexGrow: 1 },
  headerContent: { gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  headingBlock: { marginBottom: theme.spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  createButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 9, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.primary },
  createButtonText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  title: { fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, marginTop: 4 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: theme.spacing.md },
  searchInput: { flex: 1, minHeight: 46, fontSize: theme.fontSize.base, color: theme.colors.text, paddingVertical: theme.spacing.sm },
  clearSearch: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
  statusBadge: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
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
  customerModeButton: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9 },
  customerModeButtonSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  customerModeText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textLight },
  customerModeTextSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
  newCustomerFields: { gap: theme.spacing.sm },
  customerInput: { minHeight: 48, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, fontSize: theme.fontSize.sm },
  customerOption: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9 },
  customerOptionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  customerOptionText: { gap: 2 },
  productOption: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  productOptionInfo: { flex: 1, gap: 3 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  quantityButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: theme.colors.primarySoft },
  quantityButtonDisabled: { opacity: 0.45 },
  quantityValue: { minWidth: 20, textAlign: 'center', fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
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
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
  footerButton: { minHeight: 46, minWidth: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: theme.spacing.lg },
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
