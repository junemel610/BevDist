import { availableStock } from './inventoryUtils.js';
import { formatCaseQuantity } from '../orders/caseQuantity.js';

export function stockNotice(items, products, title) {
  const seen = new Set();
  const lines = [];
  for (const item of items) {
    const key = `${item.productId}:${item.packId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const product = products.find(row => row.id === item.productId);
    if (product) lines.push(`${product.name}: ${formatCaseQuantity(availableStock(product, item.packId))} cases left`);
  }
  return `${title}\n${lines.slice(0, 2).join(' · ')}${lines.length > 2 ? ` · +${lines.length - 2} more products` : ''}`;
}
