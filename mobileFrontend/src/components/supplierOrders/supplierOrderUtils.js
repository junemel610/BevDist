export const RETURNED_CASE_TYPES = [
  { type: 'Case Type A', creditPerUnit: 15 },
  { type: 'Case Type B', creditPerUnit: 20 },
  { type: 'Case Type C', creditPerUnit: 18 },
  { type: 'Case Type D', creditPerUnit: 12 },
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

export const hasValidSupplierOrderItems = items => items.some(item => (
  Number.isFinite(item.quantity) && Number.isInteger(item.quantity * 2) && item.quantity > 0
    && Number.isFinite(item.unitCost) && item.unitCost > 0
));
