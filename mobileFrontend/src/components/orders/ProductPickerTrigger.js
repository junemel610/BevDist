import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../../styles/theme';

export function ProductPickerTrigger({ onPress, disabled = false, accessibilityLabel = 'Select products' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.trigger, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.label}>Select Product</Text>
      <MaterialIcons name="arrow-drop-down" size={24} color={theme.colors.textLight} accessible={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: 1, borderColor: theme.colors.border, paddingHorizontal: theme.spacing.sm, backgroundColor: theme.colors.surface },
  label: { color: theme.colors.textLight, fontSize: theme.fontSize.base },
  disabled: { opacity: 0.55 },
  pressed: { backgroundColor: theme.colors.primarySoft },
});
