import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { orderDeliveryStatus } from './orderLifecycle';
import theme from '../../styles/theme';
export function DeliveryBadge({ order }) {
  if (order.status === 'cancelled') return null;
  const delivered = orderDeliveryStatus(order) === 'delivered';
  return <View style={[styles.badge, { backgroundColor: delivered ? theme.colors.successSoft : theme.colors.surfaceMuted }]}>
    <MaterialIcons name={delivered ? 'local-shipping' : 'schedule'} size={16} color={delivered ? theme.colors.success : theme.colors.textLight} accessible={false} />
    <Text style={[styles.label, { color: delivered ? theme.colors.success : theme.colors.textLight }]}>{delivered ? 'Delivered' : 'Not delivered'}</Text>
  </View>;
}
const styles = StyleSheet.create({ badge: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7 }, label: { fontSize: 14, fontWeight: '600' } });
