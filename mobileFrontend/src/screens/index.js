import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import theme from '../styles/theme';

export function OrdersScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.placeholder}>Orders screen coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

export function InventoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.placeholder}>Inventory screen coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

export function RestockScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Restock</Text>
        <Text style={styles.placeholder}>Restock screen coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

export function BalancesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Balances</Text>
        <Text style={styles.placeholder}>Balances screen coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

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
