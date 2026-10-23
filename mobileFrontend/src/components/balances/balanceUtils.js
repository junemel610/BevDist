export function balanceStatus(balance, today = new Date().toISOString().slice(0, 10)) {
  if (balance.status === 'cancelled') return 'cancelled';
  if (Number(balance.remainingBalance) <= 0) return 'paid';
  return balance.dueDate < today ? 'overdue' : 'unpaid';
}

export function paymentBreakdown(balance, amount) {
  const payment = Number(amount);
  if (!Number.isFinite(payment) || payment <= 0) return { valid: false, applied: 0, excess: 0 };
  const applied = Math.min(payment, Math.max(0, Number(balance.remainingBalance) || 0));
  const excess = Math.max(0, payment - applied);
  return {
    valid: applied > 0,
    applied: Math.round((applied + Number.EPSILON) * 100) / 100,
    excess: Math.round((excess + Number.EPSILON) * 100) / 100,
  };
}

export function customerCreditKey(customer) {
  if (customer && typeof customer === 'object' && customer.id) return `customer:${customer.id}`;
  const name = customer && typeof customer === 'object' ? customer.name : customer;
  return String(name ?? '').trim().toLocaleLowerCase();
}

export function creditAppliedToInvoice(credit, invoiceTotal) {
  return Math.min(Math.max(0, Number(credit) || 0), Math.max(0, Number(invoiceTotal) || 0));
}

export function customerCreditRows(customerCredits, customers) {
  return Object.entries(customerCredits).map(([key, amount]) => {
    const customer = customers.find(row => customerCreditKey(row) === key);
    return { key, customerId: customer?.id, name: customer?.name || 'Customer profile unavailable', amount: Number(amount) || 0 };
  }).filter(row => row.amount > 0).sort((a, b) => a.name.localeCompare(b.name));
}
