import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { customerCreditRows } from '../components/balances/balanceUtils';
import theme from '../styles/theme';

const peso = amount => `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
export function CustomerCreditsScreen() {
  const { customerCredits, customers } = useApp();
  const [search, setSearch] = useState('');
  const rows = useMemo(() => customerCreditRows(customerCredits, customers), [customerCredits, customers]);
  const visible = rows.filter(row => row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
    <FlatList data={visible} keyExtractor={row => row.key} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={styles.header}>
        <Text style={styles.total}>{peso(rows.reduce((sum, row) => sum + row.amount, 0))} available credit</Text>
        <Text style={styles.help}>Extra payments automatically apply to each customer’s next invoice.</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search customer" accessibilityLabel="Search customer credits" style={styles.search} />
      </View>}
      renderItem={({ item }) => <View style={styles.row}><Text style={styles.name}>{item.name}</Text><Text style={styles.amount}>{peso(item.amount)}</Text></View>}
      ListEmptyComponent={<Text style={styles.help}>{search ? 'No matching customers.' : 'No customer credit available.'}</Text>}
    />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background }, list: { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center', padding: theme.spacing.lg }, header: { gap: 12, marginBottom: 16 },
  total: { color: theme.colors.primary, fontSize: 22, fontWeight: '600' }, help: { color: theme.colors.textLight, fontSize: 15, lineHeight: 22 },
  search: { minHeight: 50, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, borderRadius: 10, fontSize: 16, color: theme.colors.text, backgroundColor: theme.colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20, borderBottomWidth: 1, borderColor: theme.colors.border },
  name: { flex: 1, color: theme.colors.text, fontSize: 16 }, amount: { color: theme.colors.primary, fontSize: 18, fontWeight: '600' },
});
