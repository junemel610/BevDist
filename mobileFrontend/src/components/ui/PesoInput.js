import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import theme from '../../styles/theme';

export function PesoInput({ style, ...props }) {
  return <View style={styles.row}>
    <Text style={styles.prefix}>₱</Text>
    <TextInput {...props} placeholderTextColor={props.placeholderTextColor || theme.colors.placeholder} style={[style, styles.input]} />
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  prefix: { minWidth: 36, minHeight: 38, alignItems: 'center', textAlign: 'center', textAlignVertical: 'center', paddingVertical: 8, paddingHorizontal: 7, overflow: 'hidden', borderRadius: 8, backgroundColor: theme.colors.primarySoft, color: theme.colors.primary, fontSize: 18, fontWeight: '700' },
  input: { flex: 1, minWidth: 0 },
});
