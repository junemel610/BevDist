export const RETURNED_CASE_TYPES = [
  { type: 'Case Type A' },
  { type: 'Case Type B' },
  { type: 'Case Type C' },
  { type: 'Case Type D' },
];

const roundMoney = amount => Math.round((amount + Number.EPSILON) * 100) / 100;

export function supplierOrderTotals(items, adjustments) {
  const productCost = roundMoney(items.reduce((sum, item) => (
    item.quantity > 0 && item.unitCost > 0 ? sum + item.quantity * item.unitCost : sum
  ), 0));
  const returnCredit = roundMoney(adjustments.reduce((sum, item) => (
    item.kind !== 'deposit' && item.quantity > 0 && (item.creditPerUnit ?? item.amountPerCase) > 0 ? sum + item.quantity * (item.creditPerUnit ?? item.amountPerCase) : sum
  ), 0));
  const depositTotal = roundMoney(adjustments.reduce((sum, item) => (
    item.kind === 'deposit' && item.quantity > 0 && (item.creditPerUnit ?? item.amountPerCase) > 0 ? sum + item.quantity * (item.creditPerUnit ?? item.amountPerCase) : sum
  ), 0));
  return { productCost, returnCredit, depositTotal, netCost: roundMoney(Math.max(0, productCost + depositTotal - returnCredit)) };
}

export const hasValidSupplierOrderItems = items => items.length > 0 && items.every(item => (
  typeof item.packId === 'string' && item.packId.length > 0
    && Number.isFinite(item.quantity) && Number.isInteger(item.quantity * 2) && item.quantity > 0
    && Number.isFinite(item.unitCost) && item.unitCost > 0
));
