import { casePackOptionsForProduct } from '../orders/casePacks.js';

export const availableStock = product => product.totalStock - product.reservedStock;
export const canDeleteProduct = product => product.reservedStock === 0;

export const stockState = amount => amount <= 0 ? 'out' : amount <= 15 ? 'low' : 'healthy';

export function filterInventoryProducts(products, { search = '', supplier = 'All', status = 'all' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return products.filter(product => {
    const available = availableStock(product);
    return (!query || product.name.toLocaleLowerCase().includes(query)
      || product.supplier.toLocaleLowerCase().includes(query))
      && (supplier === 'All' || product.supplier === supplier)
      && (status === 'all' || stockState(available) === status);
  });
}

export function isValidInventoryUpdate(product, totalStock, casePackIds, casePrices) {
  const options = casePackOptionsForProduct(product);
  const validPacks = Array.isArray(casePackIds) && casePackIds.length > 0 && new Set(casePackIds).size === casePackIds.length
    && casePackIds.every(id => options.some(pack => pack.id === id
      && Number.isFinite(Number(casePrices[id])) && Number(casePrices[id]) > 0));
  return Number.isFinite(totalStock) && Number.isInteger(totalStock * 2) && totalStock >= product.reservedStock
    && validPacks;
}

export function createProductProfile(products, profile, makeId = () => `p${Date.now()}`) {
  const name = String(profile.name ?? '').trim();
  const supplier = String(profile.supplier ?? '').trim();
  const totalStock = Number(profile.totalStock);
  const casePackIds = profile.casePackIds || [];
  const casePrices = profile.casePrices || {};
  const normalizedCasePrices = Object.fromEntries(casePackIds.map(id => [id, Number(casePrices[id])]));
  if (!name || !supplier) return { product: null, error: 'Product name and supplier are required.' };
  if (products.some(product => product.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { product: null, error: 'A product with this name already exists.' };
  }
  if (!Number.isFinite(totalStock) || !Number.isInteger(totalStock * 2) || totalStock < 0
    || !isValidInventoryUpdate({ name, reservedStock: 0 }, totalStock, casePackIds, normalizedCasePrices)) {
    return { product: null, error: 'Enter stock in half-case steps, select a case type, and enter its case price.' };
  }
  return {
    product: { id: makeId(), name, supplier, totalStock, reservedStock: 0, casePackIds, casePrices: normalizedCasePrices },
    error: null,
  };
}
