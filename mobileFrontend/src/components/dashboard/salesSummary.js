export function salesSummary(orders, balances) {
  const paymentsByOrder = new Map();
  balances.forEach(balance => {
    paymentsByOrder.set(balance.orderId, (paymentsByOrder.get(balance.orderId) || 0) + Number(balance.amountPaid || 0));
  });

  return orders.reduce((summary, order) => {
    if (order.status === 'cancelled') return summary;

    const total = Math.max(0, Number(order.grandTotal || 0));
    const payment = paymentsByOrder.has(order.id) ? paymentsByOrder.get(order.id) : Number(order.deposit || 0);
    const applied = Math.min(total, Math.max(0, payment));
    summary.expected += total;
    summary.actual += applied;
    summary.outstanding += total - applied;
    if (total > 0 && applied >= total) summary.fullyPaid += 1;
    return summary;
  }, { expected: 0, actual: 0, outstanding: 0, fullyPaid: 0 });
}
