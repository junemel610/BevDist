export const availableStock = product => product.totalStock - product.reservedStock;

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

export function isValidInventoryUpdate(product, totalStock, unitPrice) {
  return Number.isInteger(totalStock) && totalStock >= product.reservedStock
    && Number.isFinite(unitPrice) && unitPrice > 0;
}

export function createProductProfile(products, profile, makeId = () => `p${Date.now()}`) {
  const name = String(profile.name ?? '').trim();
  const supplier = String(profile.supplier ?? '').trim();
  const totalStock = Number(profile.totalStock);
  const unitPrice = Number(profile.unitPrice);
  if (!name || !supplier) return { product: null, error: 'Product name and supplier are required.' };
  if (products.some(product => product.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { product: null, error: 'A product with this name already exists.' };
  }
  if (!Number.isInteger(totalStock) || totalStock < 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { product: null, error: 'Enter a whole stock count and a price greater than ₱0.' };
  }
  return {
    product: { id: makeId(), name, supplier, totalStock, reservedStock: 0, unitPrice },
    error: null,
  };
}
