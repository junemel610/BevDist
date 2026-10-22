import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DashboardActivity } from '../components/dashboard/DashboardActivity';
import { SalesChart } from '../components/dashboard/SalesChart';
import { formatPeso } from '../components/dashboard/chartGeometry';
import { salesSummary, salesTrends } from '../components/dashboard/salesSummary';
import theme from '../styles/theme';

export function DashboardScreen({ navigation }) {
  const [contentWidth, setContentWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const { orders, balances, paymentTransactions, getLowStockCount } = useApp();
  const gap = theme.spacing.md;
  const columns = Math.max(1, Math.min(4, Math.floor((contentWidth + gap) / (150 * fontScale + gap))));
  const cardWidth = contentWidth ? (contentWidth - gap * (columns - 1)) / columns : undefined;
  const wide = contentWidth >= 720 * fontScale;
  const chartWidth = wide ? (contentWidth - gap) / 2 : '100%';
  const sales = salesSummary(orders, balances, paymentTransactions);
  const trends = salesTrends(orders, paymentTransactions);
  const summary = [
    { label: 'Total Expected Sales', value: formatPeso(sales.expected), icon: 'receipt-long', hint: 'Invoice totals · excludes cancelled' },
    { label: 'Actual Sales', value: formatPeso(sales.actual), icon: 'payments', hint: 'Cash applied · excludes excess' },
    { label: 'Outstanding Invoices', value: sales.outstandingInvoices, icon: 'assignment' },
    { label: 'Completed Orders', value: sales.completedOrders, icon: 'check-circle-outline', hint: 'Delivered and fully paid' },
    { label: 'Outstanding Balances', value: formatPeso(sales.outstanding), icon: 'account-balance-wallet' },
    { label: 'Case Types to Restock', value: getLowStockCount(), icon: 'inventory-2' },
  ];

  return (
    // The navigator already handles the top header and bottom tab safe areas.
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sections} onLayout={({ nativeEvent }) => setContentWidth(nativeEvent.layout.width)}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Business overview</Text>
            <View style={styles.demoNotice}>
              <MaterialIcons name="info-outline" size={18} color={theme.colors.primary} accessible={false} />
              <Text style={styles.demoText}>Sales totals and charts use invoice and payment records. Cash applied is shown; cancelled invoices and excess payments are excluded.</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {summary.map(card => (
              <View key={card.label} style={[styles.card, { width: cardWidth ?? '100%' }]}>
                <View style={styles.icon}>
                  <MaterialIcons name={card.icon} size={22} color={theme.colors.primary} accessible={false} />
                </View>
                <Text style={styles.cardLabel}>{card.label}</Text>
                <Text style={styles.cardValue}>{card.value}</Text>
                {!!card.hint && <Text style={styles.cardHint}>{card.hint}</Text>}
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            <View style={{ width: chartWidth }}>
              <SalesChart title="Daily Cash Sales" subtitle="Cash applied · last 7 days" data={trends.daily} />
            </View>
            <View style={{ width: chartWidth }}>
              <SalesChart title="Monthly Cash Sales" subtitle="Cash applied · last 6 months" data={trends.monthly} variant="bar" />
            </View>
          </View>
          <DashboardActivity orders={orders} balances={balances} wide={wide} onNavigate={route => navigation.getParent().navigate(route)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] },
  sections: { gap: theme.spacing.xl },
  title: { fontSize: theme.fontSize['2xl'], fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: theme.fontSize.base, color: theme.colors.textLight, marginTop: 4 },
  demoNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: theme.colors.primarySoft },
  demoText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: theme.spacing.lg },
  icon: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, marginBottom: 8 },
  cardValue: { fontSize: theme.fontSize['2xl'], fontWeight: '700', color: theme.colors.primary },
  cardHint: { fontSize: theme.fontSize.xs, color: theme.colors.textLight, marginTop: 6 },
});
