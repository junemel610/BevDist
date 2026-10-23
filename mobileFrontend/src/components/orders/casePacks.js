export const CASE_PACKS = [
  { id: 'A', label: 'A · 12 bottles/case', unitsPerCase: 12, type: 'standard' },
  { id: 'B', label: 'B · 24 bottles/case', unitsPerCase: 24, type: 'standard' },
  { id: 'C', label: 'C · 6 bottles/case', unitsPerCase: 6, type: 'standard' },
  { id: 'MUCHO_6', label: '6 bottles/case', unitsPerCase: 6, type: 'mucho' },
  { id: 'MUCHO_12', label: '12 bottles/case', unitsPerCase: 12, type: 'mucho' },
];

export function casePackOptionsForProduct(product) {
  return String(product?.name).toLowerCase().includes('mucho')
    ? CASE_PACKS.filter(pack => pack.id.startsWith('MUCHO'))
    : CASE_PACKS.filter(pack => !pack.id.startsWith('MUCHO'));
}

export function casePacksForProduct(product) {
  const options = product?.casePackIds?.length ? CASE_PACKS : casePackOptionsForProduct(product);
  const selectedIds = product?.casePackIds?.length ? product.casePackIds : options.map(pack => pack.id);
  return options.filter(pack => selectedIds.includes(pack.id)).map(pack => ({
    ...pack,
    casePrice: Number(product?.casePrices?.[pack.id]) || Number(product?.unitPrice) * pack.unitsPerCase,
  }));
}

export function isValidCaseQuantity(quantity) {
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0 && Number.isInteger(value * 2);
}

export function invoiceCaseItem(product, pack, caseQuantity) {
  const quantity = Number(caseQuantity);
  if (!product || !pack || !isValidCaseQuantity(quantity)) return null;
  const casePrice = Number(pack.casePrice ?? product.casePrices?.[pack.id] ?? Number(product.unitPrice) * pack.unitsPerCase);
  if (!Number.isFinite(casePrice) || casePrice <= 0) return null;
  const stockQuantity = quantity;
  return {
    productId: product.id,
    productName: product.name,
    packId: pack.id,
    packLabel: pack.label,
    unitsPerCase: pack.unitsPerCase,
    quantity,
    stockQuantity,
    casePrice,
  };
}

export function availableCases(availableStock, pack) {
  if (!pack?.unitsPerCase || availableStock <= 0) return 0;
  return Math.floor(availableStock * 2) / 2;
}

export function caseAvailabilityLabel(availableStock) {
  return `${Math.floor(Math.max(0, availableStock) * 2) / 2} cases available`;
}
