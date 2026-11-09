import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../../styles/theme';
import { PesoInput } from '../ui/PesoInput';

export function ContainerReturnEditor({
  rows,
  onChange,
  error,
  sectionTitle = 'Deposit / Return',
  helperText = 'Deposits add to the invoice. Returned containers reduce the amount due.',
  showKindSelector = true,
  minimumQuantity = 0.5,
  initialQuantity = 0.5,
  addButtonLabel = 'Add deposit / return line',
  addAccessibilityLabel = 'Add deposit or return line',
  rowLabel = 'row',
  accessibilityPrefix = 'deposit or return',
}) {
  const update = (index, field, value) => onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  const changeQuantity = (index, row, delta) => {
    const next = Math.max(minimumQuantity, (Number(row.quantity) || 0) + delta);
    update(index, 'quantity', String(Number(next.toFixed(2))));
  };
  return <View style={styles.section}>
    <Text style={styles.title}>{sectionTitle}</Text>
    {!!helperText && <Text style={styles.help}>{helperText}</Text>}
    {rows.map((row, index) => <View key={index} style={styles.row}>
      <View style={styles.heading}>
        <Text accessibilityLabel={`Adjustment item ${index + 1}`} accessible style={styles.itemNumber}>{index + 1}</Text>
        <Pressable onPress={() => onChange(rows.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={rowLabel === 'Return line' ? `Remove return line ${index + 1}` : `Remove ${accessibilityPrefix} ${rowLabel} ${index + 1}`} style={styles.remove}>
          <MaterialIcons name="close" size={22} color={theme.colors.textLight} accessible={false} />
        </Pressable>
      </View>
      {showKindSelector && <View style={styles.kindSelector}>
        {[
          { value: 'deposit', label: 'Deposit' },
          { value: 'return', label: 'Return' },
        ].map(option => {
          const selected = (row.kind || 'return') === option.value;
          return <Pressable key={option.value} onPress={() => update(index, 'kind', option.value)} accessibilityRole="button" accessibilityLabel={`${option.label}, row ${index + 1}`} accessibilityState={{ selected }} style={[styles.kindOption, selected && styles.kindOptionSelected]}>
            <Text style={[styles.kindText, selected && styles.kindTextSelected]}>{option.label}</Text>
          </Pressable>;
        })}
      </View>}
      <Text style={styles.label}>What container or item?</Text>
      <TextInput value={row.type} onChangeText={value => update(index, 'type', value)} accessibilityLabel={rowLabel === 'Return line' ? `Return line ${index + 1} container or item` : `Container or item name, row ${index + 1}`} placeholder="e.g. Empty bottle crate" placeholderTextColor={theme.colors.placeholder} style={styles.input} />
      <View style={styles.fieldsRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Quantity (cases)</Text>
          <View style={styles.quantityRow}>
            <Pressable onPress={() => changeQuantity(index, row, -0.5)} disabled={Number(row.quantity) <= minimumQuantity} accessibilityRole="button" accessibilityLabel={rowLabel === 'Return line' ? `Decrease quantity for return line ${index + 1}` : `Remove half a case from deposit or return row ${index + 1}`} style={styles.quantityButton}><MaterialIcons name="remove" size={19} color={theme.colors.primary} accessible={false} /></Pressable>
            <TextInput value={String(row.quantity)} onChangeText={value => update(index, 'quantity', value)} keyboardType="decimal-pad" accessibilityLabel={`${row.kind === 'deposit' ? 'Deposited' : 'Returned'} cases, row ${index + 1}`} style={styles.quantityInput} />
            <Pressable onPress={() => changeQuantity(index, row, 0.5)} accessibilityRole="button" accessibilityLabel={rowLabel === 'Return line' ? `Increase quantity for return line ${index + 1}` : `Add half a case to deposit or return row ${index + 1}`} style={styles.quantityButton}><MaterialIcons name="add" size={19} color={theme.colors.primary} accessible={false} /></Pressable>
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{row.kind === 'deposit' ? 'Deposit per case' : 'Refund per case'}</Text>
          <PesoInput value={String(row.amountPerCase ?? row.refundPerCase ?? '')} onChangeText={value => update(index, 'amountPerCase', value)} keyboardType="decimal-pad" accessibilityLabel={rowLabel === 'Return line' ? `Return line ${index + 1} refund per case in pesos` : `${row.kind === 'deposit' ? 'Deposit' : 'Refund'} per case, row ${index + 1}`} placeholder="0" placeholderTextColor={theme.colors.placeholder} style={styles.amountInput} />
        </View>
      </View>
    </View>)}
    <Pressable disabled={rows.length >= 100} accessibilityRole="button" accessibilityLabel={addAccessibilityLabel} onPress={() => onChange([...rows, { kind: 'return', type: '', quantity: String(initialQuantity), amountPerCase: '' }])} style={styles.add}>
      <MaterialIcons name="add" size={20} color={theme.colors.primary} accessible={false} /><Text style={styles.addText}>{addButtonLabel}</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 12 }, title: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  help: { color: theme.colors.textLight, fontSize: 14, lineHeight: 22 },
  row: { borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 10, gap: 10 },
  itemNumber: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: theme.colors.primarySoft, color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindSelector: { flexDirection: 'row', alignSelf: 'flex-start', gap: 4, borderRadius: 999, backgroundColor: theme.colors.surfaceMuted, padding: 3 },
  kindOption: { minHeight: 38, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 18 },
  kindOptionSelected: { backgroundColor: theme.colors.primary },
  kindText: { color: theme.colors.textLight, fontSize: 14, fontWeight: '600' },
  kindTextSelected: { color: theme.colors.onPrimary },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '500' },
  input: { width: '100%', maxWidth: 440, minHeight: 46, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, color: theme.colors.text, fontSize: 16 },
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  fieldGroup: { flexGrow: 1, flexBasis: 145, gap: 6 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quantityButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: theme.colors.primarySoft },
  quantityInput: { width: 68, height: 42, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, textAlign: 'center', paddingHorizontal: 6, color: theme.colors.text, fontSize: 16 },
  amountInput: { width: '100%', maxWidth: 200, minHeight: 42, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, color: theme.colors.text, fontSize: 16 },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addText: { color: theme.colors.primary, fontSize: 16, fontWeight: '600' }, error: { color: theme.colors.danger, fontSize: 14 },
});
