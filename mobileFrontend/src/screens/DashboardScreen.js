import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DashboardActivity, QuickActions } from '../components/dashboard/DashboardActivity';
import { SalesChart } from '../components/dashboard/SalesChart';
import { formatPeso } from '../components/dashboard/chartGeometry';
import { salesSummary, salesTrends } from '../components/dashboard/salesSummary';
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
  const columns = Math.max(1, Math.min(4, Math.floor((contentWidth + gap) / (150 * fontScale + gap))));
  const cardWidth = contentWidth ? (contentWidth - gap * (columns - 1)) / columns : undefined;
  const wide = contentWidth >= 720 * fontScale;
  const chartWidth = wide ? (contentWidth - gap) / 2 : '100%';
  const sales = salesSummary(orders, balances, paymentTransactions);
  const trends = salesTrends(orders, balances, paymentTransactions);
  const summary = [
    { label: 'Outstanding Invoices', value: sales.outstandingInvoices },
    { label: 'Completed Orders', value: sales.completedOrders, hint: 'Delivered and fully paid' },
    { label: 'Outstanding Balances', value: formatPeso(sales.outstanding) },
    { label: 'Case Types to Restock', value: getLowStockCount() },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sections} onLayout={({ nativeEvent }) => setContentWidth(nativeEvent.layout.width)}>
          <View>
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
                <Text style={styles.cardLabel}>Total expected</Text>
                <Text style={styles.expectedValue}>{formatPeso(sales.expected)}</Text>
              </View>
              <View style={styles.salesDivider} />
              <View style={styles.salesMetric}>
                <Text style={styles.cardLabel}>Actual sales</Text>
                <Text style={styles.actualValue}>{formatPeso(sales.actual)}</Text>
              </View>
            </View>
            <Text style={styles.salesHint}>Actual sales counts cash payments applied to invoices.</Text>
          </View>

          <View style={styles.grid}>
            {summary.map(card => (
              <View key={card.label} style={[styles.card, { width: cardWidth ?? '100%' }]}>
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
          <DashboardActivity orders={orders} balances={balances} wide={wide} onNavigate={navigateTo} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: { minHeight: 104, justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: theme.spacing.md },
  cardValue: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  cardHint: { fontSize: theme.fontSize.xs, color: theme.colors.textLight, lineHeight: 19, marginTop: 5 },
});
