import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../styles/theme';

export function FeedbackToast({ message, onDismiss, onViewStock }) {
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return <View style={[styles.toast, { top: insets.top + 8 }]}>
    <MaterialIcons name="check-circle-outline" size={22} color={theme.colors.onPrimary} accessible={false} />
    <View style={styles.copy}><Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.text}>{message}</Text>
      {!!onViewStock && <Pressable onPress={onViewStock} accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>View stock</Text><MaterialIcons name="chevron-right" size={18} color={theme.colors.onPrimary} /></Pressable>}
    </View>
    <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss notification" style={styles.close}><MaterialIcons name="close" size={22} color={theme.colors.onPrimary} /></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  toast: { position: 'absolute', width: '94%', maxWidth: 640, alignSelf: 'center', zIndex: 100, elevation: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: theme.colors.primary, borderWidth: 1, borderColor: theme.colors.onPrimaryMuted },
  copy: { flex: 1 }, text: { color: theme.colors.onPrimary, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, link: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { color: theme.colors.onPrimary, fontSize: 15, textDecorationLine: 'underline' },
});
