import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';

export function DashboardScreen() {
  const [gridWidth, setGridWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const gap = theme.spacing.md;
  const columns = Math.max(1, Math.min(3, Math.floor((gridWidth + gap) / (180 * fontScale + gap))));
  const cardWidth = gridWidth > 0 ? (gridWidth - gap * (columns - 1)) / columns : undefined;
  const {
    getTodaySales,
    getPendingOrdersCount,
    getCompletedOrdersCount,
    getOutstandingBalance,
    getLowStockCount,
  } = useApp();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dashboard</Text>

        {/* KPI Cards */}
        <View style={styles.kpiGrid} onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}>
          <View style={[styles.card, { width: cardWidth ?? '100%' }]}>
            <Text style={styles.cardLabel}>Today's Sales</Text>
            <Text style={styles.cardValue}>₱{getTodaySales().toLocaleString()}</Text>
          </View>

          <View style={[styles.card, { width: cardWidth ?? '100%' }]}>
            <Text style={styles.cardLabel}>Pending Orders</Text>
            <Text style={styles.cardValue}>{getPendingOrdersCount()}</Text>
          </View>

          <View style={[styles.card, { width: cardWidth ?? '100%' }]}>
            <Text style={styles.cardLabel}>Completed Orders</Text>
            <Text style={styles.cardValue}>{getCompletedOrdersCount()}</Text>
          </View>

          <View style={[styles.card, { width: cardWidth ?? '100%' }]}>
            <Text style={styles.cardLabel}>Outstanding Balance</Text>
            <Text style={styles.cardValue}>₱{getOutstandingBalance().toLocaleString()}</Text>
          </View>

          <View style={[styles.card, { width: cardWidth ?? '100%' }]}>
            <Text style={styles.cardLabel}>Low Stock Items</Text>
            <Text style={styles.cardValue}>{getLowStockCount()}</Text>
          </View>
        </View>

        {/* Placeholder for charts */}
        <View style={styles.chartPlaceholder}>
          <Text style={styles.placeholderText}>Charts coming soon...</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  card: {

    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderRadius: 12,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xs,
  },
  cardValue: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  chartPlaceholder: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.lg,
  },
  placeholderText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
});
