import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../../styles/theme';

export const PAGE_SIZE = 10;

export function PaginationControls({ page, totalItems, onPageChange, pageSize = PAGE_SIZE }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (pageCount <= 1) return null;
  const currentPage = Math.min(page, pageCount);
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <View style={styles.container} accessibilityLabel="Pagination">
      <Text style={styles.range}>Showing {firstItem}–{lastItem} of {totalItems}</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} accessibilityRole="button" accessibilityLabel="Previous page" style={({ pressed }) => [styles.button, currentPage === 1 && styles.disabled, pressed && styles.pressed]}>
          <MaterialIcons name="chevron-left" size={20} color={theme.colors.primary} accessible={false} />
          <Text style={styles.buttonLabel}>Previous</Text>
        </Pressable>
        <Text style={styles.pageLabel}>Page {currentPage} of {pageCount}</Text>
        <Pressable onPress={() => onPageChange(currentPage + 1)} disabled={currentPage === pageCount} accessibilityRole="button" accessibilityLabel="Next page" style={({ pressed }) => [styles.button, currentPage === pageCount && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>Next</Text>
          <MaterialIcons name="chevron-right" size={20} color={theme.colors.primary} accessible={false} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, paddingTop: theme.spacing.md, marginTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  range: { color: theme.colors.textLight, fontSize: theme.fontSize.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  button: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, backgroundColor: theme.colors.surface },
  buttonLabel: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  pageLabel: { minWidth: 72, textAlign: 'center', color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
