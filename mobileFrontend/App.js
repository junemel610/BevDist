import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppProvider } from './src/context/AppContext';

export default function App() {
  return (
    <AppProvider>
      <View style={styles.container}>
        <Text style={styles.title}>BevDist POS</Text>
        <Text style={styles.subtitle}>React Native + Expo</Text>
      </View>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
