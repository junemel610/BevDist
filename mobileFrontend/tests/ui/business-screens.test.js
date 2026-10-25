import React from 'react';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useApp } from '../../src/context/AppContext';
import { confirmAction } from '../../src/utils/confirmAction';
import { exportInvoicePdf, exportInvoiceExcel } from '../../src/components/orders/invoiceExport';
import { appFixture, navigationFixture } from './fixtures';
import { OrdersScreen } from '../../src/screens/OrdersScreen';
import { CustomerProfilesScreen } from '../../src/screens/CustomerProfilesScreen';
import { InventoryScreen } from '../../src/screens/InventoryScreen';
import { SupplierOrdersScreen } from '../../src/screens/SupplierOrdersScreen';
import { BalancesScreen } from '../../src/screens/BalancesScreen';
import { CustomerCreditsScreen } from '../../src/screens/CustomerCreditsScreen';
import { GCashTransactionsScreen } from '../../src/screens/GCashTransactionsScreen';
import { DashboardScreen } from '../../src/screens/DashboardScreen';

jest.mock('../../src/context/AppContext', () => ({ useApp: jest.fn() }));
jest.mock('../../src/utils/confirmAction', () => ({ confirmAction: jest.fn() }));
jest.mock('../../src/components/orders/invoiceExport', () => ({ exportInvoicePdf: jest.fn(), exportInvoiceExcel: jest.fn() }));
let app, navigation;
beforeEach(() => { app = appFixture(); navigation = navigationFixture(); useApp.mockReturnValue(app); });
const confirm = async () => act(async () => { await confirmAction.mock.calls.at(-1)[0].onConfirm(); });

function invoiceScreen(params = {}) { return render(<OrdersScreen navigation={navigation} route={{ params }} />); }

test('invoice quantity is typable, rejects quarter cases and overstock, and creates only after confirmation', async () => {
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  const input = screen.getByLabelText('Cola, A · 12 bottles/case, quantity in cases');
  await fireEvent.changeText(input, '0.25');
  expect(screen.getByText('Use half-case steps: 0.5, 1, 1.5…')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: 'Create invoice', exact: true }).at(-1)).toBeDisabled();
  await fireEvent.changeText(input, '9');
  expect(screen.getByText('Only 8 cases available.')).toBeOnTheScreen();
  await fireEvent.changeText(input, '1.5');
  await userEvent.press(screen.getAllByRole('button', { name: 'Create invoice', exact: true }).at(-1));
  expect(app.createOrder).not.toHaveBeenCalled();
  await confirm();
  expect(app.createOrder).toHaveBeenCalledWith(app.customers[0], [expect.objectContaining({ quantity: 1.5, packId: 'A' })], []);
});

test('invoice details show delivery status and open a zero-valued oldest-first payment form', async () => {
  await invoiceScreen();
  expect(screen.getByText('Not delivered')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: /View details/ }));
  await userEvent.press(screen.getByRole('button', { name: 'Record payment' }));
  expect(screen.getByLabelText('Payment received in pesos')).toHaveDisplayValue('0');
  expect(screen.getByText(/oldest invoices first/)).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Payment received in pesos'), '200');
  await userEvent.press(screen.getByRole('radio', { name: 'GCash' }));
  await userEvent.press(screen.getByRole('button', { name: 'Record payment' }));
  expect(app.recordCustomerPayment).not.toHaveBeenCalled();
  await confirm();
  expect(app.recordCustomerPayment).toHaveBeenCalledWith({ id: 'customer-1' }, 200, 'GCash');
});

test('completed invoice shows delivery and hides payment and edit actions', async () => {
  app.orders[0] = { ...app.orders[0], status: 'completed', deliveryStatus: 'delivered' };
  app.balances[0] = { ...app.balances[0], amountPaid: 200, remainingBalance: 0, status: 'paid' };
  await invoiceScreen();
  expect(screen.getByText('Delivered')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: /View details/ }));
  expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeOnTheScreen();
  expect(screen.queryByText('Edit invoice')).not.toBeOnTheScreen();
});

