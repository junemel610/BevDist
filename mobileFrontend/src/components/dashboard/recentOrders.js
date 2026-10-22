export function recentOrders(orders, limit = 5) {
  return orders.map((order, index) => ({ order, index }))
    .sort((a, b) => b.order.date.localeCompare(a.order.date) || b.index - a.index)
    .slice(0, limit)
    .map(item => item.order);
}
