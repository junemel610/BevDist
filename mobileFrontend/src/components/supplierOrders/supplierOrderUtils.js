export const RETURNED_CASE_TYPES = [
  { type: 'Case Type A' },
  { type: 'Case Type B' },
  { type: 'Case Type C' },
  { type: 'Case Type D' },
];

const roundMoney = amount => Math.round((amount + Number.EPSILON) * 100) / 100;

export function supplierOrderTotals(items, returnedCases) {
  const productCost = roundMoney(items.reduce((sum, item) => (
    item.quantity > 0 && item.unitCost > 0 ? sum + item.quantity * item.unitCost : sum
  ), 0));
  const returnCredit = roundMoney(returnedCases.reduce((sum, item) => (
    item.quantity > 0 && item.creditPerUnit > 0 ? sum + item.quantity * item.creditPerUnit : sum
  ), 0));
  return { productCost, returnCredit, netCost: roundMoney(Math.max(0, productCost - returnCredit)) };
}

export const hasValidSupplierOrderItems = items => items.length > 0 && items.every(item => (
  typeof item.packId === 'string' && item.packId.length > 0
    && Number.isFinite(item.quantity) && Number.isInteger(item.quantity * 2) && item.quantity > 0
    && Number.isFinite(item.unitCost) && item.unitCost > 0
));
