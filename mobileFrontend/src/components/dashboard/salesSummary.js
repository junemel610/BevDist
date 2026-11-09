import { businessDate } from '../../utils/businessDate.js';
import { orderDeliveryStatus, orderLifecycleStatus } from '../orders/orderLifecycle.js';

export function invoiceSummary(order, balance) {
  const invoiceTotal = Number(order.grandTotal ?? balance?.totalAmount ?? 0);
  const paidTotal = Number(balance?.amountPaid ?? 0);
  const total = Number.isFinite(invoiceTotal) ? Math.max(0, invoiceTotal) : 0;
  const received = Number.isFinite(paidTotal) ? Math.max(0, paidTotal) : 0;
  const amountPaid = Math.min(total, Math.max(0, received));
  const remainingBalance = order.status === 'cancelled' ? 0
    : balance && Number.isFinite(Number(balance.remainingBalance))
      ? Math.min(total, Math.max(0, Number(balance.remainingBalance)))
      : total - amountPaid;
  const status = order.status === 'cancelled' ? 'cancelled'
    : remainingBalance === 0 ? 'paid' : received > 0 ? 'partial' : 'unpaid';

  return {
    invoiceNumber: balance?.invoiceNumber || order.invoiceNumber || order.orderNumber?.replace(/^ORD-/, 'INV-'),
    amountPaid,
    totalDue: total,
    remainingBalance,
    status,
    deliveryStatus: orderDeliveryStatus(order),
    lifecycleStatus: orderLifecycleStatus(order, status),
  };
}

export function salesSummary(orders, balances, paymentTransactions) {
  const balancesByOrder = new Map(balances.map(balance => [balance.orderId, balance]));

  const summary = orders.reduce((summary, order) => {
    const { totalDue, remainingBalance, status } = invoiceSummary(order, balancesByOrder.get(order.id));
    if (status === 'cancelled') return summary;
    summary.expected += totalDue;
    summary.outstanding += remainingBalance;
    if (status === 'paid') summary.fullyPaid += 1;
    else if (status === 'partial' || status === 'unpaid') summary.outstandingInvoices += 1;
    if (orderLifecycleStatus(order, status) === 'completed') summary.completedOrders += 1;
    return summary;
  }, { expected: 0, actual: 0, outstanding: 0, outstandingInvoices: 0, fullyPaid: 0, completedOrders: 0 });
  if (Array.isArray(paymentTransactions)) {
    const ordersById = new Map(orders.map(order => [order.id, order]));
    const balancesById = new Map(balances.map(balance => [balance.id, balance]));
    summary.actual = paymentTransactions.reduce((sum, payment) => {
      const order = ordersById.get(payment.orderId);
      const balance = balancesById.get(payment.balanceId);
      const amount = Number(payment.amountApplied);
      return payment.method === 'Cash' && order && order.status !== 'cancelled'
        && balance?.orderId === order.id && balance.status !== 'cancelled' && Number.isFinite(amount)
        ? sum + Math.max(0, amount) : sum;
    }, 0);
  } else {
    summary.actual = orders.reduce((sum, order) => {
      if (order.status === 'cancelled') return sum;
      const balance = balancesByOrder.get(order.id);
      return sum + Math.min(Math.max(0, Number(order.grandTotal) || 0), Math.max(0, Number(balance?.amountPaid) || 0));
    }, 0);
  }
  return summary;
}

export function dailySalesSummary(orders, balances, paymentTransactions, today = businessDate()) {
  const balancesByOrder = new Map(balances.map(balance => [balance.orderId, balance]));
  const expected = orders.reduce((sum, order) => {
    if (order.date !== today || order.status === 'cancelled') return sum;
    const balance = balancesByOrder.get(order.id);
    if (balance?.status === 'cancelled') return sum;
    return sum + invoiceSummary(order, balance).totalDue;
  }, 0);
  return {
    expected,
    actual: dailyAppliedPayments(orders, balances, paymentTransactions, today).Cash,
  };
}

export function salesTrends(orders, balances, paymentTransactions, today = new Date()) {
  const todayKey = today instanceof Date ? businessDate(today) : today;
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  const ordersById = new Map(orders.map(order => [order.id, order]));
  const balancesById = new Map(balances.map(balance => [balance.id, balance]));
  const cashByDate = new Map();
  paymentTransactions.forEach(payment => {
    const order = ordersById.get(payment.orderId);
    const balance = balancesById.get(payment.balanceId);
    const amount = Number(payment.amountApplied);
    if (payment.method !== 'Cash' || !order || order.status === 'cancelled' || balance?.orderId !== order.id || balance.status === 'cancelled'
      || !/^\d{4}-\d{2}-\d{2}$/.test(payment.date) || !Number.isFinite(amount) || amount <= 0) return;
    cashByDate.set(payment.date, (cashByDate.get(payment.date) || 0) + amount);
  });

  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${todayKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 6 + index);
    const key = date.toISOString().slice(0, 10);
    return { label: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date), value: cashByDate.get(key) || 0 };
  });
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 5 + index, 1));
    return { key: month.toISOString().slice(0, 7), label: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(month) };
  });
  const monthly = monthKeys.map(month => ({
    label: month.label,
    value: [...cashByDate].reduce((sum, [date, amount]) => sum + (date.startsWith(month.key) ? amount : 0), 0),
  }));
  return { daily, monthly };
}

export function dailyAppliedPayments(orders, balances, payments, today = businessDate()) {
  const cents = { Cash: 0, GCash: 0, 'Bank Transfer': 0 };
  const orderById = new Map(orders.map(order => [order.id, order]));
  const balanceById = new Map(balances.map(balance => [balance.id, balance]));
  for (const payment of payments) {
    const order = orderById.get(payment.orderId);
    const balance = balanceById.get(payment.balanceId);
    const amount = Number(payment.amountApplied);
    if (payment.date === today && Object.hasOwn(cents, payment.method) && order && order.status !== 'cancelled'
      && balance?.orderId === order.id && balance.status !== 'cancelled' && Number.isFinite(amount) && amount > 0) {
      cents[payment.method] += Math.round(amount * 100);
    }
  }
  return Object.fromEntries(Object.entries(cents).map(([method, amount]) => [method, amount / 100]));
}
