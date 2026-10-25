import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../../styles/theme';
import { PesoInput } from '../ui/PesoInput';

export function ContainerReturnEditor({ rows, onChange, error }) {
  const update = (index, field, value) => onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  return <View style={styles.section}>
    <Text style={styles.title}>Returned containers</Text>
    <Text style={styles.help}>Optional. Returned cases reduce this invoice’s amount due. Use half-case steps.</Text>
    {rows.map((row, index) => <View key={index} style={styles.row}>
      <View style={styles.heading}>
        <Text style={styles.label}>Return type</Text>
        <Pressable onPress={() => onChange(rows.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={`Remove returned case row ${index + 1}`} style={styles.remove}>
          <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
        </Pressable>
      </View>
      <TextInput value={row.type} onChangeText={value => update(index, 'type', value)} accessibilityLabel={`Return type, row ${index + 1}`} placeholder="Type" placeholderTextColor={theme.colors.placeholder} style={styles.input} />
      <Text style={styles.label}>Quantity (cases)</Text>
      <TextInput value={String(row.quantity)} onChangeText={value => update(index, 'quantity', value)} keyboardType="decimal-pad" accessibilityLabel={`Returned cases, row ${index + 1}`} style={styles.input} />
      <Text style={styles.label}>Refund per case</Text>
      <PesoInput value={String(row.refundPerCase)} onChangeText={value => update(index, 'refundPerCase', value)} keyboardType="decimal-pad" accessibilityLabel={`Refund per case, row ${index + 1}`} placeholder="0" placeholderTextColor={theme.colors.placeholder} style={styles.input} />
    </View>)}
    <Pressable disabled={rows.length >= 100} accessibilityRole="button" onPress={() => onChange([...rows, { type: '', quantity: '0.5', refundPerCase: '' }])} style={styles.add}>
      <MaterialIcons name="add" size={20} color={theme.colors.primary} accessible={false} /><Text style={styles.addText}>Add returned case type</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 12 }, title: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  help: { color: theme.colors.textLight, fontSize: 14, lineHeight: 22 },
  row: { borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 8, gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '500' },
  input: { minHeight: 50, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, color: theme.colors.text, fontSize: 16 },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addText: { color: theme.colors.primary, fontSize: 16, fontWeight: '600' }, error: { color: theme.colors.danger, fontSize: 14 },
});
