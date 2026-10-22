import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_BALANCES,
  INITIAL_RESTOCK_RECORDS,
} from '../data/initialData';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [restockRecords, setRestockRecords] = useState(INITIAL_RESTOCK_RECORDS);
  const [balances, setBalances] = useState(INITIAL_BALANCES);
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
    const newOrder = {
      id: `o${Date.now()}`,
      orderNumber: `ORD-2026-${String(orders.length + 1).padStart(3, '0')}`,
      customer,
      items,
      subtotal: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      deposit: 0,
      grandTotal: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
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
      invoiceNumber: `INV-2026-${String(balances.length + 1).padStart(3, '0')}`,
      totalAmount: newOrder.grandTotal,
      amountPaid: 0,
      remainingBalance: newOrder.grandTotal,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'unpaid',
    };
    setBalances([...balances, newBalance]);

    return newOrder;
  }, [orders, products, balances]);

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
    const updatedBalances = balances.map((balance) => {
      if (balance.id === balanceId) {
        const newAmountPaid = balance.amountPaid + amountPaid;
        const remainingBalance = balance.totalAmount - newAmountPaid;
        return {
          ...balance,
          amountPaid: newAmountPaid,
          remainingBalance: remainingBalance > 0 ? remainingBalance : 0,
          status: remainingBalance <= 0 ? 'paid' : 'unpaid',
        };
      }
      return balance;
    });
    setBalances(updatedBalances);
  }, [balances]);

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
    setRestockRecords([...restockRecords, newRecord]);

    return newRecord;
  }, [products, restockRecords]);

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
    login,
    logout,
    createOrder,
    updateOrderStatus,
    recordPayment,
    addRestockRecord,
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
