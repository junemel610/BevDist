export const CASE_PACKS = [
  { id: 'A', label: 'A', unitsPerCase: 12, type: 'standard' },
  { id: 'B', label: 'B', unitsPerCase: 24, type: 'standard' },
  { id: 'C', label: 'C', unitsPerCase: 6, type: 'standard' },
  { id: 'MUCHO_6', label: 'Mucho 6', unitsPerCase: 6, type: 'mucho' },
  { id: 'MUCHO_12', label: 'Mucho 12', unitsPerCase: 12, type: 'mucho' },
];

export function casePackName(pack) {
  if (pack?.id === 'MUCHO_6') return 'Mucho 6';
  if (pack?.id === 'MUCHO_12') return 'Mucho 12';
  return String(pack?.label || pack?.id || '').match(/^([A-Z]+)\s*·/)?.[1] || pack?.label || pack?.id || '';
}

export function casePackDisplay(pack) {
  const name = casePackName(pack);
  const units = Number(pack?.unitsPerCase);
  return name && Number.isInteger(units) && units > 0 ? `${name} · ${units} bottles per case` : name;
}

export function casePackOptionsForProduct(product) {
  const custom = [
    ...(product?.casePackTypes?.filter(pack => pack.family === 'custom') || []),
    ...(product?.casePacks?.filter(pack => pack.family === 'custom') || []),
  ].filter((pack, index, all) => all.findIndex(candidate => candidate.id === pack.id) === index);
  return String(product?.name).toLowerCase().includes('mucho')
    ? [...CASE_PACKS.filter(pack => pack.id.startsWith('MUCHO')), ...custom]
    : [...CASE_PACKS.filter(pack => !pack.id.startsWith('MUCHO')), ...custom];
}

export function casePacksForProduct(product) {
  const options = casePackOptionsForProduct(product);
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
  return `${Math.floor(Math.max(0, availableStock) * 2) / 2} cases available`;
}

export function caseQuantityInputError(value, maximum) {
  if (String(value).trim() === '') return '';
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(String(value)) || !Number.isFinite(Number(value)) || !Number.isInteger(Number(value) * 2)) return 'Use half-case steps: 0.5, 1, 1.5…';
  if (Number(value) > maximum) return `Only ${maximum} cases available.`;
  return '';
}
