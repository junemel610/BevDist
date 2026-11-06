import { availableStock, stockForCasePack } from '../inventory/inventoryUtils.js';
import { balanceStatus } from '../balances/balanceUtils.js';

const quantitiesByPack = items => items.reduce((result, item) => {
  const key = `${item.productId}:${item.packId}`;
  result[key] = (result[key] || 0) + Number(item.stockQuantity ?? item.quantity);
  return result;
}, {});

export function updatePendingInvoice(products, order, balance, items) {
  if (!order || order.status !== 'pending' || order.deliveryStatus === 'delivered') {
    return { error: 'Only pending, undelivered invoices can be edited.' };
  }
  if (!items.length || items.some(item => {
    const product = products.find(candidate => candidate.id === item.productId);
    return !product?.casePackIds.includes(item.packId) || !Number.isInteger(Number(item.quantity) * 2)
      || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.casePrice)) || Number(item.casePrice) <= 0;
  })) {
    return { error: 'Add valid product quantities in half-case steps.' };
  }

  const previous = quantitiesByPack(order.items);
  const next = quantitiesByPack(items);
  const updatedProducts = products.map(product => {
    const packIds = new Set(product.casePackIds);
    [...order.items, ...items].filter(item => item.productId === product.id).forEach(item => packIds.add(item.packId));
    const stockByCasePack = { ...product.stockByCasePack };
    for (const packId of packIds) {
      const key = `${product.id}:${packId}`;
      const stock = stockForCasePack(product, packId);
      const oldQuantity = previous[key] || 0;
      const newQuantity = next[key] || 0;
      if (newQuantity > availableStock(product, packId) + oldQuantity) return null;
      stockByCasePack[packId] = { ...stock, reservedStock: stock.reservedStock - oldQuantity + newQuantity };
    }
    return { ...product, stockByCasePack };
  });
  if (updatedProducts.some(product => !product)) return { error: 'Not enough available stock for these invoice quantities.' };

  const subtotal = items.reduce((sum, item) => sum + Math.round(Number(item.quantity) * Number(item.casePrice) * 100) / 100, 0);
  const total = Math.round((subtotal + Number(order.containerDepositTotal || 0) - Number(order.containerRefundTotal || 0)) * 100) / 100;
  const amountPaid = Number(balance?.amountPaid) || 0;
  if (total < amountPaid) return { error: 'The invoice total cannot be lower than payments already recorded.' };

  const updatedOrder = { ...order, items, subtotal, grandTotal: total };
  const updatedBalance = balance ? {
    ...balance,
    totalAmount: total,
    remainingBalance: total - amountPaid,
    status: balanceStatus({ ...balance, remainingBalance: total - amountPaid }),
  } : null;
  return { products: updatedProducts, order: updatedOrder, balance: updatedBalance };
}

export function invoiceEditorProducts(products, order) {
  if (!order) return products;
  return products.map(product => ({ ...product, casePrices: {
    ...product.casePrices,
    ...Object.fromEntries(order.items.filter(item => item.productId === product.id)
      .map(item => [item.packId, item.casePrice])),
  } }));
}
