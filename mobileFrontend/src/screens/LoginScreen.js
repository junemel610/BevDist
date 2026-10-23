import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';

export function LoginScreen() {
  const { login, sessionMessage } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const pending = useRef(false);

  const handleLogin = async () => {
    if (pending.current) return;
    const nextUsernameError = username.trim() ? '' : 'Enter your username.';
    const nextPasswordError = password.trim() ? '' : 'Enter your password.';
    setUsernameError(nextUsernameError);
    setPasswordError(nextPasswordError);
    if (nextUsernameError || nextPasswordError) return;

    pending.current = true;
    setLoading(true);
    setLoginError('');
    try { await login(username, password); }
    catch (error) {
      setLoginError(error.response?.data?.error || 'Cannot reach the server. Check your connection and try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.brand}>
            <Image
              source={require('../../assets/images/bevdist-icon.png')}
              style={styles.brandMark}
              resizeMode="cover"
              accessible={false}
            />
            <Text style={styles.logo}>BevDist</Text>
          </View>

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to manage invoices and stock.</Text>
          </View>

          <View style={styles.form}>
            {loginError || sessionMessage ? <Text accessibilityRole="alert" style={styles.error}>{loginError || sessionMessage}</Text> : null}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, usernameError && styles.inputError]}
                placeholder="Enter your username"
                value={username}
                onChangeText={value => { setUsername(value); setUsernameError(''); }}
                editable={!loading}
                placeholderTextColor={theme.colors.textLight}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Username"
                returnKeyType="next"
              />
              {usernameError ? <Text accessibilityRole="alert" style={styles.error}>{usernameError}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, passwordError && styles.inputError]}
                placeholder="Enter your password"
                value={password}
                onChangeText={value => { setPassword(value); setPasswordError(''); }}
                secureTextEntry
                editable={!loading}
                placeholderTextColor={theme.colors.textLight}
                autoCapitalize="none"
                accessibilityLabel="Password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              {passwordError ? <Text accessibilityRole="alert" style={styles.error}>{passwordError}</Text> : null}
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, loading && styles.buttonDisabled, pressed && !loading && styles.buttonPressed]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
            >
              <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
            </Pressable>
          </View>

          <View style={styles.demoInfo}>
            <MaterialIcons name="info-outline" size={18} color={theme.colors.primary} accessible={false} />
            <Text style={styles.demoText}>Use your registered account. Your invoices and stock are saved to the business database.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  brandMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.colors.primary },
  logo: { color: theme.colors.primary, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  heading: { marginBottom: theme.spacing.xl },
  title: { color: theme.colors.text, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.textLight, fontSize: theme.fontSize.base, lineHeight: 24, marginTop: theme.spacing.xs },
  form: { gap: theme.spacing.lg, marginBottom: theme.spacing.xl },
  inputGroup: { gap: theme.spacing.xs },
  label: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold },
  input: {
    minHeight: 54,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    fontSize: theme.fontSize.base,
  },
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: theme.fontSize.sm },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: theme.colors.primary },
  buttonDisabled: { opacity: 0.6 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  demoInfo: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primarySoft },
  demoText: { flex: 1, color: theme.colors.primary, fontSize: theme.fontSize.sm, lineHeight: 21 },
});
