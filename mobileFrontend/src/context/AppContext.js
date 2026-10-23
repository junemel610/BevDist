import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { businessDate } from '../utils/businessDate';
import { randomUUID } from 'expo-crypto';
import * as api from '../api/index';
import { setUnauthorizedHandler, setAuthToken } from '../api/client';
import { createLiveData } from '../api/liveData';
import { availableStock, stockState } from '../components/inventory/inventoryUtils';
import { PAYMENT_METHOD } from '../types';

const emptyData = () => ({ products: [], suppliers: [], customers: [], orders: [], restockRecords: [], balances: [], paymentTransactions: [], payments: [], customerCredits: {} });
const AppContext = createContext();

export function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [data, setData] = useState(emptyData);
  const [busy, setBusy] = useState(false);
  const [dataError, setDataError] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const pending = useRef(false);
  const generation = useRef(0);
  const live = useRef(null);
  if (live.current === null) live.current = createLiveData(api, randomUUID);
  const { products, suppliers, orders, balances, paymentTransactions } = data;

  const clearSession = useCallback(() => {
    generation.current++;
    setAuthToken(null);
    live.current.clear();
    setCurrentUser(null);
    setIsLoggedIn(false);
    setData(emptyData());
    setDataError('');
  }, []);
  useEffect(() => setUnauthorizedHandler(() => {
    clearSession();
    setSessionMessage('Your session has expired. Please sign in again.');
  }), [clearSession]);

  const loadData = useCallback(async () => {
    const session = generation.current;
    const snapshot = await live.current.load();
    if (session !== generation.current) throw new Error('Session changed. Please sign in again.');
    setData(snapshot);
    setDataError('');
    return snapshot;
  }, []);

  const refreshData = useCallback(async () => {
    if (pending.current) throw new Error('Another request is still running.');
    pending.current = true;
    setBusy(true);
    try { return await loadData(); }
    finally { pending.current = false; setBusy(false); }
  }, [loadData]);

  const login = useCallback(async (username, password) => {
    if (pending.current) throw new Error('Another request is still running.');
    pending.current = true;
    setSessionMessage('');
    try {
      const { data: signedIn } = await api.authAPI.login(username.trim(), password);
      await loadData();
      setCurrentUser(signedIn.user.username);
      setIsLoggedIn(true);
    } catch (error) { clearSession(); throw error; }
    finally { pending.current = false; }
  }, [loadData, clearSession]);

  const logout = useCallback(async () => {
    if (pending.current) throw new Error('Another request is still running.');
    pending.current = true;
    try { await api.authAPI.logout(); clearSession(); setSessionMessage(''); }
    finally { pending.current = false; }
  }, [clearSession]);

  const mutate = useCallback(async work => {
    if (pending.current) throw new Error('Another request is still running.');
    if (dataError) throw new Error('Refresh the records before saving another change.');
    pending.current = true;
    setBusy(true);
    const session = generation.current;
    let saved = false;
    try {
      const result = await work();
      saved = true;
      return { result, snapshot: await loadData() };
    } catch (error) {
      if (session === generation.current && (saved || !error.response || error.response.status >= 500)) {
        setDataError(saved
          ? 'Your change was saved, but updated records could not load. Refresh before continuing.'
          : 'The save result could not be confirmed. Refresh and check the records before trying again.');
      }
      if (saved) throw new Error('Your change was saved. Refresh records before continuing.');
      throw error;
    } finally { pending.current = false; setBusy(false); }
  }, [dataError, loadData]);

  const saveCustomer = useCallback(async profile => {
    const { result } = await mutate(() => live.current.saveCustomer(profile));
    return result;
  }, [mutate]);
  const createOrder = useCallback(async (customer, items, containerReturns = []) => {
    const { result, snapshot } = await mutate(() => live.current.createOrder(customer, items, containerReturns));
    const order = snapshot.orders.find(o => o.id === result.data.id);
    return { ...order, appliedCredit: snapshot.balances.find(b => b.orderId === order.id)?.appliedCredit || 0, products: snapshot.products };
  }, [mutate]);
  const editPendingInvoice = useCallback(async (id, items, containerReturns) => {
    const { snapshot } = await mutate(() => live.current.editInvoice(id, items, containerReturns));
    return { order: snapshot.orders.find(o => o.id === id), products: snapshot.products };
  }, [mutate]);
  const updateOrderStatus = useCallback(async (id, status) => { await mutate(() => live.current.transition(id, status)); return true; }, [mutate]);
  const recordCustomerPayment = useCallback(async (customer, amount, method = PAYMENT_METHOD.CASH) => {
    const { result, snapshot } = await mutate(() => live.current.payment(customer, amount, method));
    const receipt = snapshot.payments.find(p => p.id === result.data.id);
    const applied = receipt.allocations.reduce((sum, a) => sum + a.amountApplied, 0);
    return { applied, excess: Math.round((receipt.amountReceived - applied) * 100) / 100 };
  }, [mutate]);
  const addRestockRecord = useCallback(async (supplierName, items, returnedCases) => {
    const supplier = suppliers.find(s => s.name === supplierName);
    if (!supplier) throw new Error('Choose a saved supplier. Add a product with its supplier in Inventory first.');
    await mutate(() => live.current.restock(supplier.id, items, returnedCases));
  }, [mutate, suppliers]);
  const addProduct = useCallback(async profile => {
    const { result, snapshot } = await mutate(() => live.current.saveProduct(null, profile));
    return snapshot.products.find(p => p.id === result.data.id);
  }, [mutate]);
  const updateProductInventory = useCallback(async (id, changes, original) => {
    await mutate(() => live.current.saveProduct(id, changes, original));
    return true;
  }, [mutate]);
  const deleteProduct = useCallback(async id => { await mutate(() => live.current.deleteProduct(id)); return true; }, [mutate]);

  // Derived queries
  const getAvailableStock = useCallback((productId, packId) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return 0;
    return availableStock(product, packId);
  }, [products]);

  const getTodaySales = useCallback(() => {
    const orderById = new Map(orders.map(order => [order.id, order]));
    const balanceById = new Map(balances.map(balance => [balance.id, balance]));
    const today = businessDate();
    return paymentTransactions.reduce((sum, payment) => {
      const order = orderById.get(payment.orderId);
      const balance = balanceById.get(payment.balanceId);
      const amount = Number(payment.amountApplied);
      return payment.method === PAYMENT_METHOD.CASH && payment.date === today && order && order.status !== 'cancelled'
        && balance?.orderId === order.id && balance.status !== 'cancelled' && Number.isFinite(amount)
        ? sum + Math.max(0, amount) : sum;
    }, 0);
  }, [orders, balances, paymentTransactions]);

  const getPendingOrdersCount = useCallback(() => {
    return orders.filter((o) => o.status === 'pending').length;
  }, [orders]);

  const getCompletedOrdersCount = useCallback(() => {
    return orders.filter((o) => o.status === 'completed').length;
  }, [orders]);

  const getOutstandingBalance = useCallback(() => {
    return balances.reduce((sum, balance) => balance.status === 'cancelled'
      ? sum : sum + Math.max(0, Number(balance.remainingBalance) || 0), 0);
  }, [balances]);

  const getLowStockCount = useCallback(() => {
    return products.reduce((count, product) => count + product.casePackIds.filter(packId => (
      stockState(getAvailableStock(product.id, packId)) !== 'healthy'
    )).length, 0);
  }, [products, getAvailableStock]);

  const value = {
    ...data, isLoggedIn, currentUser, sessionMessage, busy, dataError, refreshData,
    login, logout, saveCustomer, createOrder, editPendingInvoice, updateOrderStatus,
    recordCustomerPayment, addRestockRecord, addProduct, updateProductInventory, deleteProduct,
    getAvailableStock, getTodaySales, getPendingOrdersCount, getCompletedOrdersCount, getOutstandingBalance, getLowStockCount,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
