import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import theme from '../../styles/theme';

export function TransactionModeSelector({ options, selected, onSelect, accessibilityLabel }) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.container}>
      {options.map(option => {
        const active = selected === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.accessibilityLabel || option.label}
            accessibilityState={{ selected: active }}
            aria-pressed={active}
            style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: theme.spacing.sm, padding: 4, borderRadius: 12, backgroundColor: theme.colors.surfaceMuted },
  option: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.sm, borderRadius: 9 },
  optionActive: { backgroundColor: theme.colors.primary },
  label: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, textAlign: 'center' },
  labelActive: { color: theme.colors.onPrimary },
  pressed: { opacity: 0.75 },
});
