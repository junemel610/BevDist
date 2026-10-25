import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DashboardActivity, QuickActions } from '../components/dashboard/DashboardActivity';
import { SalesChart } from '../components/dashboard/SalesChart';
import { formatPeso } from '../components/dashboard/chartGeometry';
import { salesSummary, salesTrends, dailyAppliedPayments } from '../components/dashboard/salesSummary';
import theme from '../styles/theme';

export function DashboardScreen({ navigation }) {
  const [contentWidth, setContentWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const { orders, balances, paymentTransactions, getLowStockCount } = useApp();
  const navigateTo = useCallback(route => navigation.getParent()?.navigate(route), [navigation]);
  const openCreateInvoice = useCallback(() => navigation.getParent()?.navigate('Invoices', {
    screen: 'InvoicesMain',
    params: { openCreateInvoiceToken: Date.now() },
  }), [navigation]);
  const gap = theme.spacing.md;
  const fittingColumns = Math.floor((contentWidth + gap) / (150 * fontScale + gap));
  const columns = fittingColumns >= 4 ? 4 : fittingColumns >= 2 ? 2 : 1;
  const cardWidth = contentWidth ? (contentWidth - gap * (columns - 1)) / columns : undefined;
  const wide = contentWidth >= 720 * fontScale;
  const chartWidth = wide ? (contentWidth - gap) / 2 : '100%';
  const sales = salesSummary(orders, balances, paymentTransactions);
  const dailyPayments = dailyAppliedPayments(orders, balances, paymentTransactions);
  const trends = salesTrends(orders, balances, paymentTransactions);
  const summary = [
    { label: 'Outstanding Invoices', value: sales.outstandingInvoices },
    { label: 'Outstanding Balances', value: formatPeso(sales.outstanding) },
    { label: 'Completed Orders', value: sales.completedOrders },
    { label: 'Case Types to Restock', value: getLowStockCount() },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sections} onLayout={({ nativeEvent }) => setContentWidth(nativeEvent.layout.width)}>
          <View style={styles.pageHeader}>
            <Text accessibilityRole="header" style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Business overview</Text>
          </View>

          <QuickActions onNavigate={navigateTo} onCreateInvoice={openCreateInvoice} wide={wide} />

          <View>
            <View style={styles.demoNotice}>
              <Text style={styles.demoText}>Cancelled invoices and extra payments are excluded from sales.</Text>
            </View>
          </View>

          <View style={styles.salesCard}>
            <View style={styles.salesHeading}>
              <View>
                <Text style={styles.sectionTitle}>Sales</Text>
                <Text style={styles.sectionHint}>Expected invoice value and cash received</Text>
              </View>
              <MaterialIcons name="payments" size={22} color={theme.colors.primary} accessible={false} />
            </View>
            <View style={styles.salesValues}>
              <View style={styles.salesMetric}>
                <Text style={styles.cardLabel}>Total Expected Sales</Text>
                <Text style={styles.expectedValue}>{formatPeso(sales.expected)}</Text>
              </View>
              <View style={styles.salesDivider} />
              <View style={styles.salesMetric}>
                <Text style={styles.cardLabel}>Actual Sales</Text>
                <Text style={styles.actualValue}>{formatPeso(sales.actual)}</Text>
              </View>
            </View>
            <Text style={styles.salesHint}>Actual Sales counts cash payments applied to invoices.</Text>
          </View>

          <View style={styles.metrics}>
            <View style={[styles.card, styles.dailyCard]}>
              <Text style={styles.sectionTitle}>Payments today</Text>
              <Text style={styles.cardHint}>Applied to invoices · extra payments excluded</Text>
              <View style={[styles.dailyMethods, wide && styles.dailyMethodsWide]}>
                {Object.entries(dailyPayments).map(([method, amount]) => (
                  <View key={method} style={[styles.dailyMethod, wide && styles.dailyMethodWide]}>
                    <Text style={styles.dailyLabel}>{method}</Text>
                    <Text style={styles.cashValue}>{formatPeso(amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.grid}>
              {summary.map(card => (
                <View key={card.label} style={[styles.card, { width: cardWidth ?? '100%' }]}>
                  <Text style={styles.cardLabel}>{card.label}</Text>
                  <Text style={styles.cardValue}>{card.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.grid}>
            <View style={{ width: chartWidth }}>
              <SalesChart title="Daily Cash Sales" subtitle="Cash applied · last 7 days" data={trends.daily} />
            </View>
            <View style={{ width: chartWidth }}>
              <SalesChart title="Monthly Cash Sales" subtitle="Cash applied · last 6 months" data={trends.monthly} variant="bar" />
            </View>
          </View>
          <DashboardActivity orders={orders} balances={balances} wide={wide} onNavigate={navigateTo} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] },
  sections: { gap: theme.spacing.xl },
  pageHeader: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, backgroundColor: theme.colors.primary },
  title: { fontSize: theme.fontSize['2xl'], fontWeight: '700', color: theme.colors.onPrimary },
  subtitle: { fontSize: theme.fontSize.base, color: theme.colors.onPrimary, opacity: 0.82, marginTop: 4 },
  demoNotice: { marginTop: theme.spacing.md },
  demoText: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, lineHeight: 21 },
  salesCard: { padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  salesHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  sectionHint: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, lineHeight: 21, marginTop: 2 },
  salesValues: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  salesMetric: { flex: 1 },
  salesDivider: { width: 1, height: 48, backgroundColor: theme.colors.border },
  cardLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, marginBottom: theme.spacing.xs },
  expectedValue: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  actualValue: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
  salesHint: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, lineHeight: 20, marginTop: theme.spacing.md },
  metrics: { gap: theme.spacing.md },
  dailyCard: { width: '100%', padding: theme.spacing.lg },
  dailyMethods: { gap: theme.spacing.md, marginTop: theme.spacing.lg },
  dailyMethodsWide: { flexDirection: 'row' },
  dailyMethod: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: theme.spacing.md },
  dailyMethodWide: { flex: 1, flexDirection: 'column', alignItems: 'flex-start' },
  dailyLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.base },
  cashValue: { maxWidth: '100%', color: theme.colors.primary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: { minHeight: 104, justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: theme.spacing.md },
  cardValue: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  cardHint: { fontSize: theme.fontSize.xs, color: theme.colors.textLight, lineHeight: 19, marginTop: 5 },
});
