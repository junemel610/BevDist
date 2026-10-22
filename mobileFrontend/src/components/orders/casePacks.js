export const CASE_PACKS = [
  { id: 'A', label: 'A · 12 bottles', unitsPerCase: 12 },
  { id: 'B', label: 'B · 24 bottles', unitsPerCase: 24 },
  { id: 'C', label: 'C · 6 bottles', unitsPerCase: 6 },
  { id: 'MUCHO_6', label: 'Mucho Red Horse · 6', unitsPerCase: 6 },
  { id: 'MUCHO_12', label: 'Mucho Red Horse · 12', unitsPerCase: 12 },
];

export function isValidCaseQuantity(quantity) {
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0 && Number.isInteger(value * 2);
}

export function invoiceCaseItem(product, pack, caseQuantity) {
  const quantity = Number(caseQuantity);
  if (!product || !pack || !isValidCaseQuantity(quantity)) return null;
  const unitPrice = Number(product.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  const stockQuantity = quantity * pack.unitsPerCase;
  const casePrice = unitPrice * pack.unitsPerCase;
  return {
    productId: product.id,
    productName: product.name,
    packId: pack.id,
    packLabel: pack.label,
    unitsPerCase: pack.unitsPerCase,
    quantity,
    stockQuantity,
    unitPrice: casePrice,
    bottleUnitPrice: unitPrice,
  };
}

export function availableCases(availableUnits, pack) {
  if (!pack?.unitsPerCase || availableUnits <= 0) return 0;
  return Math.floor((availableUnits / pack.unitsPerCase) * 2) / 2;
}

export function caseAvailabilityLabel(productName, availableUnits) {
  const packs = String(productName).toLowerCase().includes('mucho')
    ? CASE_PACKS.filter(pack => pack.id.startsWith('MUCHO'))
    : CASE_PACKS.filter(pack => !pack.id.startsWith('MUCHO'));
  return packs.map(pack => `${pack.id}: ${availableCases(availableUnits, pack)} cases`).join(' · ');
}
