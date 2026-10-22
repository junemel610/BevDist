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
