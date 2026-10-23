import { stockForCasePack } from '../inventory/inventoryUtils.js';

export function orderDeliveryStatus(order) {
  if (order.deliveryStatus) return order.deliveryStatus;
  return order.status === 'completed' ? 'delivered' : 'pending';
}

export function orderLifecycleStatus(order, paymentStatus) {
  if (order.status === 'cancelled') return 'cancelled';
  if (orderDeliveryStatus(order) === 'delivered' && paymentStatus === 'paid') return 'completed';
  return 'pending';
}

export function canMarkDelivered(order) {
  return order.status !== 'cancelled' && orderDeliveryStatus(order) !== 'delivered';
}

export function finalizeReservedStock(products, order) {
  return products.map((product) => {
    const quantities = {};
    order.items.filter(item => item.productId === product.id && item.packId).forEach(item => {
      const packId = item.packId;
      quantities[packId] = (quantities[packId] || 0) + (item.stockQuantity ?? item.quantity);
    });
    const changes = Object.fromEntries(Object.entries(quantities).map(([packId, quantity]) => {
      const stock = stockForCasePack(product, packId);
      return [packId, { totalStock: stock.totalStock - quantity, reservedStock: stock.reservedStock - quantity }];
    }));
    return Object.keys(changes).length ? { ...product, stockByCasePack: { ...product.stockByCasePack, ...changes } } : product;
  });
}
