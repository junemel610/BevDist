import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { InventoryScreen } from '../../src/screens/InventoryScreen';
import { SupplierOrdersScreen } from '../../src/screens/SupplierOrdersScreen';
import { useApp } from '../../src/context/AppContext';
import { confirmAction } from '../../src/utils/confirmAction';
import { appFixture } from './fixtures';

jest.mock('../../src/context/AppContext', () => ({ useApp: jest.fn() }));
jest.mock('../../src/utils/confirmAction', () => ({ confirmAction: jest.fn() }));
let app;
beforeEach(() => { jest.clearAllMocks(); app = appFixture(); useApp.mockReturnValue(app); });
const press = name => fireEvent.press(screen.getByRole('button', { name, exact: true }));
const fill = (label, value) => fireEvent.changeText(screen.getByLabelText(label), value);
const confirm = () => act(async () => { await confirmAction.mock.calls.at(-1)[0].onConfirm(); });
async function stockForm() {
  await render(<InventoryScreen />);
  await press('Add product');
  await fill('Product name', 'New Cola');
  await fill('Case quantity in cases', '0.5');
  await fill('Case selling price per case in pesos', '120');
}
const saveProduct = () => fireEvent.press(screen.getAllByRole('button', { name: 'Add product', exact: true }).at(-1));
async function receiptLine() {
  await render(<SupplierOrdersScreen />);
  await press('Create supplier order');
  await press('Add product');
  await fireEvent.press(screen.getByRole('button', { name: /Cola/ }));
  await fill('Cola quantity in cases', '1');
  await fill('Cola supplier cost per case in pesos', '100');
}

test('price entry shows a peso prefix and uses a short numeric hint', async () => {
  await stockForm();
  expect(screen.getAllByText('₱').length).toBeGreaterThan(0);
  const price = screen.getByLabelText('Case selling price per case in pesos');
  expect(price.props.placeholder).toBe('0');
  expect(price.props.placeholderTextColor).toBe('#94a3b8');
});

test('supplier cost entry shows a peso prefix and uses a short numeric hint', async () => {
  await receiptLine();
  expect(screen.getAllByText('₱').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Cola supplier cost per case in pesos').props.placeholder).toBe('0');
});

test('inventory starts supplier cost at selling price and saves later edits independently', async () => {
  await stockForm();
  await fireEvent.press(screen.getByRole('radio', { name: 'Select supplier Supplier One' }));
  const supplierCost = screen.getByLabelText('Case supplier cost per case in pesos');
  expect(supplierCost).toHaveDisplayValue('120');
  await fill('Case supplier cost per case in pesos', '105');
  await saveProduct();
  await confirm();
  expect(app.addProduct).toHaveBeenCalledWith(expect.objectContaining({
    casePrices: { B: '120' }, supplierCosts: { B: '105' },
  }));
});

test('stock supplier search includes suppliers without products and saves their ID after confirmation', async () => {
  app.suppliers.push({ id: 'supplier-2', name: 'Empty Supplier' });
  await stockForm();
  await fill('Search saved suppliers', 'empty');
  expect(screen.queryByRole('radio', { name: 'Select supplier Supplier One' })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Select supplier Empty Supplier' }));
  await saveProduct();
  expect(app.addProduct).not.toHaveBeenCalled();
  await confirm();
  expect(app.addProduct).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'supplier-2', supplier: 'Empty Supplier', casePackIds: ['B'] }));
});

test('stock supplier modes prevent a hidden saved selection from overriding a new supplier', async () => {
  await stockForm();
  await fireEvent.press(screen.getByRole('radio', { name: 'Select supplier Supplier One' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'New supplier', exact: true }));
  await fill('Supplier name', 'New Warehouse');
  await saveProduct(); await confirm();
  expect(app.addProduct).toHaveBeenCalledWith(expect.objectContaining({ supplier: 'New Warehouse', supplierId: undefined }));
});

test('stock validates supplier selection, empty search, and duplicate manual supplier names', async () => {
  await stockForm();
  await saveProduct();
  expect(screen.getByText('Product name and supplier are required.')).toBeOnTheScreen();
  await fill('Search saved suppliers', 'missing');
  expect(screen.getByText(/No suppliers found/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'New supplier', exact: true }));
  await fill('Supplier name', ' supplier one ');
  await saveProduct();
  expect(screen.getByText('This supplier is already saved. Choose Existing supplier.')).toBeOnTheScreen();
  expect(confirmAction).not.toHaveBeenCalled();
  await press('Cancel');
  expect(app.addProduct).not.toHaveBeenCalled();
});