test('customer editor validates name and confirms before saving a new profile', async () => {
  await render(<CustomerProfilesScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Add customer' }));
  await userEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  expect(screen.getByText('Enter a customer name.')).toBeOnTheScreen();
  await userEvent.type(screen.getByLabelText('Customer name, required'), 'Ben Store');
  await userEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  expect(app.saveCustomer).not.toHaveBeenCalled();
  await confirm();
  expect(app.saveCustomer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ben Store' }));
});

test('inventory search filters products and Edit opens labelled stock/price fields', async () => {
  await render(<InventoryScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Edit Cola inventory' }));
  expect(screen.getByLabelText('A · 12 bottles/case quantity in cases')).toHaveDisplayValue('10');
  expect(screen.getByLabelText('A · 12 bottles/case selling price per case in pesos')).toHaveDisplayValue('100');
  await fireEvent.changeText(screen.getByLabelText('Stock count reason'), 'Count correction');
  await userEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  expect(app.updateProductInventory).not.toHaveBeenCalled();
  await confirm();
  expect(app.updateProductInventory).toHaveBeenCalledWith('product-1', expect.objectContaining({ stockReason: 'Count correction' }), app.products[0]);
});

test('balances open payments at zero and prevent a zero-value submission', async () => {
  await render(<BalancesScreen navigation={navigation} />);
  await userEvent.press(screen.getByRole('button', { name: /Record customer payment/ }));
  expect(screen.getByLabelText('Payment received in pesos')).toHaveDisplayValue('0');
  await userEvent.press(screen.getByRole('button', { name: 'Record payment', exact: true }));
  expect(screen.getByText(/Enter an amount above/)).toBeOnTheScreen();
  expect(app.recordCustomerPayment).not.toHaveBeenCalled();
});

test('customer credits are searchable and balances link to the full list', async () => {
  app.customerCredits = { 'customer:customer-1': 75 };
  const rendered = await render(<BalancesScreen navigation={navigation} />);
  await userEvent.press(screen.getByRole('button', { name: /View 1 customer/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('CustomerCredits');
  await rendered.unmount();
  await render(<CustomerCreditsScreen />);
  expect(screen.getByText('Ana Store')).toBeOnTheScreen();
  await userEvent.type(screen.getByLabelText('Search customer credits'), 'missing');
  expect(screen.getByText('No matching customers.')).toBeOnTheScreen();
});

test('GCash page excludes cash receipts and retains excess credit', async () => {
  app.paymentTransactions = [
    { id: 'g', customerName: 'GCash customer', invoiceNumber: 'INV-G', date: '2026-10-24', method: 'GCash', amountApplied: 100, amountReceived: 120, excess: 20 },
    { id: 'c', customerName: 'Cash customer', invoiceNumber: 'INV-C', date: '2026-10-24', method: 'Cash', amountApplied: 10, amountReceived: 10, excess: 0 },
  ];
  await render(<GCashTransactionsScreen />);
  expect(screen.getByText('GCash customer')).toBeOnTheScreen();
  expect(screen.queryByText('Cash customer')).not.toBeOnTheScreen();
  expect(screen.getByText('₱20 credit for next invoice')).toBeOnTheScreen();
});

test('dashboard shows payment methods and quick create opens the invoice modal route', async () => {
  await render(<DashboardScreen navigation={navigation} />);
  expect(screen.getByText('Payments today')).toBeOnTheScreen();
  for (const method of ['Cash','GCash','Bank Transfer']) expect(screen.getByText(method)).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: /Create Invoice/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('Invoices', expect.objectContaining({ screen: 'InvoicesMain', params: expect.objectContaining({ openCreateInvoiceToken: expect.any(Number) }) }));
});

test('supplier order validates empty orders before creating a receipt', async () => {
  await render(<SupplierOrdersScreen />);
  await userEvent.press(screen.getByRole('button', { name: /Save supplier order|Save order/ }));
  expect(screen.getByText('Add at least one product line before saving.')).toBeOnTheScreen();
  expect(app.addRestockRecord).not.toHaveBeenCalled();
});

test('delivery and cancellation each require confirmation before changing an invoice', async () => {
  app.balances[0] = { ...app.balances[0], amountPaid: 0, remainingBalance: 200 };
  await invoiceScreen();
  await userEvent.press(screen.getByRole('button', { name: /View details/ }));
  await userEvent.press(screen.getByText('Mark delivered', { exact: true }));
  expect(app.updateOrderStatus).not.toHaveBeenCalled();
  await confirm();
  expect(app.updateOrderStatus).toHaveBeenCalledWith('invoice-1', 'completed');
  await userEvent.press(screen.getByRole('button', { name: /View details/ }));
  await userEvent.press(screen.getByText('Cancel invoice', { exact: true }));
  expect(app.updateOrderStatus).toHaveBeenCalledTimes(1);
  await confirm();
  expect(app.updateOrderStatus).toHaveBeenLastCalledWith('invoice-1', 'cancelled');
});

test('invoice return rows allow editable types, quantities and refund rates', async () => {
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  await fireEvent.changeText(screen.getByLabelText('Cola, A · 12 bottles/case, quantity in cases'), '1');
  await userEvent.press(screen.getByRole('button', { name: 'Add returned case type' }));
  await fireEvent.changeText(screen.getByLabelText('Return type, row 1'), 'A empty case');
  await fireEvent.changeText(screen.getByLabelText('Returned cases, row 1'), '0.5');
  await fireEvent.changeText(screen.getByLabelText('Refund per case, row 1'), '20');
  await userEvent.press(screen.getAllByRole('button', { name: 'Create invoice', exact: true }).at(-1));
  await confirm();
  expect(app.createOrder).toHaveBeenCalledWith(app.customers[0], expect.any(Array), [{ type: 'A empty case', quantity: 0.5, refundPerCase: 20 }]);
});

test('supplier order accepts half cases, confirms saving and opens historical details', async () => {
  app.restockRecords = [{ id: 'history-1', supplier: 'Supplier One', date: '2026-10-24', items: [{ productName: 'Historic Cola', packLabel: 'A', quantity: 1, unitCost: 80 }], returnedCases: [], netCost: 80 }];
  await render(<SupplierOrdersScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Add product' }));
  await userEvent.press(screen.getByRole('button', { name: /Cola/ }));
  await fireEvent.changeText(screen.getByLabelText('Cola quantity in cases'), '0.5');
  await fireEvent.changeText(screen.getByLabelText('Cola supplier cost per case in pesos'), '80');
  await userEvent.press(screen.getByRole('button', { name: /Save supplier order|Save order/ }));
  expect(app.addRestockRecord).not.toHaveBeenCalled();
  await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(app.suppliers[0], [expect.objectContaining({ quantity: 0.5, unitCost: 80, packId: 'A' })], [], []);
  await userEvent.press(screen.getByRole('button', { name: 'View Supplier One supplier order from 2026-10-24' }));
  expect(screen.getByText('Historic Cola')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Close supplier order details' }));
  expect(screen.queryByText('Historic Cola')).not.toBeOnTheScreen();
});

test('zero-stock products can be deleted only after explicit confirmation', async () => {
  app.products[0].stockByCasePack.A = { totalStock: 0, reservedStock: 0 };
  await render(<InventoryScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Edit Cola inventory' }));
  await userEvent.press(screen.getByRole('button', { name: 'Delete', exact: true }));
  expect(app.deleteProduct).not.toHaveBeenCalled();
  await confirm();
  expect(app.deleteProduct).toHaveBeenCalledWith('product-1');
});

test('invoice preview routes PDF and Excel actions to the selected invoice exporter', async () => {
  await invoiceScreen();
  await userEvent.press(screen.getByRole('button', { name: /View details/ }));
  await userEvent.press(screen.getByText('Preview / export invoice'));
  await userEvent.press(screen.getByRole('button', { name: 'Export INV-001 as PDF' }));
  expect(exportInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'invoice-1' }), expect.objectContaining({ orderId: 'invoice-1' }));
  await userEvent.press(screen.getByRole('button', { name: 'Export INV-001 as Excel' }));
  expect(exportInvoiceExcel).toHaveBeenCalledWith(expect.objectContaining({ id: 'invoice-1' }), expect.any(Object));
});

test('inventory filters expose their selected state and search can be cleared', async () => {
  app.products[0].stockByCasePack.A.totalStock = 30;
  await render(<InventoryScreen />);
  await userEvent.press(screen.getByRole('button', { name: /^In stock/ }));
  expect(screen.getByRole('button', { name: /^In stock/, selected: true })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Search inventory by product or supplier'), 'missing');
  expect(screen.queryByRole('button', { name: 'Edit Cola inventory' })).not.toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('button', { name: 'Edit Cola inventory' })).toBeOnTheScreen();
});
