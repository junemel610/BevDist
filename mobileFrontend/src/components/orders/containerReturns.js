export const caseLineAmount = (quantity, price) => Math.round(Number(quantity) * Math.round(Number(price) * 100)) / 100;
export const refundAmount = entry => entry.refundTotal ?? caseLineAmount(entry.quantity, entry.refundPerCase);

export function prepareContainerReturns(rows, subtotal, settled = 0) {
  if (rows.length > 100) return { error: 'Use no more than 100 returned case types.' };
  const entries = [];
  for (const row of rows) {
    const type = String(row.type ?? '').trim();
    const quantity = String(row.quantity ?? '');
    const rate = String(row.refundPerCase ?? '');
    if (!type || type.length > 500) return { error: 'Enter a return type for every row.' };
    if (!/^\d+(\.\d{1,2})?$/.test(quantity) || Number(quantity) <= 0 || Number(quantity) > 99999999.5 || !Number.isInteger(Number(quantity) * 2)) {
      return { error: 'Returned quantities must use half-case steps, starting at 0.5 case.' };
    }
    if (!/^\d+(\.\d{1,2})?$/.test(rate) || Number(rate) > 9999999999.99) return { error: 'Enter a refund per case with up to two decimal places.' };
    entries.push({ ...(row.returnTypeId ? { returnTypeId: row.returnTypeId } : {}), type, quantity: Number(quantity), refundPerCase: Number(rate) });
  }
  const refund = entries.reduce((sum, entry) => sum + Math.round(refundAmount(entry) * 100), 0) / 100;
  const total = Math.round((subtotal - refund) * 100) / 100;
  if (total < 0) return { error: 'Container refunds cannot exceed the product subtotal.' };
  if (Math.round(total * 100) < Math.round(settled * 100)) return { error: 'The new invoice total cannot be lower than payments and credit already applied.' };
  return { entries, refund, total };
}
