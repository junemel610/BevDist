import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import theme from '../../styles/theme';

const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export function PaymentMethodTransactionsScreen({ method, title, description, icon, emptyTitle, emptyDescription }) {
  const { paymentTransactions } = useApp();
  const transactions = useMemo(() => paymentTransactions
    .filter(payment => payment.method === method)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date)), [paymentTransactions, method]);
  const totals = useMemo(() => transactions.reduce((result, payment) => {
    result.received += payment.amountReceived;
    result.applied += payment.amountApplied;
    result.excess += payment.excess;
    return result;
  }, { received: 0, applied: 0, excess: 0 }), [transactions]);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.pageHeadingBand}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{description}</Text>
            </View>
            <View style={styles.summary}>
              <Summary label="Received" value={totals.received} />
              <Summary label="Applied" value={totals.applied} />
              <Summary label="Credit" value={totals.excess} />
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons name={icon} size={20} color={theme.colors.primary} accessible={false} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.customer}>{item.customerName}</Text>
              <Text style={styles.meta}>{item.invoiceNumber} · {item.date}</Text>
              {item.excess > 0 ? <Text style={styles.creditText}>{formatPeso(item.excess)} credit for next invoice</Text> : null}
            </View>
            <Text style={styles.amount}>{formatPeso(item.amountApplied)}</Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <MaterialIcons name={icon} size={30} color={theme.colors.primary} accessible={false} />
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.subtitle}>{emptyDescription}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Summary({ label, value }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{formatPeso(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  list: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, flexGrow: 1 },
  header: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.onPrimary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.onPrimary, opacity: 0.82, fontSize: theme.fontSize.sm, lineHeight: 20 },
  summary: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  summaryItem: { flex: 1, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.surface },
  summaryLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.xs },
  summaryValue: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, marginTop: 5 },
  card: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  iconWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  copy: { flex: 1, gap: 2 },
  customer: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  meta: { color: theme.colors.textLight, fontSize: theme.fontSize.xs },
  creditText: { color: theme.colors.primary, fontSize: theme.fontSize.xs },
  amount: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  separator: { height: theme.spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, padding: theme.spacing.xl },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
});
