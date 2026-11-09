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
import { BankTransferTransactionsScreen } from '../../src/screens/BankTransferTransactionsScreen';
import { DashboardScreen } from '../../src/screens/DashboardScreen';

jest.mock('../../src/context/AppContext', () => ({ useApp: jest.fn() }));
jest.mock('../../src/utils/confirmAction', () => ({ confirmAction: jest.fn() }));
jest.mock('../../src/components/orders/invoiceExport', () => ({ exportInvoicePdf: jest.fn(), exportInvoiceExcel: jest.fn() }));
let app, navigation;
beforeEach(() => { app = appFixture(); navigation = navigationFixture(); useApp.mockReturnValue(app); });
const confirm = async () => act(async () => { await confirmAction.mock.calls.at(-1)[0].onConfirm(); });

function invoiceScreen(params = {}) { return render(<OrdersScreen navigation={navigation} route={{ params }} />); }
async function selectInvoiceProduct(name = 'Cola') {
  await userEvent.press(screen.getByRole('button', { name: 'Select products' }));
  await userEvent.press(screen.getByRole('button', { name: `Add ${name} to invoice` }));
  await userEvent.press(screen.getByRole('button', { name: 'Done selecting products' }));
}

test('invoice product picker filters distributor catalogs and adds saved products to the draft', async () => {
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  expect(screen.getByText("Mila's Store")).toBeOnTheScreen();
  expect(screen.getByText('737 San Diego St')).toBeOnTheScreen();
  expect(screen.getByText('Sampaloc, Manila, 1008')).toBeOnTheScreen();
  expect(screen.getByText('CP 09569569553, TEL: 856-70568')).toBeOnTheScreen();
  expect(screen.getByText('INV:')).toBeOnTheScreen();
  expect(screen.getByText(/^INV-\d{6}-\d{8}$/)).toBeOnTheScreen();
  expect(screen.getByText('QTY')).toBeOnTheScreen();
  expect(screen.getByText('PRICE')).toBeOnTheScreen();
  expect(screen.getByText('Grand total')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Select products' }));
  expect(screen.getByText('Coke Tall 8oz')).toBeOnTheScreen();
  expect(screen.getAllByText(/Not in inventory yet/).length).toBeGreaterThan(0);
  expect(screen.getByTestId('distributor-filters')).toHaveStyle({ flexGrow: 0, flexShrink: 0, maxHeight: 50 });
  expect(screen.getByRole('button', { name: 'Pepsi distributor filter' })).toHaveStyle({ borderRadius: 999, minHeight: 34 });
  await userEvent.press(screen.getByRole('button', { name: 'Pepsi distributor filter' }));
  expect(screen.getByText('Pepsi 8oz')).toBeOnTheScreen();
  expect(screen.queryByText('Coke Tall 8oz')).toBeNull();
  await userEvent.press(screen.getByRole('button', { name: 'Supplier One distributor filter' }));
  await userEvent.press(screen.getByRole('button', { name: 'Add Cola to invoice' }));
  await userEvent.press(screen.getByRole('button', { name: 'Done selecting products' }));
  expect(screen.getByLabelText('Cola, Case, quantity in cases')).toHaveDisplayValue('0.5');
});

test('catalog product opens inventory setup prefilled with its name and distributor', async () => {
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  await userEvent.press(screen.getByRole('button', { name: 'Select products' }));
  await userEvent.press(screen.getByRole('button', { name: 'Add Coke Tall 8oz to inventory' }));
  expect(navigation.navigate).toHaveBeenCalledWith('Inventory', expect.objectContaining({
    screen: 'InventoryMain',
    params: expect.objectContaining({ setupProduct: { name: 'Coke Tall 8oz', supplier: 'Coca-Cola' } }),
  }));
});

test('inventory opens a catalog product setup with supplier prefilled', async () => {
  await render(<InventoryScreen navigation={navigation} route={{ params: { setupProductToken: 10, setupProduct: { name: 'Coke Tall 8oz', supplier: 'Coca-Cola' } } }} />);
  expect(await screen.findByLabelText('Product name')).toHaveDisplayValue('Coke Tall 8oz');
  expect(await screen.findByLabelText('Supplier name')).toHaveDisplayValue('Coca-Cola');
});

test('unpriced saved catalog products must be priced before they can enter an invoice', async () => {
  app.products[0].casePrices.B = null;
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  await userEvent.press(screen.getByRole('button', { name: 'Select products' }));
  expect(screen.getByText('Selling price not set · 8 available')).toBeOnTheScreen();
  const setPrice = screen.getByRole('button', { name: 'Set price and stock for Cola in inventory' });
  expect(setPrice).toBeOnTheScreen();
  await userEvent.press(setPrice);
  expect(navigation.navigate).toHaveBeenCalledWith('Inventory', expect.objectContaining({
    params: expect.objectContaining({ setupProduct: expect.objectContaining({ productId: 'product-1' }) }),
  }));
});

test('invoice quantity is typable, rejects quarter cases and overstock, and creates only after confirmation', async () => {
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  await selectInvoiceProduct();
  const input = screen.getByLabelText('Cola, Case, quantity in cases');
  await fireEvent.changeText(input, '0.25');
  expect(screen.getByText('Use half-case steps: 0.5, 1, 1.5…')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: 'Create invoice', exact: true }).at(-1)).toBeDisabled();
  await fireEvent.changeText(input, '9');
  expect(screen.getByText('Only 8 cases available.')).toBeOnTheScreen();
  await fireEvent.changeText(input, '1.5');
  await userEvent.press(screen.getAllByRole('button', { name: 'Create invoice', exact: true }).at(-1));
  expect(app.createOrder).not.toHaveBeenCalled();
  await confirm();
  expect(app.createOrder).toHaveBeenCalledWith(app.customers[0], [expect.objectContaining({ quantity: 1.5, packId: 'B' })], []);
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

test('customer editor blocks a name that already belongs to another profile', async () => {
  await render(<CustomerProfilesScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Add customer' }));
  await userEvent.type(screen.getByLabelText('Customer name, required'), ' ana STORE ');
  await userEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  expect(screen.getByText('Ana Store already exists. Edit that customer profile instead.')).toBeOnTheScreen();
  expect(confirmAction).not.toHaveBeenCalled();
  expect(app.saveCustomer).not.toHaveBeenCalled();
});

test('invoice creation blocks a duplicate new customer and directs the user to existing profiles', async () => {
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  await selectInvoiceProduct();
  await userEvent.press(screen.getByRole('button', { name: 'New customer' }));
  await userEvent.type(screen.getByLabelText('New customer name, required'), ' ana store ');
  await fireEvent.changeText(screen.getByLabelText('Cola, Case, quantity in cases'), '0.5');
  expect(screen.getByText('Ana Store already exists. Choose Existing customer and select this profile.')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: 'Create invoice', exact: true }).at(-1)).toBeDisabled();
  expect(app.saveCustomer).not.toHaveBeenCalled();
  expect(app.createOrder).not.toHaveBeenCalled();
});

