import React, { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { PaginationControls, PAGE_SIZE } from '../components/ui/PaginationControls';
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
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
  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return customerRows.filter(customer => !query || [customer.name, customer.contact, customer.address].some(value => value?.toLocaleLowerCase().includes(query)));
  }, [customerRows, search]);
  const pageCount = Math.max(1, Math.ceil(visibleCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedCustomers = visibleCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const changeSearch = value => { setSearch(value); setPage(1); };

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
        data={pagedCustomers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={(
          <>
            <View style={[styles.header, styles.pageHeadingBand]}>
              <View style={styles.headerCopy}>
                <Text accessibilityRole="header" style={styles.title}>View customers</Text>
                <Text style={styles.subtitle}>{visibleCustomers.length} of {customers.length} saved customers</Text>
              </View>
              <Pressable onPress={() => openEditor(null)} accessibilityRole="button" style={({ pressed }) => [styles.addButton, styles.headerActionButton, pressed && styles.pressed]}>
                <MaterialIcons name="person-add" size={19} color={theme.colors.primary} accessible={false} />
                <Text style={[styles.addButtonText, styles.headerActionText]}>Add customer</Text>
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={theme.colors.textLight} accessible={false} />
              <TextInput value={search} onChangeText={changeSearch} placeholder="Search customers" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Search customers by name, contact, or address" returnKeyType="search" style={styles.searchInput} />
              {search ? <Pressable onPress={() => changeSearch('')} accessibilityRole="button" accessibilityLabel="Clear customer search" style={styles.clearSearch}><MaterialIcons name="close" size={19} color={theme.colors.textLight} accessible={false} /></Pressable> : null}
            </View>
          </>
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
        ListEmptyComponent={<Text style={styles.empty}>{search ? 'No customers match your search.' : 'Add a customer profile to use it on invoices.'}</Text>}
        ListFooterComponent={<PaginationControls page={currentPage} totalItems={visibleCustomers.length} onPageChange={setPage} />}
      />

      <Modal visible={Boolean(editor)} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.scrim}>
          <ScrollView contentContainerStyle={styles.dialogScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <View style={styles.dialogHeadingCopy}>
                  <Text style={styles.dialogEyebrow}>CUSTOMER PROFILE</Text>
                  <Text accessibilityRole="header" style={styles.dialogTitle}>{editor?.id ? 'Edit customer' : 'Add customer'}</Text>
                  <Text style={styles.dialogSubtitle}>Keep contact details ready for invoices.</Text>
                </View>
                <Pressable onPress={() => setEditor(null)} accessibilityRole="button" accessibilityLabel="Close customer editor" style={styles.closeButton}>
                  <MaterialIcons name="close" size={21} color={theme.colors.onPrimary} accessible={false} />
                </Pressable>
              </View>
              <View style={styles.formBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Customer name <Text style={styles.required}>Required</Text></Text>
                  <TextInput value={draft.name} onChangeText={name => { setDraft(current => ({ ...current, name })); setError(''); }} placeholder="Full name or business" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Customer name, required" autoCapitalize="words" returnKeyType="next" style={styles.input} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Contact number <Text style={styles.optional}>Optional</Text></Text>
                  <TextInput value={draft.contact || ''} onChangeText={contact => setDraft(current => ({ ...current, contact }))} placeholder="09xx xxx xxxx" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Customer contact number" keyboardType="phone-pad" style={styles.input} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Address <Text style={styles.optional}>Optional</Text></Text>
                  <TextInput value={draft.address || ''} onChangeText={address => setDraft(current => ({ ...current, address }))} placeholder="Street, barangay, city" placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Customer address" autoCapitalize="words" style={[styles.input, styles.addressInput]} multiline />
                </View>
                {error ? <View style={styles.errorBox}><MaterialIcons name="error-outline" size={18} color={theme.colors.danger} accessible={false} /><Text accessibilityRole="alert" style={styles.error}>{error}</Text></View> : null}
              </View>
              <View style={styles.dialogActions}>
                <Pressable onPress={() => setEditor(null)} accessibilityRole="button" style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={save} accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                  <MaterialIcons name="check" size={19} color={theme.colors.onPrimary} accessible={false} />
                  <Text style={styles.saveText}>{editor?.id ? 'Save changes' : 'Add customer'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  scrim: { flex: 1, justifyContent: 'center', backgroundColor: theme.colors.overlay },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.md },
  dialog: { width: '100%', maxWidth: 520, alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: theme.colors.surface, elevation: 8 },
  dialogHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md, padding: theme.spacing.lg, backgroundColor: theme.colors.primary },
  dialogHeadingCopy: { flex: 1, gap: 4 },
  dialogEyebrow: { color: theme.colors.onPrimary, opacity: 0.78, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, letterSpacing: 1 },
  dialogTitle: { color: theme.colors.onPrimary, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  dialogSubtitle: { color: theme.colors.onPrimary, opacity: 0.84, fontSize: theme.fontSize.sm, lineHeight: 20 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  formBody: { gap: theme.spacing.md, padding: theme.spacing.lg },
  fieldGroup: { gap: theme.spacing.xs },
  fieldLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  required: { color: theme.colors.danger, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
  optional: { color: theme.colors.textLight, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
  input: { minHeight: 50, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, color: theme.colors.text, backgroundColor: theme.colors.background, fontSize: theme.fontSize.base },
  addressInput: { minHeight: 74, paddingTop: theme.spacing.md, textAlignVertical: 'top' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, padding: theme.spacing.sm, borderRadius: 9, backgroundColor: theme.colors.dangerSoft },
  error: { flex: 1, color: theme.colors.danger, fontSize: theme.fontSize.sm },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
  cancelButton: { minHeight: 48, minWidth: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.surface },
  cancelText: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, minWidth: 150, paddingHorizontal: theme.spacing.md, borderRadius: 10, backgroundColor: theme.colors.primary },
  saveText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold },
  pressed: { opacity: 0.75 },
});
