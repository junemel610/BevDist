import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import {
  OrdersScreen,
  InventoryScreen,
  SupplierOrdersScreen,
  BalancesScreen,
  CustomerProfilesScreen,
  GCashTransactionsScreen,
} from '../screens/index';
import theme from '../styles/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: theme.colors.surface },
  headerTintColor: theme.colors.text,
  headerTitleStyle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold },
  headerShadowVisible: false,
};

function createStackScreen(title, component) {
  return function AppStackScreen() {
    return (
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name={`${title}Main`} component={component} options={{ title }} />
      </Stack.Navigator>
    );
  };
}

const DashboardStackScreen = createStackScreen('Dashboard', DashboardScreen);
function OrdersStackScreen() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="InvoicesMain" component={OrdersScreen} options={{ title: 'Invoices' }} />
      <Stack.Screen name="CustomerProfiles" component={CustomerProfilesScreen} options={{ title: 'Customers' }} />
    </Stack.Navigator>
  );
}
const InventoryStackScreen = createStackScreen('Inventory', InventoryScreen);
const SupplierOrdersStackScreen = createStackScreen('Orders', SupplierOrdersScreen);
function BalancesStackScreen() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="BalancesMain" component={BalancesScreen} options={{ title: 'Balances' }} />
      <Stack.Screen name="GCashTransactions" component={GCashTransactionsScreen} options={{ title: 'GCash' }} />
    </Stack.Navigator>
  );
}

const tabIcons = {
  Dashboard: 'dashboard',
  Invoices: 'receipt-long',
  Inventory: 'inventory',
  Orders: 'local-shipping',
  Balances: 'account-balance',
};

function HomeTabsScreen() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons name={tabIcons[route.name]} size={size} color={color} />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textLight,
        tabBarLabelStyle: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          minHeight: 64,
          paddingTop: 5,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStackScreen} />
      <Tab.Screen name="Invoices" component={OrdersStackScreen} />
      <Tab.Screen name="Inventory" component={InventoryStackScreen} />
      <Tab.Screen name="Orders" component={SupplierOrdersStackScreen} />
      <Tab.Screen name="Balances" component={BalancesStackScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { isLoggedIn } = useApp();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animationEnabled: false }}
        />
      ) : (
        <Stack.Screen
          name="HomeTabs"
          component={HomeTabsScreen}
          options={{ animationEnabled: false }}
        />
      )}
    </Stack.Navigator>
  );
}
