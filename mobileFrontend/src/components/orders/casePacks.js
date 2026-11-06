import { formatCaseQuantity } from './caseQuantity.js';

export const CASE_PACKS = [
  // B remains the stable storage/API identifier; users only see a generic case.
  { id: 'B', label: 'Case', unitsPerCase: 1, type: 'standard' },
];

export function casePackName(pack) {
  return 'Case';
}

export function casePackDisplay(pack) {
  const name = casePackName(pack);
  return name;
}

export function casePackOptionsForProduct(product) {
  return CASE_PACKS;
}

export function casePacksForProduct(product) {
  const options = casePackOptionsForProduct(product);
  const selectedIds = product?.casePackIds?.length ? product.casePackIds : options.map(pack => pack.id);
  return options.filter(pack => selectedIds.includes(pack.id)).map(pack => ({
    ...pack,
    casePrice: product?.casePrices?.[pack.id] != null
      ? Number(product.casePrices[pack.id])
      : (product?.unitPrice != null ? Number(product.unitPrice) * pack.unitsPerCase : null),
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
    packLabel: casePackDisplay(pack),
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
  return `${formatCaseQuantity(Math.floor(Math.max(0, availableStock) * 2) / 2)} cases available`;
}

export function caseQuantityInputError(value, maximum) {
  if (String(value).trim() === '') return '';
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(String(value)) || !Number.isFinite(Number(value)) || !Number.isInteger(Number(value) * 2)) return 'Use half-case steps: 0.5, 1, 1.5…';
  if (Number(value) > maximum) return `Only ${formatCaseQuantity(maximum)} cases available.`;
  return '';
}
