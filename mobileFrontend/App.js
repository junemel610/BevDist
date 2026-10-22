import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import theme from './src/styles/theme';

export default function App() {
  return (
    <AppProvider>
      <StatusBar hidden={false} style="light" backgroundColor={theme.colors.primary} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}
