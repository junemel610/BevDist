import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DAILY_SALES, MONTHLY_SALES } from '../data/initialData';
import { SalesChart } from '../components/dashboard/SalesChart';
import { formatPeso } from '../components/dashboard/chartGeometry';
import theme from '../styles/theme';

const daily = DAILY_SALES.map(item => ({ label: item.day, value: item.sales }));
const monthly = MONTHLY_SALES.map(item => ({ label: item.month, value: item.revenue }));

export function DashboardScreen() {
  const [contentWidth, setContentWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const { getPendingOrdersCount, getCompletedOrdersCount, getOutstandingBalance, getLowStockCount } = useApp();
  const gap = theme.spacing.md;
  const columns = Math.max(1, Math.min(5, Math.floor((contentWidth + gap) / (150 * fontScale + gap))));
  const cardWidth = contentWidth ? (contentWidth - gap * (columns - 1)) / columns : undefined;
  const wide = contentWidth >= 720 * fontScale;
  const chartWidth = wide ? (contentWidth - gap) / 2 : '100%';
  // Match the Prototype's demo-day sales; no live/backend reporting is implied.
  const sampleSales = DAILY_SALES[DAILY_SALES.length - 1]?.sales ?? 0;
  const summary = [
    { label: "Today's Sales", value: formatPeso(sampleSales), icon: 'payments' },
    { label: 'Pending Orders', value: getPendingOrdersCount(), icon: 'assignment' },
    { label: 'Completed Orders', value: getCompletedOrdersCount(), icon: 'check-circle-outline' },
    { label: 'Outstanding Balances', value: formatPeso(getOutstandingBalance()), icon: 'account-balance-wallet' },
    { label: 'Low Stock Products', value: getLowStockCount(), icon: 'inventory-2' },
  ];

  return (
    // The navigator already handles the top header and bottom tab safe areas.
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sections} onLayout={({ nativeEvent }) => setContentWidth(nativeEvent.layout.width)}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Business overview for today</Text>
            <View style={styles.demoNotice}>
              <MaterialIcons name="info-outline" size={18} color={theme.colors.primary} accessible={false} />
              <Text style={styles.demoText}>Demo data · Illustrative sales and revenue.</Text>
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
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            <View style={{ width: chartWidth }}>
              <SalesChart title="Daily Sales Trend" subtitle="Sales across the sample week" data={daily} />
            </View>
            <View style={{ width: chartWidth }}>
              <SalesChart title="Monthly Revenue Overview" subtitle="January – June · Sample revenue" data={monthly} variant="bar" />
            </View>
          </View>
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
});
