import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { AppProvider, useApp } from '../../src/context/AppContext';
import * as api from '../../src/api/index';
import { setAuthToken, setUnauthorizedHandler } from '../../src/api/client';
import { appFixture } from './fixtures';

jest.mock('../../src/api/index', () => ({
  authAPI: { login: jest.fn(), logout: jest.fn() }, appDataAPI: { get: jest.fn() },
  customersAPI: { create: jest.fn(), update: jest.fn() },
  invoicesAPI: { create: jest.fn(), update: jest.fn(), deliver: jest.fn(), cancel: jest.fn() },
  paymentsAPI: { create: jest.fn() }, supplierOrdersAPI: { create: jest.fn() },
  productsAPI: { create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));
jest.mock('../../src/api/client', () => ({ setAuthToken: jest.fn(), setUnauthorizedHandler: jest.fn() }));
let snapshot;
beforeEach(() => {
  snapshot = appFixture();
  api.authAPI.login.mockResolvedValue({ data: { user: { username: 'operator' } } });
  api.authAPI.logout.mockResolvedValue({});
  api.appDataAPI.get.mockResolvedValue({ data: snapshot });
});
const mount = () => renderHook(() => useApp(), { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> });
async function signedIn() {
  const hook = await mount();
  await act(async () => { await hook.result.current.login(' operator ', 'password'); });
  return hook;
}

test('login loads persisted records and logout clears all session data', async () => {
  const { result } = await signedIn();
  expect(api.authAPI.login).toHaveBeenCalledWith('operator', 'password');
  expect(result.current.isLoggedIn).toBe(true);
  expect(result.current.currentUser).toBe('operator');
  expect(result.current.products).toEqual(snapshot.products);
  await act(async () => { await result.current.logout(); });
  expect(result.current.isLoggedIn).toBe(false);
  expect(result.current.orders).toEqual([]);
  expect(setAuthToken).toHaveBeenLastCalledWith(null);
});

test('failed bootstrap clears authentication instead of showing stale records', async () => {
  api.appDataAPI.get.mockRejectedValueOnce(new Error('Offline'));
  const { result } = await mount();
  await act(async () => { await expect(result.current.login('operator', 'password')).rejects.toThrow('Offline'); });
  expect(result.current.isLoggedIn).toBe(false);
  expect(result.current.products).toEqual([]);
});

test('expired sessions clear records and show a sign-in message', async () => {
  const { result } = await signedIn();
  await act(async () => { setUnauthorizedHandler.mock.calls.at(-1)[0](); });
  expect(result.current.isLoggedIn).toBe(false);
  expect(result.current.customers).toEqual([]);
  expect(result.current.sessionMessage).toMatch(/expired/);
});

test('saved changes refresh records; a failed refresh blocks more writes until recovery', async () => {
  const { result } = await signedIn();
  api.customersAPI.create.mockResolvedValue({ data: snapshot.customers[0] });
  api.appDataAPI.get.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { await expect(result.current.saveCustomer({ name: 'Ana' })).rejects.toThrow('saved'); });
  expect(result.current.dataError).toMatch(/saved/);
  await act(async () => { await expect(result.current.saveCustomer({ name: 'Ana' })).rejects.toThrow('Refresh'); });
  expect(api.customersAPI.create).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.refreshData(); });
  expect(result.current.dataError).toBe('');
  await act(async () => { await result.current.saveCustomer({ name: 'Ana' }); });
  expect(api.customersAPI.create).toHaveBeenCalledTimes(2);
});

test('an uncertain network save blocks retry while a rejected validation does not', async () => {
  const { result } = await signedIn();
  api.customersAPI.create.mockRejectedValueOnce(Object.assign(new Error('Invalid'), { response: { status: 400 } }));
  await act(async () => { await expect(result.current.saveCustomer({ name: '' })).rejects.toThrow('Invalid'); });
  expect(result.current.dataError).toBe('');
  api.customersAPI.create.mockRejectedValueOnce(new Error('Network'));
  await act(async () => { await expect(result.current.saveCustomer({ name: 'Ana' })).rejects.toThrow('Network'); });
  expect(result.current.dataError).toMatch(/could not be confirmed/);
});

test('duplicate submissions are blocked and busy resets after completion', async () => {
  const { result } = await signedIn();
  let resolveSave;
  api.customersAPI.create.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve; }));
  let saving;
  await act(async () => { saving = result.current.saveCustomer({ name: 'Ana' }); });
  expect(result.current.busy).toBe(true);
  await act(async () => { await expect(result.current.saveCustomer({ name: 'Ana' })).rejects.toThrow('still running'); });
  await act(async () => { resolveSave({ data: snapshot.customers[0] }); await saving; });
  expect(result.current.busy).toBe(false);
  expect(api.customersAPI.create).toHaveBeenCalledTimes(1);
});

test('failed server logout still clears the local authenticated session', async () => {
  const { result } = await signedIn();
  api.authAPI.logout.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { await result.current.logout(); });
  expect(result.current.isLoggedIn).toBe(false);
  expect(result.current.busy).toBe(false);
});

test('invoice, payment, supplier and inventory operations use API results and refreshed snapshots', async () => {
  const { result } = await signedIn();
  const [customer] = snapshot.customers, [order] = snapshot.orders, [product] = snapshot.products;
  api.invoicesAPI.create.mockResolvedValue({ data: { id: order.id } });
  api.invoicesAPI.update.mockResolvedValue({});
  api.invoicesAPI.deliver.mockResolvedValue({});
  api.invoicesAPI.cancel.mockResolvedValue({});
  api.paymentsAPI.create.mockResolvedValue({ data: { id: 'receipt' } });
  snapshot.payments = [{ id: 'receipt', amountReceived: 200, allocations: [{ amountApplied: 150 }] }];
  api.supplierOrdersAPI.create.mockResolvedValue({});
  api.productsAPI.create.mockResolvedValue({ data: { id: product.id } });
  api.productsAPI.update.mockResolvedValue({});
  api.productsAPI.remove.mockResolvedValue({});
  await act(async () => {
    expect(await result.current.createOrder(customer, order.items)).toMatchObject({ id: order.id });
    expect(await result.current.editPendingInvoice(order.id, order.items, [])).toHaveProperty('order.id', order.id);
    await result.current.updateOrderStatus(order.id, 'delivered');
    await result.current.updateOrderStatus(order.id, 'cancelled');
    expect(await result.current.recordCustomerPayment(customer, 200, 'Bank Transfer')).toEqual({ applied: 150, excess: 50 });
    await result.current.addRestockRecord('Supplier One', [], {});
    expect(await result.current.addProduct(product)).toEqual(product);
    expect(await result.current.updateProductInventory(product.id, product, product)).toEqual(product);
    expect(await result.current.deleteProduct(product.id)).toBe(true);
  });
  expect(api.invoicesAPI.deliver).toHaveBeenCalledWith(order.id);
  expect(api.invoicesAPI.cancel).toHaveBeenCalledWith(order.id, 'Cancelled by operator');
  expect(api.paymentsAPI.create).toHaveBeenCalledWith(customer.id, expect.objectContaining({ method: 'Bank Transfer', amountReceived: 200 }));
  expect(api.appDataAPI.get).toHaveBeenCalledTimes(10);
});
