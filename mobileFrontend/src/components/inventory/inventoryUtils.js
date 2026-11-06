import { casePackOptionsForProduct } from '../orders/casePacks.js';

export const stockForCasePack = (product, packId) => {
  if (!product) return { totalStock: 0, reservedStock: 0 };
  return product.stockByCasePack?.[packId]
    ?? { totalStock: packId === product.casePackIds?.[0] ? product.totalStock ?? 0 : 0, reservedStock: packId === product.casePackIds?.[0] ? product.reservedStock ?? 0 : 0 };
};
export const availableStock = (product, packId) => !product ? 0 : packId
  ? stockForCasePack(product, packId).totalStock - stockForCasePack(product, packId).reservedStock
  : product.casePackIds?.reduce((sum, id) => sum + availableStock(product, id), 0) ?? (product.totalStock - product.reservedStock);
export const canDeleteProduct = product => Object.values(product.stockByCasePack ?? {}).every(stock => !stock.reservedStock && !stock.totalStock)
  && !(product.reservedStock > 0) && !(product.totalStock > 0);

export const stockState = amount => amount <= 0 ? 'out' : amount <= 15 ? 'low' : 'healthy';
export const productStockState = product => {
  const states = (product.casePackIds || []).map(id => stockState(availableStock(product, id)));
  return states.length && states.every(state => state === 'out') ? 'out'
    : states.some(state => state !== 'healthy') ? 'low' : stockState(availableStock(product));
};

export function filterInventoryProducts(products, { search = '', supplier = 'All', status = 'all' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return products.filter(product => {
    return (!query || product.name.toLocaleLowerCase().includes(query)
      || product.supplier.toLocaleLowerCase().includes(query))
      && (supplier === 'All' || product.supplier === supplier)
      && (status === 'all' || productStockState(product) === status);
  });
}

export function isValidInventoryUpdate(product, stockByCasePack, casePackIds, casePrices) {
  const options = casePackOptionsForProduct(product);
  const validPacks = Array.isArray(casePackIds) && casePackIds.length === 1 && casePackIds[0] === 'B'
    && casePackIds.every(id => options.some(pack => pack.id === id)
      && /^\d+(\.\d{1,2})?$/.test(String(casePrices[id])) && Number(casePrices[id]) > 0);
  return validPacks && casePackIds.every(id => {
    const stock = stockByCasePack[id] || {};
    const current = stockForCasePack(product, id);
    return Number.isFinite(Number(stock.totalStock)) && Number.isInteger(Number(stock.totalStock) * 2)
      && Number(stock.totalStock) >= current.reservedStock;
  }) && (product.casePackIds || []).every(id => casePackIds.includes(id)
    || stockForCasePack(product, id).totalStock === 0);
}

export function createProductProfile(products, profile, makeId = () => `p${Date.now()}`) {
  const name = String(profile.name ?? '').trim();
  const supplier = String(profile.supplier ?? '').trim();
  const stockByCasePack = profile.stockByCasePack || {};
  const casePackIds = profile.casePackIds || [];
  const casePrices = profile.casePrices || {};
  const normalizedCasePrices = Object.fromEntries(casePackIds.map(id => [id, Number(casePrices[id])]));
  if (!name || !supplier) return { product: null, error: 'Product name and supplier are required.' };
  if (products.some(product => product.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { product: null, error: 'A product with this name already exists.' };
  }
  const normalizedStock = Object.fromEntries(casePackIds.map(id => [id, {
    totalStock: Number(stockByCasePack[id]?.totalStock), reservedStock: 0,
  }]));
  if (!isValidInventoryUpdate({ name, reservedStock: 0, casePackIds: [], casePackTypes: profile.casePackTypes }, normalizedStock, casePackIds, casePrices)) {
    return { product: null, error: 'Enter stock in half-case steps and a numeric selling price greater than ₱0 for each selected case type.' };
  }
  return {
    product: { id: makeId(), name, supplier, stockByCasePack: normalizedStock, casePackIds, casePrices: normalizedCasePrices },
    error: null,
  };
}
