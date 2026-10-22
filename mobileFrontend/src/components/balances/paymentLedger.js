import { PAYMENT_METHOD } from '../../types/index.js';
import { paymentBreakdown } from './balanceUtils.js';

export function createPaymentTransaction(balance, order, amountReceived, method, id = `pay${Date.now()}`) {
  if (!Object.values(PAYMENT_METHOD).includes(method)) return null;
  const payment = paymentBreakdown(balance, amountReceived);
  if (!payment.valid) return null;
  return {
    id,
    balanceId: balance.id,
    orderId: balance.orderId,
    customerId: balance.customerId || order?.customer?.id || null,
    customerName: balance.customerName,
    invoiceNumber: balance.invoiceNumber,
    method,
    amountReceived: Number(amountReceived),
    amountApplied: payment.applied,
    excess: payment.excess,
    date: new Date().toISOString().slice(0, 10),
  };
}
