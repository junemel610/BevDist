import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import theme from '../styles/theme';
import { confirmAction } from '../utils/confirmAction';

const blankProfile = { name: '', contact: '', address: '' };
const formatPeso = amount => `₱${Number(amount ?? 0).toLocaleString('en-PH')}`;

export function CustomerProfilesScreen() {
  const { customers, balances, saveCustomer } = useApp();
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(blankProfile);
  const [error, setError] = useState('');
  const customerRows = useMemo(() => customers.map(customer => {
    const customerBalances = balances.filter(balance => (
      balance.customerId === customer.id || (!balance.customerId && balance.customerName === customer.name)
    ));
    return {
      ...customer,
      invoiceCount: customerBalances.length,
      outstanding: customerBalances.reduce((sum, balance) => sum + (Number(balance.remainingBalance) || 0), 0),
    };
  }), [customers, balances]);

  const openEditor = customer => {
    setDraft(customer ? { ...customer } : blankProfile);
    setEditor(customer || { id: null });
    setError('');
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Enter a customer name.');
      return;
    }
    const duplicate = customers.find(customer => customer.id !== editor?.id
      && customer.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    if (duplicate) {
      setError(`${duplicate.name} already exists. Edit that customer profile instead.`);
      return;
    }
    confirmAction({
      title: editor?.id ? 'Save customer changes?' : 'Add this customer?',
      message: `Customer profile: ${draft.name.trim()}.`,
      confirmLabel: editor?.id ? 'Save changes' : 'Add customer',
      onConfirm: async () => {
        const saved = await saveCustomer(draft);
        if (!saved) {
          setError('Enter a customer name.');
          return;
        }
        setEditor(null);
      },
    });
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <FlatList
        data={customerRows}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={(
          <View style={[styles.header, styles.pageHeadingBand]}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.title}>Customer profiles</Text>
              <Text style={styles.subtitle}>{customers.length} saved customers</Text>
            </View>
            <Pressable onPress={() => openEditor(null)} accessibilityRole="button" style={({ pressed }) => [styles.addButton, styles.headerActionButton, pressed && styles.pressed]}>
              <MaterialIcons name="person-add" size={19} color={theme.colors.primary} accessible={false} />
              <Text style={[styles.addButtonText, styles.headerActionText]}>Add customer</Text>
            </Pressable>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.customerIdentity}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.detail}>{item.contact || 'No contact number'}</Text>
                {!!item.address && <Text style={styles.detail}>{item.address}</Text>}
              </View>
              <Pressable onPress={() => openEditor(item)} accessibilityRole="button" accessibilityLabel={`Edit ${item.name} profile`} style={styles.editButton}>
                <MaterialIcons name="edit" size={18} color={theme.colors.primary} accessible={false} />
              </Pressable>
            </View>
            <View style={styles.accountSummary}>
              <Text style={styles.detail}>{item.invoiceCount} {item.invoiceCount === 1 ? 'invoice' : 'invoices'}</Text>
              <Text style={styles.balance}>{formatPeso(item.outstanding)} outstanding</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Add a customer profile to use it on invoices.</Text>}
      />

      <Modal visible={Boolean(editor)} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <View style={styles.scrim}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{editor?.id ? 'Edit customer' : 'Add customer'}</Text>
              <Pressable onPress={() => setEditor(null)} accessibilityRole="button" accessibilityLabel="Close customer editor" style={styles.closeButton}>
                <MaterialIcons name="close" size={21} color={theme.colors.textLight} accessible={false} />
              </Pressable>
            </View>
            <View style={styles.sectionDivider} />
            <TextInput value={draft.name} onChangeText={name => { setDraft(current => ({ ...current, name })); setError(''); }} placeholder="Customer name" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Customer name, required" style={styles.input} />
            <TextInput value={draft.contact || ''} onChangeText={contact => setDraft(current => ({ ...current, contact }))} placeholder="Contact number" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Customer contact number" keyboardType="phone-pad" style={styles.input} />
            <TextInput value={draft.address || ''} onChangeText={address => setDraft(current => ({ ...current, address }))} placeholder="Address" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Customer address" style={styles.input} />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.sectionDivider} />
            <Pressable onPress={save} accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
              <Text style={styles.saveText}>Save profile</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  list: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg, gap: theme.spacing.md, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  headerCopy: { flex: 1 },
  pageHeadingBand: { marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.onPrimary, fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold },
  subtitle: { color: theme.colors.onPrimary, opacity: 0.82, fontSize: theme.fontSize.sm, marginTop: 4 },
  headerActionButton: { backgroundColor: theme.colors.surface },
  headerActionText: { color: theme.colors.primary },
  addButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing.md, borderRadius: 9, backgroundColor: theme.colors.primary },
  addButtonText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  card: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface, gap: theme.spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md },
  customerIdentity: { flex: 1, gap: 3 },
  name: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold },
  detail: { color: theme.colors.textLight, fontSize: theme.fontSize.sm, lineHeight: 20 },
  editButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: theme.colors.primarySoft },
  accountSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm },
  balance: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  separator: { height: theme.spacing.sm },
  empty: { padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight },
  scrim: { flex: 1, justifyContent: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.overlay },
  dialog: { gap: theme.spacing.md, padding: theme.spacing.lg, borderRadius: 14, backgroundColor: theme.colors.surface },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  dialogTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 52, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, color: theme.colors.text, fontSize: theme.fontSize.base },
  error: { color: theme.colors.danger, fontSize: theme.fontSize.sm },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: theme.colors.primary },
  saveText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
