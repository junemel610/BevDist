import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_BALANCES,
  INITIAL_RESTOCK_RECORDS,
  INITIAL_CUSTOMERS,
  INITIAL_PAYMENT_TRANSACTIONS,
} from '../data/initialData';
import { createProductProfile, isValidInventoryUpdate } from '../components/inventory/inventoryUtils';
import { balanceStatus, creditAppliedToInvoice, customerCreditKey, paymentBreakdown } from '../components/balances/balanceUtils';
import { canMarkDelivered, orderLifecycleStatus } from '../components/orders/orderLifecycle';
import { saveCustomerProfile } from '../components/customers/customerProfiles';
import { createPaymentTransaction } from '../components/balances/paymentLedger';
import { PAYMENT_METHOD } from '../types';
import { allocatePayment, carryForwardBalances, forwardBalanceRecords } from '../components/balances/carryForward';

function finalizeReservedStock(products, order) {
  return products.map((product) => {
    const reservedQty = order.items.reduce((sum, item) => (
      item.productId === product.id ? sum + (item.stockQuantity ?? item.quantity) : sum
    ), 0);
    return reservedQty ? {
      ...product,
      totalStock: product.totalStock - reservedQty,
      reservedStock: product.reservedStock - reservedQty,
    } : product;
  });
}

function releaseReservedStock(products, order) {
  return products.map((product) => {
    const reservedQty = order.items.reduce((sum, item) => (
      item.productId === product.id ? sum + (item.stockQuantity ?? item.quantity) : sum
    ), 0);
    return reservedQty ? { ...product, reservedStock: product.reservedStock - reservedQty } : product;
  });
}

const AppContext = createContext();

