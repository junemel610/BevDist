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
import { balanceStatus, creditAppliedToInvoice, customerCreditKey } from '../components/balances/balanceUtils';
import { canMarkDelivered, orderLifecycleStatus } from '../components/orders/orderLifecycle';
import { saveCustomerProfile } from '../components/customers/customerProfiles';
import { createPaymentTransaction } from '../components/balances/paymentLedger';
import { PAYMENT_METHOD } from '../types';
import { allocateAccountPayment } from '../components/balances/customerAccounts';

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
    const total = items.reduce((sum, item) => sum + item.quantity * (item.casePrice ?? item.unitPrice), 0);
    const totalDue = total;
    const creditKey = customerCreditKey(customer);
    const creditAvailable = Number(customerCredits[creditKey] || 0);
    const appliedCredit = creditAppliedToInvoice(creditAvailable, totalDue);
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
      currentInvoicePaid: appliedCredit,
      amountPaid: appliedCredit,
      remainingBalance: totalDue - appliedCredit,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: appliedCredit >= totalDue ? 'paid' : appliedCredit > 0 ? 'partial' : 'unpaid',
    };
    setBalances([...balances, newBalance]);
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
    if (newStatus === 'cancelled') {
      if (order.deliveryStatus === 'delivered') return false;
      const balance = orderBalance;
      if (balance && balance.amountPaid > 0) return false;
      setProducts(releaseReservedStock(products, order));
      setOrders(orders.map((item) => item.id === orderId ? { ...item, status: 'cancelled' } : item));
      setBalances(balances.map((item) => {
        if (item.orderId === orderId) return { ...item, status: 'cancelled', remainingBalance: 0 };
        return item;
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

  const recordCustomerPayment = useCallback((customer, amountPaid, method = PAYMENT_METHOD.CASH) => {
    const identity = customer && typeof customer === 'object' ? customer : { name: customer };
    const accountBalances = balances.filter(balance => {
      const sameId = identity.id && balance.customerId && identity.id === balance.customerId;
      const sameName = String(identity.name || identity.customerName || '').trim().toLocaleLowerCase()
        === String(balance.customerName || '').trim().toLocaleLowerCase();
      return (sameId || (!identity.id || !balance.customerId) && sameName)
        && balance.status !== 'cancelled'
        && Number(balance.remainingBalance) > 0;
    });
    const plan = allocateAccountPayment(accountBalances, orders, amountPaid);
    if (!plan.valid) return false;
    const allocations = new Map(plan.allocations.map(allocation => [allocation.balanceId, allocation.amount]));
    const lastBalanceId = plan.allocations.at(-1)?.balanceId;
    const receivedByBalance = new Map(plan.allocations.map(allocation => [
      allocation.balanceId,
      allocation.amount + (allocation.balanceId === lastBalanceId ? plan.excess : 0),
    ]));
    const transactions = plan.allocations.map((allocation, index) => {
      const balance = accountBalances.find(item => item.id === allocation.balanceId);
      const order = orders.find(item => item.id === balance.orderId);
      return createPaymentTransaction(balance, order, receivedByBalance.get(balance.id), method, `pay${Date.now()}-${index}`);
    });
    if (transactions.some(transaction => !transaction)) return false;
    const today = new Date().toISOString().slice(0, 10);
    const completedOrderIds = new Set();
    const updatedBalances = balances.map(item => {
      const applied = allocations.get(item.id);
      if (!applied) return item;
      const remainingBalance = Math.max(0, Number(item.remainingBalance) - applied);
      if (remainingBalance === 0) {
        const paidOrder = orders.find(order => order.id === item.orderId);
        if (paidOrder?.deliveryStatus === 'delivered' && paidOrder.status !== 'completed') completedOrderIds.add(paidOrder.id);
      }
      return {
        ...item,
        amountPaid: (Number(item.amountPaid) || 0) + applied,
        currentInvoicePaid: (Number(item.currentInvoicePaid ?? item.amountPaid) || 0) + applied,
        remainingBalance,
        status: balanceStatus({ ...item, remainingBalance }, today),
      };
    });
    setBalances(updatedBalances);
    setPaymentTransactions(current => [...current, ...transactions]);
    if (completedOrderIds.size) {
      const completedOrders = orders.filter(order => completedOrderIds.has(order.id));
      setProducts(current => completedOrders.reduce((next, order) => finalizeReservedStock(next, order), current));
      setOrders(current => current.map(order => completedOrderIds.has(order.id) ? { ...order, status: 'completed' } : order));
    }
    if (plan.excess > 0) {
      const creditKey = customerCreditKey(identity);
      setCustomerCredits(current => ({ ...current, [creditKey]: (Number(current[creditKey]) || 0) + plan.excess }));
    }
    return { applied: plan.applied, excess: plan.excess, allocations: plan.allocations };
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
    if (!product || !isValidInventoryUpdate(product, totalStock, changes.casePackIds, changes.casePrices)) return false;

    setProducts((current) => current.map((item) => item.id === productId
      ? { ...item, totalStock, casePackIds: changes.casePackIds, casePrices: Object.fromEntries(changes.casePackIds.map(id => [id, Number(changes.casePrices[id])])) }
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
    recordCustomerPayment,
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
