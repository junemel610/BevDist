import { Alert, Platform } from 'react-native';

export function confirmAction({ title, message, confirmLabel = 'Confirm', destructive = false, onConfirm }) {
  const run = async () => {
    try { await onConfirm(); }
    catch (error) {
      const message = error.response?.data?.error || error.message || 'Could not save. Please try again.';
      if (Platform.OS === 'web') globalThis.alert?.(message);
      else Alert.alert('Could not save', message);
    }
  };
  if (Platform.OS === 'web') {
    if (typeof globalThis.confirm === 'function' && globalThis.confirm(`${title}\n\n${message}`)) void run();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Go back', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: run },
  ]);
}