export function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [restockRecords, setRestockRecords] = useState(INITIAL_RESTOCK_RECORDS);
  const [balances, setBalances] = useState(INITIAL_BALANCES);
  const [paymentTransactions, setPaymentTransactions] = useState(INITIAL_PAYMENT_TRANSACTIONS);
  const [customerCredits, setCustomerCredits] = useState({});
  // Auth actions
  const login = useCallback((username, password) => {
    setCurrentUser(username);
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  }, []);

  const saveCustomer = useCallback((profile) => {
    const result = saveCustomerProfile(customers, profile);
    if (!result.error) setCustomers(result.customers);
    return result.customer;
  }, [customers]);

  // Order actions
  const createOrder = useCallback((customer, items) => {
    const requestedStock = items.reduce((totals, item) => {
      totals[item.productId] = (totals[item.productId] || 0) + (item.stockQuantity ?? item.quantity);
      return totals;
    }, {});
    if (Object.entries(requestedStock).some(([productId, quantity]) => {
      const product = products.find((item) => item.id === productId);
      return !product || quantity > product.totalStock - product.reservedStock;
    })) return false;

    const invoiceNumber = `INV-2026-${String(orders.length + 1).padStart(3, '0')}`;
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const carryForward = carryForwardBalances(balances, customer);
    const totalDue = total + carryForward.amount;
    const creditKey = customerCreditKey(customer);
    const creditAvailable = Number(customerCredits[creditKey] || 0);
    const appliedCredit = creditAppliedToInvoice(creditAvailable, totalDue);
    const creditAppliedToCarry = Math.min(carryForward.amount, appliedCredit);
    const newOrder = {
      id: `o${Date.now()}`,
      orderNumber: `ORD-2026-${String(orders.length + 1).padStart(3, '0')}`,
      invoiceNumber,
      customer,
      items,
      subtotal: total,
      deposit: 0,
      grandTotal: total,
      status: 'pending',
      deliveryStatus: 'pending',
      date: new Date().toISOString().split('T')[0],
    };

    // Reserve stock for pending orders
    const updatedProducts = products.map((product) => {
      const reservedQty = items.reduce((sum, item) => {
        if (item.productId === product.id) return sum + (item.stockQuantity ?? item.quantity);
        return sum;
      }, 0);
      return {
        ...product,
        reservedStock: product.reservedStock + reservedQty,
      };
    });

    setProducts(updatedProducts);
    setOrders([...orders, newOrder]);

    // Create balance record
    const newBalance = {
      id: `b${Date.now()}`,
      orderId: newOrder.id,
      customerName: customer.name,
      customerId: customer.id,
      invoiceNumber,
      totalAmount: totalDue,
      currentInvoiceTotal: total,
      currentInvoicePaid: Math.max(0, appliedCredit - creditAppliedToCarry),
      carriedForwardAmount: carryForward.amount,
      carriedForwardPaid: creditAppliedToCarry,
      carriedForwardItems: carryForward.items,
      amountPaid: appliedCredit,
      remainingBalance: totalDue - appliedCredit,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: appliedCredit >= totalDue ? 'paid' : appliedCredit > 0 ? 'partial' : 'unpaid',
    };
    setBalances([...forwardBalanceRecords(balances, carryForward.items, newOrder.id), newBalance]);
    if (appliedCredit > 0) {
      const remainingCredit = creditAvailable - appliedCredit;
      setCustomerCredits((current) => {
        const next = { ...current };
        if (remainingCredit > 0) next[creditKey] = remainingCredit;
        else delete next[creditKey];
        return next;
      });
    }

    return { ...newOrder, appliedCredit };
  }, [orders, products, balances, customerCredits]);

  const updateOrderStatus = useCallback((orderId, newStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === 'cancelled' || order.status === 'completed') return false;
    const orderBalance = balances.find((item) => item.orderId === orderId);
    if (orderBalance?.carriedForwardToOrderId) return false;
    if (newStatus === 'cancelled') {
      if (order.deliveryStatus === 'delivered') return false;
      const balance = orderBalance;
      if (balance && balance.amountPaid > 0) return false;
      setProducts(releaseReservedStock(products, order));
      setOrders(orders.map((item) => item.id === orderId ? { ...item, status: 'cancelled' } : item));
      const carriedItems = balance?.carriedForwardItems || [];
      const restoreById = new Map(carriedItems.map(item => [item.balanceId, item.amount]));
      setBalances(balances.map((item) => {
        if (item.orderId === orderId) return { ...item, status: 'cancelled', remainingBalance: 0 };
        if (!restoreById.has(item.id)) return item;
        const restored = { ...item, carriedForwardToOrderId: null, remainingBalance: item.remainingBalance + restoreById.get(item.id) };
        return { ...restored, status: balanceStatus(restored) };
      }));
      return true;
    }
    if (newStatus !== 'completed' || !canMarkDelivered(order)) return false;

    const balance = orderBalance;
    const paid = balance ? balance.remainingBalance <= 0 : order.grandTotal <= 0;
    const deliveredOrder = { ...order, deliveryStatus: 'delivered' };
    const status = orderLifecycleStatus(deliveredOrder, paid ? 'paid' : 'partial');
    setOrders(orders.map((item) => item.id === orderId ? { ...deliveredOrder, status } : item));
    if (status === 'completed') setProducts(finalizeReservedStock(products, order));
    return true;
  }, [orders, products, balances]);

  const recordPayment = useCallback((balanceId, amountPaid, method = PAYMENT_METHOD.CASH) => {
    const balance = balances.find((item) => item.id === balanceId);
    if (!balance) return false;
    const payment = paymentBreakdown(balance, amountPaid);
    if (!payment.valid) return false;
    const order = orders.find((item) => item.id === balance.orderId);
    const transaction = createPaymentTransaction(balance, order, amountPaid, method);
    if (!transaction) return false;
    const nextRemaining = Math.max(0, balance.remainingBalance - payment.applied);
    const allocation = allocatePayment(balance, payment.applied);
    const today = new Date().toISOString().slice(0, 10);
    const updatedBalances = balances.map((item) => item.id === balanceId ? {
      ...item,
      amountPaid: item.amountPaid + payment.applied,
      currentInvoicePaid: allocation.currentInvoicePaid,
      carriedForwardPaid: allocation.carriedForwardPaid,
      remainingBalance: nextRemaining,
      status: balanceStatus({ ...item, remainingBalance: nextRemaining }, today),
    } : item);
    setBalances(updatedBalances);
    setPaymentTransactions((current) => [...current, transaction]);
    const paidOrder = orders.find((item) => item.id === balance.orderId);
    if (paidOrder && paidOrder.deliveryStatus === 'delivered' && nextRemaining === 0 && paidOrder.status !== 'completed') {
      setProducts((current) => finalizeReservedStock(current, paidOrder));
      setOrders((current) => current.map((item) => item.id === paidOrder.id ? { ...item, status: 'completed' } : item));
    }
    if (payment.excess > 0) {
      const creditKey = customerCreditKey(order?.customer || balance.customerName);
      setCustomerCredits((current) => ({ ...current, [creditKey]: (Number(current[creditKey]) || 0) + payment.excess }));
    }
    return payment;
  }, [balances, orders]);

  const addRestockRecord = useCallback((supplier, items, returnedCases) => {
    const totalProductCost = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const totalReturnedCredit = returnedCases.reduce(
      (sum, rc) => sum + rc.quantity * rc.creditPerUnit,
      0
    );

    const newRecord = {
      id: `r${Date.now()}`,
      supplier,
      items,
      returnedCases,
      totalProductCost,
      totalReturnedCredit,
      netCost: totalProductCost - totalReturnedCredit,
      date: new Date().toISOString().split('T')[0],
    };

    // Update product stock
    const updatedProducts = products.map((product) => {
      const restockedQty = items.reduce((sum, item) => {
        if (item.productId === product.id) return sum + item.quantity;
        return sum;
      }, 0);
      return {
        ...product,
        totalStock: product.totalStock + restockedQty,
      };
    });

    setProducts(updatedProducts);
    setRestockRecords([newRecord, ...restockRecords]);

    return newRecord;
  }, [products, restockRecords]);

  const updateProductInventory = useCallback((productId, changes) => {
    const product = products.find((item) => item.id === productId);
    const totalStock = Number(changes.totalStock);
    const unitPrice = Number(changes.unitPrice);
    if (!product || !isValidInventoryUpdate(product, totalStock, unitPrice)) return false;

    setProducts((current) => current.map((item) => item.id === productId
      ? { ...item, totalStock, unitPrice }
      : item
    ));
    return true;
  }, [products]);

  const addProduct = useCallback((profile) => {
    const result = createProductProfile(products, profile);
    if (!result.error) setProducts((current) => [result.product, ...current]);
    return result.product;
  }, [products]);

  // Derived queries
  const getAvailableStock = useCallback((productId) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return 0;
    return product.totalStock - product.reservedStock;
  }, [products]);

  const getTodaySales = useCallback(() => {
    return orders
      .filter((o) => o.status === 'completed' && o.date === new Date().toISOString().split('T')[0])
      .reduce((sum, order) => sum + order.grandTotal, 0);
  }, [orders]);

  const getPendingOrdersCount = useCallback(() => {
    return orders.filter((o) => o.status === 'pending').length;
  }, [orders]);

  const getCompletedOrdersCount = useCallback(() => {
    return orders.filter((o) => o.status === 'completed').length;
  }, [orders]);

  const getOutstandingBalance = useCallback(() => {
    return balances.reduce((sum, b) => sum + b.remainingBalance, 0);
  }, [balances]);

  const getLowStockCount = useCallback(() => {
    return products.filter((p) => getAvailableStock(p.id) < 20).length;
  }, [products, getAvailableStock]);

  const value = {
    isLoggedIn,
    currentUser,
    products,
    customers,
    orders,
    restockRecords,
    balances,
    paymentTransactions,
    customerCredits,
    login,
    logout,
    createOrder,
    saveCustomer,
    updateOrderStatus,
    recordPayment,
    addRestockRecord,
    updateProductInventory,
    addProduct,
    getAvailableStock,
    getTodaySales,
    getPendingOrdersCount,
    getCompletedOrdersCount,
    getOutstandingBalance,
    getLowStockCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
