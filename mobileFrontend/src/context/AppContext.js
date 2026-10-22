import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_BALANCES,
  INITIAL_RESTOCK_RECORDS,
} from '../data/initialData';
import { isValidInventoryUpdate } from '../components/inventory/inventoryUtils';
import { balanceStatus, creditAppliedToInvoice, customerCreditKey, paymentBreakdown } from '../components/balances/balanceUtils';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [restockRecords, setRestockRecords] = useState(INITIAL_RESTOCK_RECORDS);
  const [balances, setBalances] = useState(INITIAL_BALANCES);
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

  // Order actions
  const createOrder = useCallback((customer, items) => {
    const invoiceNumber = `INV-2026-${String(orders.length + 1).padStart(3, '0')}`;
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const creditKey = customerCreditKey(customer.name);
    const creditAvailable = Number(customerCredits[creditKey] || 0);
    const appliedCredit = creditAppliedToInvoice(creditAvailable, total);
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
      date: new Date().toISOString().split('T')[0],
    };

    // Reserve stock for pending orders
    const updatedProducts = products.map((product) => {
      const reservedQty = items.reduce((sum, item) => {
        if (item.productId === product.id) return sum + item.quantity;
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
      invoiceNumber,
      totalAmount: newOrder.grandTotal,
      amountPaid: appliedCredit,
      remainingBalance: newOrder.grandTotal - appliedCredit,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: appliedCredit >= newOrder.grandTotal ? 'paid' : 'unpaid',
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
    if (!order) return;

    const updatedOrders = orders.map((o) =>
      o.id === orderId ? { ...o, status: newStatus } : o
    );

    let updatedProducts = products;

    // Handle stock changes
    if (newStatus === 'completed') {
      // Deduct from total stock, clear reserved
      updatedProducts = products.map((product) => {
        const reservedQty = order.items.reduce((sum, item) => {
          if (item.productId === product.id) return sum + item.quantity;
          return sum;
        }, 0);
        return {
          ...product,
          totalStock: product.totalStock - reservedQty,
          reservedStock: product.reservedStock - reservedQty,
        };
      });
    } else if (newStatus === 'cancelled') {
      // Release reserved stock
      updatedProducts = products.map((product) => {
        const reservedQty = order.items.reduce((sum, item) => {
          if (item.productId === product.id) return sum + item.quantity;
          return sum;
        }, 0);
        return {
          ...product,
          reservedStock: product.reservedStock - reservedQty,
        };
      });
    }

    setProducts(updatedProducts);
    setOrders(updatedOrders);
  }, [orders, products]);

  const recordPayment = useCallback((balanceId, amountPaid) => {
    const balance = balances.find((item) => item.id === balanceId);
    if (!balance) return false;
    const payment = paymentBreakdown(balance, amountPaid);
    if (!payment.valid) return false;
    const nextRemaining = Math.max(0, balance.remainingBalance - payment.applied);
    const today = new Date().toISOString().slice(0, 10);
    const updatedBalances = balances.map((item) => item.id === balanceId ? {
      ...item,
      amountPaid: item.amountPaid + payment.applied,
      remainingBalance: nextRemaining,
      status: balanceStatus({ ...item, remainingBalance: nextRemaining }, today),
    } : item);
    setBalances(updatedBalances);
    if (payment.excess > 0) {
      const order = orders.find((item) => item.id === balance.orderId);
      const creditKey = customerCreditKey(order?.customer?.name || balance.customerName);
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
    orders,
    restockRecords,
    balances,
    customerCredits,
    login,
    logout,
    createOrder,
    updateOrderStatus,
    recordPayment,
    addRestockRecord,
    updateProductInventory,
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