test('inventory search filters products and Edit opens labelled stock/price fields', async () => {
  await render(<InventoryScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Edit Cola inventory' }));
  expect(screen.getByLabelText('Case quantity in cases')).toHaveDisplayValue('10');
  expect(screen.getByLabelText('Case selling price per case in pesos')).toHaveDisplayValue('100');
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

test('Balance Tracker opens Bank Transfer history and excludes other payment methods', async () => {
  app.paymentTransactions = [
    { id: 'bank', customerName: 'Bank customer', invoiceNumber: 'INV-BANK', date: '2026-10-24', method: 'Bank Transfer', amountApplied: 100, amountReceived: 120, excess: 20 },
    { id: 'gcash', customerName: 'GCash customer', invoiceNumber: 'INV-GCASH', date: '2026-10-24', method: 'GCash', amountApplied: 50, amountReceived: 50, excess: 0 },
  ];
  const rendered = await render(<BalancesScreen navigation={navigation} />);
  await userEvent.press(screen.getByRole('button', { name: 'Open Bank Transfer transactions' }));
  expect(navigation.navigate).toHaveBeenCalledWith('BankTransferTransactions');
  await rendered.unmount();
  await render(<BankTransferTransactionsScreen />);
  expect(screen.getByText('Bank Transfer transactions')).toBeOnTheScreen();
  expect(screen.getByText('Bank customer')).toBeOnTheScreen();
  expect(screen.queryByText('GCash customer')).toBeNull();
  expect(screen.getByText('₱20 credit for next invoice')).toBeOnTheScreen();
});

test('dashboard shows payment methods and quick create opens the invoice modal route', async () => {
  await render(<DashboardScreen navigation={navigation} />);
  expect(screen.getByText('Sales today')).toBeOnTheScreen();
  expect(screen.getByText("Today's invoice value and cash received")).toBeOnTheScreen();
  expect(screen.getByText('Payments today')).toBeOnTheScreen();
  for (const method of ['Cash','GCash','Bank Transfer']) expect(screen.getByText(method)).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: /Create Invoice/ }));
  expect(navigation.navigate).toHaveBeenCalledWith('Invoices', expect.objectContaining({ screen: 'InvoicesMain', params: expect.objectContaining({ openCreateInvoiceToken: expect.any(Number) }) }));
});

