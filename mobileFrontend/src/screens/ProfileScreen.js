import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { confirmAction } from '../utils/confirmAction';

export function ProfileScreen() {
  const { currentUser, logout } = useApp();

  const signOut = () => confirmAction({
    title: 'Sign out?',
    message: 'You can sign back in to continue.',
    confirmLabel: 'Sign out',
    onConfirm: logout,
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.pageHeadingBand}>
          <Text accessibilityRole="header" style={styles.title}>My profile</Text>
          <Text style={styles.subtitle}>Your app account</Text>
        </View>

        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={30} color={theme.colors.primary} accessible={false} />
          </View>
          <View style={styles.accountDetails}>
            <Text style={styles.accountLabel}>Signed in as</Text>
            <Text style={styles.username}>{currentUser || 'User'}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={20} color={theme.colors.primary} accessible={false} />
          <Text style={styles.infoText}>This app is set up for single-user access on this device.</Text>
        </View>

        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="logout" size={20} color={theme.colors.danger} accessible={false} />
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: theme.spacing.lg, gap: theme.spacing.md },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.onPrimary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.onPrimary, opacity: 0.82, fontSize: theme.fontSize.base, marginTop: theme.spacing.xs },
  accountCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.sm, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: theme.colors.primarySoft },
  accountDetails: { flex: 1, gap: theme.spacing.xs },
  accountLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.sm },
  username: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: 12, backgroundColor: theme.colors.primarySoft },
  infoText: { flex: 1, color: theme.colors.primary, fontSize: theme.fontSize.sm, lineHeight: 21 },
  signOutButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 12, backgroundColor: theme.colors.surface },
  signOutLabel: { color: theme.colors.danger, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
