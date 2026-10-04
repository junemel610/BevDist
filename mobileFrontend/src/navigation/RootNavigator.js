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
  RestockScreen,
  BalancesScreen,
} from '../screens/index';
import theme from '../styles/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.surface,
        headerTitleStyle: {
          fontWeight: theme.fontWeight.bold,
        },
      }}
    >
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
    </Stack.Navigator>
  );
}

function OrdersStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.surface,
        headerTitleStyle: {
          fontWeight: theme.fontWeight.bold,
        },
      }}
    >
      <Stack.Screen
        name="OrdersMain"
        component={OrdersScreen}
        options={{ title: 'Orders' }}
      />
    </Stack.Navigator>
  );
}

function InventoryStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.surface,
        headerTitleStyle: {
          fontWeight: theme.fontWeight.bold,
        },
      }}
    >
      <Stack.Screen
        name="InventoryMain"
        component={InventoryScreen}
        options={{ title: 'Inventory' }}
      />
    </Stack.Navigator>
  );
}

function RestockStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.surface,
        headerTitleStyle: {
          fontWeight: theme.fontWeight.bold,
        },
      }}
    >
      <Stack.Screen
        name="RestockMain"
        component={RestockScreen}
        options={{ title: 'Restock' }}
      />
    </Stack.Navigator>
  );
}

function BalancesStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.surface,
        headerTitleStyle: {
          fontWeight: theme.fontWeight.bold,
        },
      }}
    >
      <Stack.Screen
        name="BalancesMain"
        component={BalancesScreen}
        options={{ title: 'Balances' }}
      />
    </Stack.Navigator>
  );
}

function HomeTabsScreen() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'dashboard' : 'dashboard';
          } else if (route.name === 'Orders') {
            iconName = focused ? 'shopping-cart' : 'shopping-cart';
          } else if (route.name === 'Inventory') {
            iconName = focused ? 'inventory' : 'inventory';
          } else if (route.name === 'Restock') {
            iconName = focused ? 'local-shipping' : 'local-shipping';
          } else if (route.name === 'Balances') {
            iconName = focused ? 'account-balance' : 'account-balance';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textLight,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStackScreen} />
      <Tab.Screen name="Orders" component={OrdersStackScreen} />
      <Tab.Screen name="Inventory" component={InventoryStackScreen} />
      <Tab.Screen name="Restock" component={RestockStackScreen} />
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
