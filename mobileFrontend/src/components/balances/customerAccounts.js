function customerKey(balance) {
  return balance.customerId
    ? `customer:${balance.customerId}`
    : `name:${String(balance.customerName || '').trim().toLocaleLowerCase()}`;
}

function invoiceDate(balance, ordersById) {
  return ordersById.get(balance.orderId)?.date || balance.dueDate || '';
}

function compareInvoiceAge(left, right, ordersById) {
  return invoiceDate(left, ordersById).localeCompare(invoiceDate(right, ordersById))
    || String(left.invoiceNumber).localeCompare(String(right.invoiceNumber));
}

export function groupOpenCustomerBalances(balances, orders = []) {
  const ordersById = new Map(orders.map(order => [order.id, order]));
  const accounts = new Map();
  balances.forEach(balance => {
    const remaining = Math.max(0, Number(balance.remainingBalance) || 0);
    if (balance.status === 'cancelled' || remaining <= 0) return;
    const key = customerKey(balance);
    const account = accounts.get(key) || {
      key,
      customerId: balance.customerId || null,
      id: balance.customerId || null,
      name: balance.customerName,
      customerName: balance.customerName,
      balances: [],
      outstanding: 0,
    };
    account.balances.push(balance);
    account.outstanding += remaining;
    accounts.set(key, account);
  });

  return [...accounts.values()]
    .map(account => ({
      ...account,
      balances: account.balances.slice().sort((a, b) => compareInvoiceAge(a, b, ordersById)),
    }))
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export function allocateAccountPayment(balances, orders, amount) {
  const payment = Number(amount);
  if (!Number.isFinite(payment) || payment <= 0) return { valid: false, applied: 0, excess: 0, allocations: [] };
  const ordersById = new Map(orders.map(order => [order.id, order]));
  const openBalances = balances
    .filter(balance => balance.status !== 'cancelled'
      && Number(balance.remainingBalance) > 0)
    .slice()
    .sort((a, b) => compareInvoiceAge(a, b, ordersById));
  const totalDue = openBalances.reduce((sum, balance) => sum + Number(balance.remainingBalance), 0);
  if (!totalDue) return { valid: false, applied: 0, excess: 0, allocations: [] };

  let amountLeft = payment;
  const allocations = [];
  for (const balance of openBalances) {
    if (amountLeft <= 0) break;
    const applied = Math.min(amountLeft, Number(balance.remainingBalance));
    if (applied > 0) allocations.push({ balanceId: balance.id, invoiceNumber: balance.invoiceNumber, amount: applied });
    amountLeft -= applied;
  }
  const applied = Math.min(payment, totalDue);
  return {
    valid: applied > 0,
    applied,
    excess: Math.max(0, payment - totalDue),
    allocations,
  };
}
