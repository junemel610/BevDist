export const CASE_PACKS = [
  { id: 'A', label: 'A · 12 per case', unitsPerCase: 12 },
  { id: 'B', label: 'B · 24 per case', unitsPerCase: 24 },
  { id: 'C', label: 'C · 6 per case', unitsPerCase: 6 },
  { id: 'MUCHO_6', label: 'Mucho Red Horse · 6 per case', unitsPerCase: 6 },
  { id: 'MUCHO_12', label: 'Mucho Red Horse · 12 per case', unitsPerCase: 12 },
];

export function casePacksForProduct(product) {
  return String(product?.name).toLowerCase().includes('mucho')
    ? CASE_PACKS.filter(pack => pack.id.startsWith('MUCHO'))
    : CASE_PACKS.filter(pack => !pack.id.startsWith('MUCHO'));
}

export function isValidCaseQuantity(quantity) {
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0 && Number.isInteger(value * 2);
}

export function invoiceCaseItem(product, pack, caseQuantity) {
  const quantity = Number(caseQuantity);
  if (!product || !pack || !isValidCaseQuantity(quantity)) return null;
  const unitPrice = Number(product.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  const stockQuantity = quantity;
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
    baseUnitPrice: unitPrice,
  };
}

export function availableCases(availableStock, pack) {
  if (!pack?.unitsPerCase || availableStock <= 0) return 0;
  return Math.floor(availableStock * 2) / 2;
}

export function caseAvailabilityLabel(availableStock) {
  return `${Math.floor(Math.max(0, availableStock) * 2) / 2} cases available`;
}
