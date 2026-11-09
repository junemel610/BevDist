import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { balanceStatus, customerCreditRows } from '../components/balances/balanceUtils';
import { groupOpenCustomerBalances } from '../components/balances/customerAccounts';
import { FeedbackToast } from '../components/FeedbackToast';
import { CustomerPaymentModal } from '../components/balances/CustomerPaymentModal';

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
  const { balances, customers, orders, customerCredits = {} } = useApp();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 6500);
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
  const availableCredits = useMemo(() => customerCreditRows(customerCredits, customers), [customerCredits, customers]);
  const totalCredit = availableCredits.reduce((sum, credit) => sum + credit.amount, 0);
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

  const openPayment = account => { setSelectedAccount(account); setNotice(''); };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <FlatList
        data={visibleBalances}
        keyExtractor={item => item.kind === 'account' ? item.key : item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={[styles.titleRow, styles.pageHeadingBand]}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>Balance tracker</Text>
                <Text style={styles.subtitle}>Customer accounts and invoice balances</Text>
              </View>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Outstanding</Text>
                <Text style={styles.totalValue}>{formatPeso(outstanding)}</Text>
              </View>
            </View>
            <View style={styles.transactionLinks}>
              <Pressable onPress={() => navigation.navigate('GCashTransactions')} accessibilityRole="button" accessibilityLabel="Open GCash transactions" style={({ pressed }) => [styles.transactionLink, pressed && styles.pressed]}>
                <MaterialIcons name="account-balance-wallet" size={18} color={theme.colors.primary} accessible={false} />
                <Text style={styles.transactionLinkText}>Open GCash transactions</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('BankTransferTransactions')} accessibilityRole="button" accessibilityLabel="Open Bank Transfer transactions" style={({ pressed }) => [styles.transactionLink, pressed && styles.pressed]}>
                <MaterialIcons name="account-balance" size={18} color={theme.colors.primary} accessible={false} />
                <Text style={styles.transactionLinkText}>Open Bank Transfer transactions</Text>
              </Pressable>
            </View>

            {totalCredit > 0 ? (
              <View style={styles.creditNotice}>
                <MaterialIcons name="account-balance-wallet" size={19} color={theme.colors.primary} accessible={false} />
                <View style={styles.creditNoticeCopy}>
                  <Text style={styles.creditNoticeTitle}>Customer credit available</Text>
                  {availableCredits.slice(0, 3).map(credit => (
                    <Text key={credit.key} style={styles.creditNoticeText}>{credit.name} · {formatPeso(credit.amount)}</Text>
                  ))}
                  <Pressable onPress={() => navigation.navigate('CustomerCredits')} accessibilityRole="button" style={styles.creditLink}>
                    <Text style={styles.creditNoticeTitle}>View {availableCredits.length > 3 ? 'all ' : ''}{availableCredits.length} {availableCredits.length === 1 ? 'customer' : 'customers'} · {formatPeso(totalCredit)}</Text>
                    <MaterialIcons name="chevron-right" size={22} color={theme.colors.primary} accessible={false} />
                  </Pressable>
                  <Text style={styles.creditNoticeHint}>Credit will automatically reduce that customer’s next invoice total.</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={22} color={theme.colors.textLight} accessible={false} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search balances"
                placeholderTextColor={theme.colors.placeholder}
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
                    {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
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

      {selectedAccount && <CustomerPaymentModal customerId={selectedAccount.customerId} onClose={() => setSelectedAccount(null)} onSaved={setNotice} />}


      <FeedbackToast message={notice} onDismiss={() => setNotice('')} />
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

const styles = StyleSheet.create({
  creditLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  headerContent: { marginBottom: theme.spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  heading: { flex: 1 },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.onPrimary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.onPrimary, opacity: 0.82, fontSize: theme.fontSize.sm, marginTop: 3 },
  totalCard: { maxWidth: '48%', paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, backgroundColor: theme.colors.dangerSoft },
  totalLabel: { color: theme.colors.danger, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  totalValue: { color: theme.colors.danger, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, marginTop: 2 },
  creditNotice: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md, padding: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primarySoft },
  creditNoticeCopy: { flex: 1 },
  creditNoticeTitle: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  creditNoticeText: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginTop: 5 },
  creditNoticeHint: { color: theme.colors.primary, fontSize: theme.fontSize.xs, lineHeight: 18, marginTop: 4 },
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
  transactionLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  transactionLink: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.surface },
  transactionLinkText: { color: theme.colors.primary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
