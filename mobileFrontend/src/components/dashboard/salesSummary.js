import { orderDeliveryStatus, orderLifecycleStatus } from '../orders/orderLifecycle.js';

export function invoiceSummary(order, balance) {
  const total = Math.max(0, Number(order.grandTotal || 0));
  const received = balance ? Number(balance.amountPaid || 0) : Number(order.deposit || 0);
  const amountPaid = Math.min(total, Math.max(0, received));
  const status = order.status === 'cancelled'
    ? 'cancelled'
    : total > 0 && amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

  return {
    invoiceNumber: balance?.invoiceNumber || order.orderNumber?.replace(/^ORD-/, 'INV-'),
    amountPaid,
    remainingBalance: status === 'cancelled' ? 0 : total - amountPaid,
    status,
    deliveryStatus: orderDeliveryStatus(order),
    lifecycleStatus: orderLifecycleStatus(order, status),
  };
}

export function salesSummary(orders, balances) {
  const balancesByOrder = new Map();
  balances.forEach(balance => {
    const previous = balancesByOrder.get(balance.orderId);
    balancesByOrder.set(balance.orderId, {
      invoiceNumber: previous?.invoiceNumber || balance.invoiceNumber,
      amountPaid: (previous?.amountPaid || 0) + Number(balance.amountPaid || 0),
    });
  });

  return orders.reduce((summary, order) => {
    const total = Math.max(0, Number(order.grandTotal || 0));
    const { amountPaid, status } = invoiceSummary(order, balancesByOrder.get(order.id));
    if (status === 'cancelled') return summary;
    summary.expected += total;
    summary.actual += amountPaid;
    summary.outstanding += total - amountPaid;
    if (status === 'paid') summary.fullyPaid += 1;
    else if (status === 'partial' || status === 'unpaid') summary.outstandingInvoices += 1;
    if (orderLifecycleStatus(order, status) === 'completed') summary.completedOrders += 1;
    return summary;
  }, { expected: 0, actual: 0, outstanding: 0, outstandingInvoices: 0, fullyPaid: 0, completedOrders: 0 });
}