test('empty supplier catalog starts manual entry and reopening clears an abandoned product draft', async () => {
  app.suppliers = [];
  await stockForm();
  expect(screen.getByLabelText('Supplier name')).toBeOnTheScreen();
  await fill('Supplier name', 'Unsaved');
  await press('Close inventory editor');
  await press('Add product');
  expect(screen.getByLabelText('Product name').props.value).toBe('');
  expect(screen.getByLabelText('Supplier name').props.value).toBe('');
  expect(app.addProduct).not.toHaveBeenCalled();
});

test('stock product editor keeps the single generic case unit', async () => {
  await stockForm();
  await fireEvent.press(screen.getByRole('radio', { name: 'Select supplier Supplier One' }));
  expect(screen.getAllByText('Case').length).toBeGreaterThan(0);
  expect(screen.queryByText(/Add case type/)).toBeNull();
  await saveProduct(); await confirm();
  expect(app.addProduct).toHaveBeenCalledWith(expect.objectContaining({ casePackIds: ['B'] }));
});

test('opening and closing a new supplier preserves the receipt draft', async () => {
  await receiptLine();
  await press('New supplier');
  await press('Use supplier in this order');
  expect(screen.getAllByText('Enter a supplier name.').length).toBeGreaterThan(0);
  await fill('New supplier name', 'supplier one');
  await press('Use supplier in this order');
  expect(screen.getAllByText(/A supplier with this name already exists/).length).toBeGreaterThan(0);
  await press('Close new supplier form');
  expect(screen.getByLabelText('Cola quantity in cases').props.value).toBe('1');
  expect(app.addRestockRecord).not.toHaveBeenCalled();
});

test('new supplier and single-pack product are saved together with a supplier receipt', async () => {
  await render(<SupplierOrdersScreen />);
  await press('Create supplier order');
  await press('New supplier'); await fill('New supplier name', 'New Depot'); await press('Use supplier in this order');
  await press('Add product'); await fireEvent.press(screen.getByRole('button', { name: /Create a new product/ }));
  await fill('New product name', 'New Drink');
  await fill('Case selling price per case in pesos', '100');
  await press('Add product lines');
  expect(app.addRestockRecord).not.toHaveBeenCalled();
  await fill('New Drink quantity in cases', '0.5'); await fill('New Drink supplier cost per case in pesos', '40');
  await press('Save supplier order'); await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Depot' }), [], [], [{ name: 'New Drink', packs: [{ packId: 'B', casePrice: 100, quantity: 0.5, unitCost: 40 }] }]);
});

test('return lines can be named, use half-case controls and validate refund per case', async () => {
  await receiptLine();
  await press('Add return line');
  expect(screen.getByRole('button', { name: 'Decrease quantity for return line 1' })).toBeDisabled();
  await press('Increase quantity for return line 1');
  await fill('Return line 1 container or item', 'Bottle crate');
  await fill('Returned cases, row 1', '0.25');
  await press('Save supplier order');
  expect(screen.getByText('Returned quantities must use half-case steps, starting at 0.5 case.')).toBeOnTheScreen();
  expect(confirmAction).not.toHaveBeenCalled();
  await fill('Returned cases, row 1', '0.5');
  await press('Save supplier order');
  expect(screen.getByText('Enter a refund per case for each returned item.')).toBeOnTheScreen();
  for (const price of ['-1', '1.001', 'abc', '0']) {
    await fill('Return line 1 refund per case in pesos', price); await press('Save supplier order');
    expect(confirmAction).not.toHaveBeenCalled();
  }
  await fill('Return line 1 refund per case in pesos', '201'); await press('Save supplier order');
  expect(screen.getByText('Return credits cannot exceed the product cost.')).toBeOnTheScreen();
  await fill('Return line 1 refund per case in pesos', '20'); await press('Save supplier order'); await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(app.suppliers[0], expect.any(Array), [{ type: 'Bottle crate', quantity: 0.5, creditPerUnit: 20 }], []);
});

test('empty return lines do not require a name or price and can be removed', async () => {
  await receiptLine();
  await press('Add return line');
  await fill('Return line 1 refund per case in pesos', '99');
  await press('Remove return line 1');
  await press('Save supplier order'); await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(app.suppliers[0], expect.any(Array), [], []);
});
