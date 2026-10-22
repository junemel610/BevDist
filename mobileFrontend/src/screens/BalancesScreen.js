import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { balanceStatus, customerCreditKey } from '../components/balances/balanceUtils';
import { allocateAccountPayment, groupOpenCustomerBalances } from '../components/balances/customerAccounts';
import { PAYMENT_METHOD } from '../types';
import { confirmAction } from '../utils/confirmAction';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];
const STATUS = {
  paid: { label: 'Paid', color: theme.colors.success, background: theme.colors.successSoft, icon: 'check-circle-outline' },
  unpaid: { label: 'Unpaid', color: theme.colors.warning, background: theme.colors.warningSoft, icon: 'schedule' },
  overdue: { label: 'Overdue', color: theme.colors.danger, background: theme.colors.dangerSoft, icon: 'error-outline' },
  cancelled: { label: 'Cancelled', color: theme.colors.textLight, background: theme.colors.surfaceMuted, icon: 'cancel' },
};
const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export function BalancesScreen({ navigation }) {
  const { balances, customers, orders, customerCredits = {}, recordCustomerPayment } = useApp();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.CASH);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const records = useMemo(() => balances.map(balance => ({
    ...balance,
    status: balanceStatus(balance),
  })), [balances]);
  const counts = useMemo(() => records.reduce((result, balance) => {
    if (Object.hasOwn(result, balance.status)) result[balance.status] += 1;
    return result;
  }, { all: records.length, unpaid: 0, overdue: 0, paid: 0, cancelled: 0 }), [records]);
  const outstanding = useMemo(() => records.reduce((sum, balance) => (
    balance.status === 'paid' ? sum : sum + Math.max(0, Number(balance.remainingBalance) || 0)
  ), 0), [records]);
  const totalCredit = Object.values(customerCredits).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const customerAccounts = useMemo(() => groupOpenCustomerBalances(balances, orders), [balances, orders]);
  const visibleBalances = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (['all', 'unpaid', 'overdue'].includes(activeFilter)) {
      const accountRows = customerAccounts
        .filter(account => activeFilter === 'all' || account.balances.some(balance => balanceStatus(balance) === activeFilter))
        .filter(account => !query || account.customerName.toLocaleLowerCase().includes(query)
          || account.balances.some(balance => balance.invoiceNumber.toLocaleLowerCase().includes(query)))
        .map(account => ({ ...account, kind: 'account' }));
      const historyRows = activeFilter === 'all'
        ? records.filter(balance => ['paid', 'cancelled'].includes(balance.status)
          && (!query || balance.customerName.toLocaleLowerCase().includes(query)
            || balance.invoiceNumber.toLocaleLowerCase().includes(query)))
        : [];
      return [...accountRows, ...historyRows];
    }
    return records.filter(balance => balance.status === activeFilter
      && (!query || balance.customerName.toLocaleLowerCase().includes(query)
        || balance.invoiceNumber.toLocaleLowerCase().includes(query)))
      .slice().sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }, [records, customerAccounts, activeFilter, search]);

  const openPayment = account => {
    setSelectedAccount(account);
    setPaymentAmount(String(account.outstanding));
    setPaymentMethod(PAYMENT_METHOD.CASH);
    setError('');
    setNotice('');
  };

  const breakdown = selectedAccount
    ? allocateAccountPayment(selectedAccount.balances, orders, paymentAmount)
    : { valid: false, applied: 0, excess: 0, allocations: [] };
  const selectedCustomer = selectedAccount
    ? customers.find(customer => customer.id === selectedAccount.customerId)
      || orders.find(order => selectedAccount.balances.some(balance => balance.orderId === order.id))?.customer
      || customers.find(customer => customer.name === selectedAccount.customerName)
    : null;
  const existingCredit = selectedAccount
    ? Number(customerCredits[customerCreditKey(selectedCustomer || selectedAccount.customerName)] || 0)
    : 0;

  const savePayment = () => {
    if (!selectedAccount || !breakdown.valid) {
      setError('Enter a payment amount greater than ₱0.');
      return;
    }
    confirmAction({
      title: 'Record this payment?',
      message: `${formatPeso(Number(paymentAmount))} by ${paymentMethod} for ${selectedAccount.customerName}. The oldest invoice is paid first; extra payment becomes customer credit.`,
      confirmLabel: 'Record payment',
      onConfirm: () => {
        const result = recordCustomerPayment(selectedAccount, Number(paymentAmount), paymentMethod);
        if (!result) {
          setError('This balance could not be updated. Reopen it and try again.');
          return;
        }
        setSelectedAccount(null);
        setPaymentAmount('');
        setNotice(result.excess > 0
          ? `${formatPeso(result.applied)} applied oldest invoice first. ${formatPeso(result.excess)} saved as customer credit.`
          : 'Payment recorded.');
      },
    });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <FlatList
        data={visibleBalances}
        keyExtractor={item => item.kind === 'account' ? item.key : item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>Balance tracker</Text>
                <Text style={styles.subtitle}>Customer accounts and invoice balances</Text>
              </View>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Outstanding</Text>
                <Text style={styles.totalValue}>{formatPeso(outstanding)}</Text>
              </View>
            </View>
            <Pressable onPress={() => navigation.navigate('GCashTransactions')} accessibilityRole="button" style={({ pressed }) => [styles.gcashLink, pressed && styles.pressed]}>
              <MaterialIcons name="account-balance-wallet" size={18} color={theme.colors.primary} accessible={false} />
              <Text style={styles.gcashLinkText}>Open GCash transactions</Text>
            </Pressable>

            {totalCredit > 0 ? (
              <View style={styles.creditNotice}>
                <MaterialIcons name="account-balance-wallet" size={19} color={theme.colors.primary} accessible={false} />
                <View style={styles.creditNoticeCopy}>
                  <Text style={styles.creditNoticeTitle}>Customer credit available</Text>
                  <Text style={styles.creditNoticeText}>{formatPeso(totalCredit)} in extra payments will automatically reduce customers’ next invoice totals.</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={22} color={theme.colors.textLight} accessible={false} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search customer or invoice"
                placeholderTextColor={theme.colors.textLight}
                accessibilityLabel="Search balances by customer or invoice number"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear balance search" style={styles.clearButton}>
                  <MaterialIcons name="close" size={20} color={theme.colors.textLight} accessible={false} />
                </Pressable>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} accessibilityLabel="Filter balances by status">
              {FILTERS.map(filter => {
                const selected = activeFilter === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setActiveFilter(filter.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${filter.label}, ${counts[filter.key]} ${counts[filter.key] === 1 ? 'balance' : 'balances'}`}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}
                  >
                    {selected && <MaterialIcons name="check" size={15} color={theme.colors.onPrimary} accessible={false} />}
                    <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{filter.label}</Text>
                    <Text style={[styles.filterCount, selected && styles.filterLabelSelected]}>{counts[filter.key]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
        renderItem={({ item }) => item.kind === 'account'
          ? <CustomerAccountCard account={item} onPay={() => openPayment(item)} />
          : <BalanceCard balance={item} />}
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="account-balance-wallet" size={25} color={theme.colors.primary} accessible={false} />
            </View>
            <Text style={styles.emptyTitle}>No balances found</Text>
            <Text style={styles.emptyText}>{search ? 'Try another customer or invoice number.' : 'There are no invoices in this status.'}</Text>
          </View>
        )}
      />

      <Modal visible={Boolean(selectedAccount)} transparent animationType="fade" onRequestClose={() => setSelectedAccount(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.paymentDialog}>
            <View style={styles.modalHeading}>
              <View style={styles.heading}>
                <Text style={styles.modalTitle}>Record customer payment</Text>
                <Text style={styles.modalSubtitle}>{selectedAccount?.balances.length} open invoices · oldest first</Text>
              </View>
              <Pressable onPress={() => setSelectedAccount(null)} accessibilityRole="button" accessibilityLabel="Close payment form" style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>

            <View style={styles.paymentCustomer}>
              <Text style={styles.paymentCustomerName}>{selectedAccount?.customerName}</Text>
              <Text style={styles.paymentDue}>Total open balance {formatPeso(selectedAccount?.outstanding)}</Text>
            </View>
            <Text style={styles.amountLabel}>Payment method</Text>
            <View style={styles.paymentMethods}>
              {Object.values(PAYMENT_METHOD).map(method => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: paymentMethod === method }}
                  style={[styles.methodChip, paymentMethod === method && styles.methodChipSelected]}
                >
                  <MaterialIcons name={paymentMethod === method ? 'radio-button-checked' : 'radio-button-unchecked'} size={17} color={paymentMethod === method ? theme.colors.primary : theme.colors.textLight} accessible={false} />
                  <Text style={[styles.methodText, paymentMethod === method && styles.methodTextSelected]}>{method}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.amountLabel}>Payment received</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>₱</Text>
              <TextInput
                value={paymentAmount}
                onChangeText={value => { setPaymentAmount(value); setError(''); }}
                keyboardType="decimal-pad"
                accessibilityLabel="Payment amount in pesos"
                style={styles.amountInput}
              />
            </View>

            <View style={styles.paymentBreakdown}>
              <Text style={styles.allocationTitle}>Payment allocation · oldest invoice first</Text>
              {breakdown.allocations.map(allocation => (
                <PaymentLine key={allocation.balanceId} label={allocation.invoiceNumber} value={allocation.amount} />
              ))}
              {breakdown.excess > 0 ? (
                <PaymentLine label="Customer credit after invoices" value={breakdown.excess} highlight />
              ) : null}
              {existingCredit > 0 ? (
                <Text style={styles.existingCredit}>Existing customer credit: {formatPeso(existingCredit)}</Text>
              ) : null}
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setSelectedAccount(null)} accessibilityRole="button" style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={savePayment} accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                <Text style={styles.saveLabel}>Record payment</Text>
              </Pressable>
            </View>
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

function BalanceCard({ balance }) {
  const status = STATUS[balance.status] ?? STATUS.unpaid;
  const total = Math.max(0, Number(balance.totalAmount) || 0);
  const paid = Math.min(total, Math.max(0, Number(balance.amountPaid) || 0));
  const remaining = Math.max(0, Number(balance.remainingBalance) || 0);
  const progress = total ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <View style={styles.balanceCard}>
      <View style={styles.cardTop}>
        <View style={styles.customerBlock}>
          <Text style={styles.customerName}>{balance.customerName}</Text>
          <Text style={styles.invoiceMeta}>{balance.invoiceNumber} · Due {balance.dueDate}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
          <MaterialIcons name={status.icon} size={14} color={status.color} accessible={false} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.progressMeta}>
        <Text style={styles.progressText}>Paid {formatPeso(paid)} of {formatPeso(total)}</Text>
        <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
      </View>
      <View accessibilityLabel={`Payment progress ${Math.round(progress)} percent`} style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: status.color }]} />
      </View>

      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.remainingLabel}>Remaining</Text>
          <Text style={[styles.remainingAmount, { color: remaining ? theme.colors.danger : theme.colors.success }]}>{formatPeso(remaining)}</Text>
        </View>
      </View>
    </View>
  );
}

function CustomerAccountCard({ account, onPay }) {
  return (
    <View style={styles.accountCard}>
      <View style={styles.accountHeading}>
        <View style={styles.accountIcon}>
          <MaterialIcons name="person" size={19} color={theme.colors.primary} accessible={false} />
        </View>
        <View style={styles.customerBlock}>
          <Text style={styles.customerName}>{account.customerName}</Text>
          <Text style={styles.invoiceMeta}>{account.balances.length} open {account.balances.length === 1 ? 'invoice' : 'invoices'}</Text>
        </View>
      </View>
      <View style={styles.accountInvoices}>
        {account.balances.map(balance => (
          <View key={balance.id} style={styles.accountInvoiceRow}>
            <View style={styles.customerBlock}>
              <Text style={styles.accountInvoiceNumber}>{balance.invoiceNumber}</Text>
              <Text style={styles.accountInvoiceMeta}>Paid {formatPeso(balance.amountPaid)} · Due {balance.dueDate}</Text>
            </View>
            <Text style={styles.accountInvoiceDue}>{formatPeso(balance.remainingBalance)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.accountFooter}>
        <View>
          <Text style={styles.remainingLabel}>Total outstanding</Text>
          <Text style={styles.accountOutstanding}>{formatPeso(account.outstanding)}</Text>
        </View>
        <Pressable
          onPress={onPay}
          accessibilityRole="button"
          accessibilityLabel={`Record customer payment for ${account.customerName}, ${formatPeso(account.outstanding)} across ${account.balances.length} invoices`}
          style={({ pressed }) => [styles.payButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="payments" size={18} color={theme.colors.onPrimary} accessible={false} />
          <Text style={styles.payLabel}>Record payment</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PaymentLine({ label, value, highlight = false }) {
  return (
    <View style={styles.breakdownLine}>
      <Text style={[styles.breakdownLabel, highlight && styles.creditText]}>{label}</Text>
      <Text style={[styles.breakdownValue, highlight && styles.creditText]}>{formatPeso(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  headerContent: { marginBottom: theme.spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  heading: { flex: 1 },
  title: { color: theme.colors.text, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, marginTop: 3 },
  totalCard: { maxWidth: '48%', paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, backgroundColor: theme.colors.dangerSoft },
  totalLabel: { color: theme.colors.danger, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  totalValue: { color: theme.colors.danger, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, marginTop: 2 },
  creditNotice: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md, padding: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primarySoft },
  creditNoticeCopy: { flex: 1 },
  creditNoticeTitle: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  creditNoticeText: { color: theme.colors.primary, fontSize: theme.fontSize.xs, marginTop: 3 },
  accountCard: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  accountHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  accountIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.colors.primarySoft },
  accountInvoices: { marginTop: theme.spacing.md, paddingLeft: theme.spacing.xs },
  accountInvoiceRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  accountInvoiceNumber: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  accountInvoiceMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 3 },
  accountInvoiceDue: { color: theme.colors.danger, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  accountFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  accountOutstanding: { color: theme.colors.danger, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, marginTop: 2 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  searchInput: { flex: 1, minHeight: 46, color: theme.colors.text, fontSize: theme.fontSize.base, paddingVertical: 0 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterRow: { gap: theme.spacing.sm, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  filterChip: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 22, backgroundColor: theme.colors.surface },
  filterChipSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  filterLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  filterLabelSelected: { color: theme.colors.onPrimary, fontWeight: theme.fontWeight.bold },
  filterCount: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  cardSeparator: { height: theme.spacing.md },
  balanceCard: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  customerBlock: { flex: 1 },
  customerName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  invoiceMeta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, marginTop: 4 },
  statusBadge: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing.sm, borderRadius: 20 },
  statusLabel: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  progressText: { color: theme.colors.textLight, fontSize: theme.fontSize.xs },
  progressPercent: { color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: theme.colors.surfaceMuted },
  progressFill: { height: '100%', borderRadius: 4 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md },
  remainingLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs },
  remainingAmount: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, marginTop: 2 },
  payButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primary },
  payLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  emptyState: { alignItems: 'center', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing['2xl'] },
  emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md, borderRadius: 28, backgroundColor: theme.colors.primarySoft },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  emptyText: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, textAlign: 'center', marginTop: theme.spacing.xs },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.overlay },
  paymentDialog: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: theme.spacing.lg, borderRadius: 18, backgroundColor: theme.colors.surface },
  modalHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  modalTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  modalSubtitle: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, marginTop: 3 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  paymentCustomer: { padding: theme.spacing.md, borderRadius: 11, backgroundColor: theme.colors.surfaceMuted },
  gcashLink: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: theme.spacing.sm },
  gcashLinkText: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  paymentCustomerName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  paymentDue: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, marginTop: 4 },
  amountLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  paymentMethods: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  methodChip: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9 },
  methodChipSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  methodText: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
  methodTextSelected: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  amountInputWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 11 },
  currencyPrefix: { color: theme.colors.textLight, fontSize: theme.fontSize.lg, marginRight: theme.spacing.sm },
  amountInput: { flex: 1, minHeight: 52, color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, paddingVertical: 0 },
  paymentBreakdown: { gap: theme.spacing.sm, marginTop: theme.spacing.md, padding: theme.spacing.md, borderRadius: 11, backgroundColor: theme.colors.background },
  allocationTitle: { color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.xs },
  breakdownLine: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  breakdownLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, flex: 1 },
  breakdownValue: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  creditText: { color: theme.colors.primary },
  existingCredit: { color: theme.colors.primary, fontSize: theme.fontSize.xs, paddingTop: theme.spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.border },
  error: { color: theme.colors.danger, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  cancelButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted },
  cancelLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  saveButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primary },
  saveLabel: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  toast: { position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, bottom: theme.spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primary, elevation: 5 },
  toastText: { flex: 1, color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
