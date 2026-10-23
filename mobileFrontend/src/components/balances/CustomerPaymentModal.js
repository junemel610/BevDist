import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { PAYMENT_METHOD } from '../../types';
import { allocateAccountPayment, groupOpenCustomerBalances } from './customerAccounts';
import { confirmAction } from '../../utils/confirmAction';
import theme from '../../styles/theme';

const peso = value => `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export function CustomerPaymentModal({ customerId, invoiceNumber, onClose, onSaved }) {
  const { balances, orders, recordCustomerPayment } = useApp();
  const [amount, setAmount] = useState('0');
  const [method, setMethod] = useState(PAYMENT_METHOD.CASH);
  const [error, setError] = useState('');
  const account = groupOpenCustomerBalances(balances, orders).find(row => row.customerId === customerId);
  if (!account) return null;
  const breakdown = allocateAccountPayment(account.balances, orders, amount);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && breakdown.valid;
  const save = () => {
    if (!valid) { setError('Enter an amount above ₱0, with up to two decimal places.'); return; }
    confirmAction({
      title: 'Record this payment?',
      message: `${peso(amount)} by ${method} for ${account.customerName}. Oldest invoices are paid first; extra payment becomes customer credit.`,
      confirmLabel: 'Record payment',
      onConfirm: async () => {
        const result = await recordCustomerPayment({ id: customerId }, Number(amount), method);
        onClose();
        onSaved?.(result.excess > 0 ? `${peso(result.applied)} applied · ${peso(result.excess)} saved as credit` : `${peso(result.applied)} payment recorded`);
      },
    });
  };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View style={styles.dialog}>
      <View style={styles.heading}><View style={styles.grow}>
        <Text style={styles.title}>Record payment</Text>
        <Text style={styles.help}>{invoiceNumber ? `Opened from ${invoiceNumber}` : account.customerName}</Text>
      </View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close payment form" style={styles.close}><MaterialIcons name="close" size={24} color={theme.colors.text} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text style={styles.customer}>{account.customerName}</Text>
        <Text style={styles.help}>Total outstanding: {peso(account.outstanding)}</Text>
        <Text style={styles.help}>Payment covers this customer’s oldest invoices first, including any older than the invoice you opened.</Text>
        <Text style={styles.label}>Payment method</Text>
        <View style={styles.methods}>{Object.values(PAYMENT_METHOD).map(option => <Pressable key={option} onPress={() => setMethod(option)} accessibilityRole="radio" accessibilityState={{ checked: method === option }} aria-checked={method === option} style={[styles.method, method === option && styles.selected]}>
          <MaterialIcons name={method === option ? 'radio-button-checked' : 'radio-button-unchecked'} size={18} color={theme.colors.primary} />
          <Text style={styles.copy}>{option}</Text>
        </Pressable>)}</View>
        <Text style={styles.label}>Payment received (₱)</Text>
        <TextInput value={amount} onChangeText={value => { setAmount(value); setError(''); }} selectTextOnFocus keyboardType="decimal-pad" accessibilityLabel="Payment received in pesos" style={styles.input} />
        <Text style={styles.label}>Invoices paid first</Text>
        {account.balances.map(balance => <View key={balance.id} style={styles.line}><Text style={styles.copy}>{balance.invoiceNumber}</Text><Text style={styles.copy}>{peso(balance.remainingBalance)} due</Text></View>)}
        {valid && <View style={styles.breakdown}><Text style={styles.label}>This payment will apply</Text>
          {breakdown.allocations.map(row => <View key={row.balanceId} style={styles.line}><Text style={styles.copy}>{row.invoiceNumber}</Text><Text style={styles.copy}>{peso(row.amount)}</Text></View>)}
          {breakdown.excess > 0 && <Text style={styles.copy}>Customer credit: {peso(breakdown.excess)}</Text>}
        </View>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </ScrollView>
      <Pressable onPress={save} accessibilityRole="button" style={styles.save}><Text style={styles.saveText}>Record payment</Text></Pressable>
    </View></KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: theme.colors.overlay },
  dialog: { width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', padding: 20, borderRadius: 16, backgroundColor: theme.colors.surface, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, grow: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text }, customer: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  help: { color: theme.colors.textLight, fontSize: 15, lineHeight: 22 }, body: { gap: 12 },
  label: { fontSize: 16, fontWeight: '600', color: theme.colors.text }, copy: { color: theme.colors.text, fontSize: 15, flexShrink: 1 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, method: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10 },
  selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  input: { minHeight: 54, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 20, color: theme.colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, breakdown: { padding: 12, gap: 10, backgroundColor: theme.colors.primarySoft, borderRadius: 10 },
  error: { color: theme.colors.danger, fontSize: 15 }, save: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: 10 },
  saveText: { color: theme.colors.onPrimary, fontSize: 16, fontWeight: '600' },
});
