export const caseLineAmount = (quantity, price) => Math.round(Number(quantity) * Math.round(Number(price) * 100)) / 100;
export function containerAmount(entry) {
  if (entry.amountTotal != null) return Number(entry.amountTotal);
  if (entry.amountPerCase != null) return caseLineAmount(entry.quantity, entry.amountPerCase);
  return entry.refundTotal ?? caseLineAmount(entry.quantity, entry.refundPerCase);
}
export const refundAmount = containerAmount;

export function prepareContainerReturns(rows, subtotal, settled = 0) {
  if (rows.length > 100) return { error: 'Use no more than 100 deposit or return types.' };
  const entries = [];
  for (const row of rows) {
    const type = String(row.type ?? '').trim();
    const quantity = String(row.quantity ?? '');
    const rate = String(row.amountPerCase ?? row.refundPerCase ?? '');
    const kind = row.kind === 'deposit' ? 'deposit' : 'return';
    if (!type || type.length > 500) return { error: 'Enter a name for every deposit or return.' };
    if (!/^\d+(\.\d{1,2})?$/.test(quantity) || Number(quantity) <= 0 || Number(quantity) > 99999999.5 || !Number.isInteger(Number(quantity) * 2)) {
      return { error: 'Returned quantities must use half-case steps, starting at 0.5 case.' };
    }
    if (!/^\d+(\.\d{1,2})?$/.test(rate) || Number(rate) > 9999999999.99) return { error: 'Enter an amount per case with up to two decimal places.' };
    entries.push({ ...(row.returnTypeId ? { returnTypeId: row.returnTypeId } : {}), kind, type, quantity: Number(quantity), amountPerCase: Number(rate) });
  }
  const refund = entries.filter(entry => entry.kind === 'return').reduce((sum, entry) => sum + Math.round(containerAmount(entry) * 100), 0) / 100;
  const deposit = entries.filter(entry => entry.kind === 'deposit').reduce((sum, entry) => sum + Math.round(containerAmount(entry) * 100), 0) / 100;
  const total = Math.round((subtotal + deposit - refund) * 100) / 100;
  if (total < 0) return { error: 'Returns cannot exceed the product subtotal and deposits.' };
  if (Math.round(total * 100) < Math.round(settled * 100)) return { error: 'The new invoice total cannot be lower than payments and credit already applied.' };
  return { entries, refund, deposit, total };
}
