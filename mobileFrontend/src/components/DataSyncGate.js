import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';

export function DataSyncGate({ children }) {
  const { isLoggedIn, busy, dataError, refreshData, logout } = useApp();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const recover = async action => {
    if (retrying) return;
    setRetrying(true);
    setError('');
    try { await action(); }
    catch { setError('Cannot reach the server. Please try again.'); }
    finally { setRetrying(false); }
  };
  if (isLoggedIn && dataError) return (
    <View style={styles.recovery}>
      <Text accessibilityRole="header" style={styles.heading}>Refresh business records</Text>
      <Text accessibilityRole="alert" style={styles.copy}>{dataError}</Text>
      {!!error && <Text accessibilityRole="alert" style={styles.copy}>{error}</Text>}
      <Pressable disabled={retrying} onPress={() => recover(refreshData)} accessibilityRole="button" style={styles.button}>
        <Text style={styles.onPrimary}>{retrying ? 'Refreshing…' : 'Refresh records'}</Text>
      </Pressable>
      <Pressable disabled={retrying} onPress={() => recover(logout)} accessibilityRole="button" style={styles.button}><Text style={styles.onPrimary}>Sign out</Text></Pressable>
    </View>
  );
  return <>
    {children}
    <Modal visible={isLoggedIn && busy} transparent animationType="none" onRequestClose={() => {}}>
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.onPrimary} />
        <Text accessibilityRole="alert" style={styles.onPrimary}>Saving and refreshing records…</Text>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  recovery: { flex: 1, justifyContent: 'center', padding: 32, gap: 20, backgroundColor: theme.colors.background },
  heading: { fontSize: 24, color: theme.colors.text },
  copy: { color: theme.colors.text, fontSize: 16, lineHeight: 24 },
  button: { padding: 18, borderRadius: 10, backgroundColor: theme.colors.primary },
  onPrimary: { color: theme.colors.onPrimary, fontSize: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: theme.colors.overlay },
});
