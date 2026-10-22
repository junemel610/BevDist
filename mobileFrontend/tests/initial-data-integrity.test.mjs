import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_BALANCES,
  INITIAL_CUSTOMER_CREDITS,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_PAYMENT_TRANSACTIONS,
  INITIAL_PRODUCTS,
  INITIAL_RESTOCK_RECORDS,
} from '../src/data/initialData.js';
import { CASE_PACKS } from '../src/components/orders/casePacks.js';
import { RETURNED_CASE_TYPES } from '../src/components/supplierOrders/supplierOrderUtils.js';

const byId = items => new Map(items.map(item => [item.id, item]));
const cents = amount => Math.round((amount + Number.EPSILON) * 100);

test('seed invoices, customers, case packs, balances, and payments agree', () => {
  const customers = byId(INITIAL_CUSTOMERS);
  const products = byId(INITIAL_PRODUCTS);
  const balances = byId(INITIAL_BALANCES);
  const orderIds = new Set();
  const invoiceNumbers = new Set();
  const balanceOrderIds = new Set();
  assert.equal(INITIAL_BALANCES.length, INITIAL_ORDERS.length);

  INITIAL_ORDERS.forEach(order => {
    assert.equal(orderIds.has(order.id), false, `duplicate invoice id ${order.id}`);
    assert.equal(invoiceNumbers.has(order.invoiceNumber), false, `duplicate invoice ${order.invoiceNumber}`);
    orderIds.add(order.id);
    invoiceNumbers.add(order.invoiceNumber);
    assert.equal(order.customerId, order.customer.id);
    assert.equal(customers.get(order.customerId)?.name, order.customer.name);

    const itemTotal = order.items.reduce((sum, item) => {
      const product = products.get(item.productId);
      const pack = CASE_PACKS.find(candidate => candidate.id === item.packId);
      assert.ok(product, `missing product for ${order.invoiceNumber}`);
      assert.ok(pack && product.casePackIds.includes(item.packId), `invalid case pack for ${order.invoiceNumber}`);
      assert.equal(Number.isInteger(item.quantity * 2), true, 'case quantities use half-case increments');
      assert.equal(item.stockQuantity, item.quantity);
      assert.equal(item.unitsPerCase, pack.unitsPerCase);
      assert.equal(item.casePrice, product.casePrices[item.packId]);
      return sum + item.quantity * item.casePrice;
    }, 0);
    assert.equal(cents(itemTotal), cents(order.subtotal));
    assert.equal(cents(order.subtotal), cents(order.grandTotal));

    const balance = INITIAL_BALANCES.find(record => record.orderId === order.id);
    assert.ok(balance, `missing invoice balance for ${order.invoiceNumber}`);
    assert.equal(balanceOrderIds.has(balance.orderId), false, `duplicate balance for ${order.invoiceNumber}`);
    balanceOrderIds.add(balance.orderId);
    assert.equal(balance.customerId, order.customerId);
    assert.equal(balance.invoiceNumber, order.invoiceNumber);
    assert.equal(cents(balance.totalAmount), cents(order.grandTotal));
    if (order.status === 'cancelled') {
      assert.equal(balance.status, 'cancelled');
      assert.equal(balance.remainingBalance, 0);
    } else {
      assert.equal(cents(balance.amountPaid + balance.remainingBalance), cents(balance.totalAmount));
    }
    if (order.status === 'completed') {
      assert.equal(order.deliveryStatus, 'delivered');
      assert.equal(balance.remainingBalance, 0);
    }
  });

  const appliedByBalance = new Map();
  const excessByCustomer = new Map();
  INITIAL_PAYMENT_TRANSACTIONS.forEach(payment => {
    const balance = balances.get(payment.balanceId);
    assert.ok(balance, `missing payment balance ${payment.balanceId}`);
    assert.equal(balance.orderId, payment.orderId);
    assert.equal(balance.customerId, payment.customerId);
    assert.equal(balance.invoiceNumber, payment.invoiceNumber);
    assert.equal(cents(payment.amountReceived), cents(payment.amountApplied + payment.excess));
    appliedByBalance.set(balance.id, (appliedByBalance.get(balance.id) || 0) + payment.amountApplied);
    excessByCustomer.set(payment.customerId, (excessByCustomer.get(payment.customerId) || 0) + payment.excess);
  });
  INITIAL_BALANCES.forEach(balance => {
    assert.equal(cents(appliedByBalance.get(balance.id) || 0), cents(balance.amountPaid));
  });
  Object.entries(INITIAL_CUSTOMER_CREDITS).forEach(([key, credit]) => {
    const customerId = key.replace('customer:', '');
    assert.equal(cents(credit), cents(excessByCustomer.get(customerId) || 0));
  });

  const expectedReservations = new Map();
  INITIAL_ORDERS.filter(order => order.status === 'pending').forEach(order => order.items.forEach(item => {
    const key = `${item.productId}:${item.packId}`;
    expectedReservations.set(key, (expectedReservations.get(key) || 0) + item.stockQuantity);
  }));
  INITIAL_PRODUCTS.forEach(product => product.casePackIds.forEach(packId => {
    const key = `${product.id}:${packId}`;
    assert.equal(product.stockByCasePack[packId].reservedStock, expectedReservations.get(key) || 0, key);
    assert.ok(product.stockByCasePack[packId].totalStock >= product.stockByCasePack[packId].reservedStock);
  }));
});

test('seed supplier order uses case-level products and the four configured return types', () => {
  const products = byId(INITIAL_PRODUCTS);
  INITIAL_RESTOCK_RECORDS.forEach(record => {
    const productTotal = record.items.reduce((sum, item) => {
      const product = products.get(item.productId);
      const pack = CASE_PACKS.find(candidate => candidate.id === item.packId);
      assert.ok(product && pack && product.casePackIds.includes(item.packId));
      assert.ok(item.packLabel);
      assert.equal(Number.isInteger(item.quantity * 2), true);
      assert.equal(item.unitsPerCase, pack.unitsPerCase);
      return sum + item.quantity * item.unitCost;
    }, 0);
    const returnCredit = record.returnedCases.reduce((sum, item) => {
      const type = RETURNED_CASE_TYPES.find(candidate => candidate.type === item.type);
      assert.ok(type, `unknown returned case type ${item.type}`);
      assert.equal(item.creditPerUnit, type.creditPerUnit);
      return sum + item.quantity * item.creditPerUnit;
    }, 0);
    assert.equal(cents(record.totalProductCost), cents(productTotal));
    assert.equal(cents(record.totalReturnedCredit), cents(returnCredit));
    assert.equal(cents(record.netCost), cents(productTotal - returnCredit));
  });
});
