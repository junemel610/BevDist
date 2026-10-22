import { orderDeliveryStatus, orderLifecycleStatus } from '../orders/orderLifecycle.js';

export function invoiceSummary(order, balance) {
  const total = Math.max(0, Number(order.grandTotal || 0));
  const received = balance ? Number(balance.amountPaid || 0) : Number(order.deposit || 0);
  const amountPaid = Math.min(total, Math.max(0, received));
  const totalDue = Math.max(0, Number(balance?.totalAmount ?? total));
  const remainingBalance = balance && Number.isFinite(Number(balance.remainingBalance))
    ? Math.max(0, Number(balance.remainingBalance))
    : order.status === 'cancelled' ? 0 : totalDue - amountPaid;
  const status = order.status === 'cancelled' ? 'cancelled'
    : balance?.carriedForwardToOrderId ? 'carried_forward'
      : remainingBalance === 0 ? 'paid' : received > 0 ? 'partial' : 'unpaid';
  const currentInvoicePaid = Math.min(total, Math.max(0, Number(balance?.currentInvoicePaid ?? amountPaid)));

  return {
    invoiceNumber: balance?.invoiceNumber || order.orderNumber?.replace(/^ORD-/, 'INV-'),
    amountPaid: currentInvoicePaid,
    totalDue,
    remainingBalance,
    status,
    deliveryStatus: orderDeliveryStatus(order),
    lifecycleStatus: orderLifecycleStatus(order, status),
  };
}

export function salesSummary(orders, balances, paymentTransactions) {
  const balancesByOrder = new Map();
  balances.forEach(balance => {
    const previous = balancesByOrder.get(balance.orderId);
    balancesByOrder.set(balance.orderId, {
      ...previous,
      ...balance,
      invoiceNumber: previous?.invoiceNumber || balance.invoiceNumber,
      amountPaid: (previous?.amountPaid || 0) + Number(balance.amountPaid || 0),
    });
  });

  const summary = orders.reduce((summary, order) => {
    const total = Math.max(0, Number(order.grandTotal || 0));
    const { amountPaid, remainingBalance, status } = invoiceSummary(order, balancesByOrder.get(order.id));
    if (status === 'cancelled') return summary;
    summary.expected += total;
    summary.outstanding += remainingBalance;
    if (status === 'paid') summary.fullyPaid += 1;
    else if (status === 'partial' || status === 'unpaid') summary.outstandingInvoices += 1;
    if (orderLifecycleStatus(order, status) === 'completed') summary.completedOrders += 1;
    return summary;
  }, { expected: 0, actual: 0, outstanding: 0, outstandingInvoices: 0, fullyPaid: 0, completedOrders: 0 });
  if (Array.isArray(paymentTransactions)) {
    summary.actual = paymentTransactions.reduce((sum, payment) => (
      payment.method === 'Cash' ? sum + Math.max(0, Number(payment.amountApplied) || 0) : sum
    ), 0);
  } else {
    summary.actual = orders.reduce((sum, order) => {
      if (order.status === 'cancelled') return sum;
      const balance = balancesByOrder.get(order.id);
      return sum + Math.min(Math.max(0, Number(order.grandTotal) || 0), Math.max(0, Number(balance?.amountPaid) || 0));
    }, 0);
  }
  return summary;
}
