import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../styles/theme';
export { OrdersScreen } from './OrdersScreen';
export { InventoryScreen } from './InventoryScreen';
export { SupplierOrdersScreen } from './SupplierOrdersScreen';

function PlaceholderScreen({ title }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.placeholder}>{title} screen coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

export const BalancesScreen = () => <PlaceholderScreen title="Balances" />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  placeholder: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
});
