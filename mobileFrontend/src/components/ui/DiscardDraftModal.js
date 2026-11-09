import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import theme from '../../styles/theme';

export function DiscardDraftModal({ visible, title, message, onKeepEditing, onDiscard, discardLabel = 'Discard draft' }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepEditing}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onKeepEditing} accessibilityRole="button" style={({ pressed }) => [styles.keepButton, pressed && styles.pressed]}>
              <Text style={styles.keepText}>Keep editing</Text>
            </Pressable>
            <Pressable onPress={onDiscard} accessibilityRole="button" style={({ pressed }) => [styles.discardButton, pressed && styles.pressed]}>
              <Text style={styles.discardText}>{discardLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.overlay },
  dialog: { width: '100%', maxWidth: 440, padding: theme.spacing.lg, borderRadius: 16, backgroundColor: theme.colors.surface, elevation: 8 },
  title: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  message: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, lineHeight: 22, marginTop: theme.spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  keepButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9 },
  keepText: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  discardButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: 9, backgroundColor: theme.colors.danger },
  discardText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  pressed: { opacity: 0.78 },
});
