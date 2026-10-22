function matchesCustomer(balance, customer) {
  if (customer.id && balance.customerId) return balance.customerId === customer.id;
  return String(balance.customerName || '').trim().toLocaleLowerCase()
    === String(customer.name || '').trim().toLocaleLowerCase();
}

export function carryForwardBalances(balances, customer) {
  const items = balances
    .filter(balance => !balance.carriedForwardToOrderId && balance.status !== 'cancelled'
      && matchesCustomer(balance, customer) && Number(balance.remainingBalance) > 0)
    .map(balance => ({ balanceId: balance.id, amount: Number(balance.remainingBalance) }));
  return { items, amount: items.reduce((sum, item) => sum + item.amount, 0) };
}

export function forwardBalanceRecords(balances, items, orderId) {
  const forwarded = new Set(items.map(item => item.balanceId));
  return balances.map(balance => forwarded.has(balance.id)
    ? { ...balance, remainingBalance: 0, status: 'carried_forward', carriedForwardToOrderId: orderId }
    : balance);
}

export function allocatePayment(balance, appliedAmount) {
  const oldCarryPaid = Number(balance.carriedForwardPaid) || 0;
  const carryDue = Math.max(0, (Number(balance.carriedForwardAmount) || 0) - oldCarryPaid);
  const appliedToCarry = Math.min(carryDue, appliedAmount);
  return {
    carriedForwardPaid: oldCarryPaid + appliedToCarry,
    currentInvoicePaid: (Number(balance.currentInvoicePaid ?? balance.amountPaid) || 0) + appliedAmount - appliedToCarry,
  };
}
