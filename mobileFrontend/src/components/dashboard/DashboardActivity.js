import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../../styles/theme';
import { formatPeso } from './chartGeometry';
import { recentOrders } from './recentOrders';
import { invoiceSummary } from './salesSummary';

const actions = [
  { label: 'Create Invoice', icon: 'add', route: 'Invoices' },
  { label: 'Supplier Orders', icon: 'local-shipping', route: 'Orders' },
  { label: 'Outstanding Balances', icon: 'account-balance-wallet', route: 'Balances' },
];
const statuses = {
  unpaid: { label: 'Unpaid', color: theme.colors.danger, icon: 'error-outline' },
  partial: { label: 'Partial', color: theme.colors.warning, icon: 'schedule' },
  paid: { label: 'Fully paid', color: theme.colors.success, icon: 'check-circle-outline' },
  cancelled: { label: 'Cancelled', color: theme.colors.danger, icon: 'cancel' },
};

export function DashboardActivity({ orders, balances, onNavigate, wide }) {
  const recent = recentOrders(orders);
  return (
    <View style={styles.sections}>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>Quick Actions</Text>
        <View style={[styles.actions, wide && styles.horizontal]}>
          {actions.map(action => (
            <Pressable key={action.route} accessibilityRole="button" onPress={() => onNavigate(action.route)} style={({ pressed }) => [styles.action, wide && styles.grow, pressed && styles.pressed]}>
              <MaterialIcons name={action.icon} size={22} color={theme.colors.onPrimary} accessible={false} />
              <Text style={styles.actionText}>{action.label}</Text>
              <MaterialIcons name="chevron-right" size={20} color={theme.colors.onPrimary} accessible={false} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.headingRow}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>Recent Invoices</Text>
            <Text style={styles.subtitle}>Latest customer invoices</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="View all invoices" onPress={() => onNavigate('Invoices')} style={({ pressed }) => [styles.viewAll, pressed && styles.softPressed]}>
            <Text style={styles.link}>View All</Text>
            <MaterialIcons name="arrow-forward" size={18} color={theme.colors.primary} accessible={false} />
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No invoices yet. Use Create Invoice to get started.</Text>
        ) : recent.map(order => {
          const invoice = invoiceSummary(order, balances.find(balance => balance.orderId === order.id));
          const status = statuses[invoice.status] ?? statuses.unpaid;
          return (
            <View key={order.id} style={styles.order}>
              <View style={styles.orderDetails}>
                <MaterialIcons name="receipt-long" size={22} color={theme.colors.primary} accessible={false} />
                <View style={styles.orderCopy}>
                  <Text style={styles.orderNumber}>{invoice.invoiceNumber}</Text>
                  <Text style={styles.customer}>{order.customer.name}</Text>
                  <Text style={styles.date}>{order.date}</Text>
                </View>
              </View>
              <View style={styles.orderSummary}>
                <Text style={styles.amount}>{formatPeso(order.grandTotal)}</Text>
                <View style={styles.badge}>
                  <MaterialIcons name={status.icon} size={16} color={status.color} accessible={false} />
                  <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: theme.spacing.xl },
  section: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: theme.spacing.lg },
  title: { fontSize: theme.fontSize.base, fontWeight: '600', color: theme.colors.text },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, marginTop: 4 },
  actions: { gap: 12, marginTop: 16 },
  horizontal: { flexDirection: 'row' },
  grow: { flex: 1 },
  action: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: theme.colors.primary, borderRadius: 10 },
  actionText: { flex: 1, color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  softPressed: { backgroundColor: theme.colors.primarySoft },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginBottom: 12 },
  heading: { flexGrow: 1 },
  viewAll: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 8 },
  link: { color: theme.colors.primary, fontWeight: '600', fontSize: theme.fontSize.sm },
  order: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  orderDetails: { flexDirection: 'row', gap: 10, flexBasis: 200, flexGrow: 1, flexShrink: 1 },
  orderCopy: { flex: 1 },
  orderNumber: { fontWeight: '600', fontSize: theme.fontSize.sm, color: theme.colors.text },
  customer: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, marginTop: 4 },
  date: { fontSize: theme.fontSize.xs, color: theme.colors.textLight, marginTop: 4 },
  orderSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  amount: { fontSize: theme.fontSize.base, fontWeight: '700', color: theme.colors.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: theme.colors.background, borderRadius: 8 },
  status: { fontSize: theme.fontSize.sm, fontWeight: '600', flexShrink: 1 },
  empty: { fontSize: theme.fontSize.base, color: theme.colors.textLight, paddingVertical: 24 },
});
