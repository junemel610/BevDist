export function orderDeliveryStatus(order) {
  if (order.deliveryStatus) return order.deliveryStatus;
  return order.status === 'completed' ? 'delivered' : 'pending';
}

export function orderLifecycleStatus(order, paymentStatus) {
  if (order.status === 'cancelled') return 'cancelled';
  if (orderDeliveryStatus(order) === 'delivered' && paymentStatus === 'paid') return 'completed';
  return 'pending';
}

export function canMarkDelivered(order) {
  return order.status !== 'cancelled' && orderDeliveryStatus(order) !== 'delivered';
}