test('supplier order validates empty orders before creating a receipt', async () => {
  await render(<SupplierOrdersScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Create supplier order', exact: true }));
  await userEvent.press(screen.getByRole('button', { name: /Save supplier order|Save order/ }));
  expect(screen.getByText('Add at least one product line before saving.')).toBeOnTheScreen();
  expect(app.addRestockRecord).not.toHaveBeenCalled();
});

test('invoice and supplier order create actions open modals from the page header', async () => {
  await invoiceScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Create invoice' }));
  expect(screen.getByText("Mila's Store")).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Close create invoice' }));

  const rendered = await render(<SupplierOrdersScreen />);
  expect(screen.getByText('Supplier order history')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Create supplier order', exact: true }));
  expect(screen.getByLabelText(/Order number ORD-\d{6}-\d{8}/)).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Close create supplier order', exact: true }));
  expect(screen.getByText('Supplier order history')).toBeOnTheScreen();
  await rendered.unmount();
});

test('supplier order history filters by custom dates and supplier and opens matching order details', async () => {
  app.restockRecords = [
    { id: 'history-pepsi', orderNumber: 'SUP-00000001', supplier: 'Pepsi', date: '2026-10-24', items: [{ productName: 'Pepsi 8oz', packLabel: 'Case', quantity: 1, unitCost: 172 }], returnedCases: [], netCost: 172 },
    { id: 'history-other', orderNumber: 'SUP-00000002', supplier: 'Supplier One', date: '2026-11-02', items: [{ productName: 'Cola', packLabel: 'Case', quantity: 1, unitCost: 80 }], returnedCases: [], netCost: 80 },
  ];
  await render(<SupplierOrdersScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Date range' }));
  await fireEvent.changeText(screen.getByLabelText('Order history start date'), '2026-10-01');
  await fireEvent.changeText(screen.getByLabelText('Order history end date'), '2026-10-31');
  await userEvent.press(screen.getByRole('button', { name: 'Pepsi' }));
  expect(screen.getByText('1 matching order')).toBeOnTheScreen();
  expect(screen.getAllByText('Pepsi').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'View Supplier One supplier order from 2026-11-02' })).toBeNull();
  await userEvent.press(screen.getByRole('button', { name: 'View Pepsi supplier order from 2026-10-24' }));
  expect(screen.getByText('Pepsi 8oz')).toBeOnTheScreen();
});

test('saved supplier cost prefills an order and remains independently editable', async () => {
  app.products[0].supplierCosts = { B: 72 };
  await render(<SupplierOrdersScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Create supplier order', exact: true }));
  await userEvent.press(screen.getByRole('button', { name: 'Add product' }));
  await userEvent.press(screen.getByRole('button', { name: /Cola/ }));
  const cost = screen.getByLabelText('Cola supplier cost per case in pesos');
  expect(cost).toHaveDisplayValue('72');
  await fireEvent.changeText(cost, '80');
  await fireEvent.changeText(screen.getByLabelText('Cola quantity in cases'), '1');
  await userEvent.press(screen.getByRole('button', { name: /Save supplier order|Save order/ }));
  await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(app.suppliers[0], [expect.objectContaining({ unitCost: 80, quantity: 1 })], [], []);
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

test('invoice deposit and return rows switch type and submit the chosen amount correctly', async () => {
  await invoiceScreen({ openCreateInvoiceToken: 1 });
  await selectInvoiceProduct();
  await fireEvent.changeText(screen.getByLabelText('Cola, Case, quantity in cases'), '1');
  await userEvent.press(screen.getByRole('button', { name: 'Add deposit or return line' }));
  expect(screen.getByLabelText('Adjustment item 1')).toBeOnTheScreen();
  expect(screen.getByText('What container or item?')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Container or item name, row 1'), 'Bottle crate');
  await userEvent.press(screen.getByRole('button', { name: 'Deposit, row 1' }));
  await userEvent.press(screen.getByRole('button', { name: 'Add half a case to deposit or return row 1' }));
  expect(screen.getByLabelText('Deposited cases, row 1')).toHaveDisplayValue('1');
  await userEvent.press(screen.getByRole('button', { name: 'Remove half a case from deposit or return row 1' }));
  await userEvent.press(screen.getByRole('button', { name: 'Add half a case to deposit or return row 1' }));
  await fireEvent.changeText(screen.getByLabelText('Deposit per case, row 1'), '20');
  expect(screen.getAllByText('₱120')).toHaveLength(3);
  await userEvent.press(screen.getAllByRole('button', { name: 'Create invoice', exact: true }).at(-1));
  await confirm();
  expect(app.createOrder).toHaveBeenCalledWith(app.customers[0], expect.any(Array), [{ kind: 'deposit', type: 'Bottle crate', quantity: 1, amountPerCase: 20 }]);
});

test('supplier order accepts half cases, confirms saving and opens historical details', async () => {
  app.restockRecords = [{ id: 'history-1', supplier: 'Supplier One', date: '2026-10-24', items: [{ productName: 'Historic Cola', packLabel: 'A', quantity: 1, unitCost: 80 }], returnedCases: [], netCost: 80 }];
  await render(<SupplierOrdersScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Create supplier order', exact: true }));
  await userEvent.press(screen.getByRole('button', { name: 'Add product' }));
  await userEvent.press(screen.getByRole('button', { name: /Cola/ }));
  await fireEvent.changeText(screen.getByLabelText('Cola quantity in cases'), '0.5');
  await fireEvent.changeText(screen.getByLabelText('Cola supplier cost per case in pesos'), '80');
  await userEvent.press(screen.getByRole('button', { name: /Save supplier order|Save order/ }));
  expect(app.addRestockRecord).not.toHaveBeenCalled();
  await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(app.suppliers[0], [expect.objectContaining({ quantity: 0.5, unitCost: 80, packId: 'B' })], [], []);
  await userEvent.press(screen.getByRole('button', { name: 'View Supplier One supplier order from 2026-10-24' }));
  expect(screen.getByText('Historic Cola')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Close supplier order details' }));
  expect(screen.queryByText('Historic Cola')).not.toBeOnTheScreen();
});

test('zero-stock products can be deleted only after explicit confirmation', async () => {
  app.products[0].stockByCasePack.B = { totalStock: 0, reservedStock: 0 };
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
  app.products[0].stockByCasePack.B.totalStock = 30;
  await render(<InventoryScreen />);
  await userEvent.press(screen.getByRole('button', { name: /^In stock/ }));
  expect(screen.getByRole('button', { name: /^In stock/, selected: true })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Search inventory by product or supplier'), 'missing');
  expect(screen.queryByRole('button', { name: 'Edit Cola inventory' })).not.toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('button', { name: 'Edit Cola inventory' })).toBeOnTheScreen();
});
