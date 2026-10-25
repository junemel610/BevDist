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
  await fireEvent.press(screen.getByRole('checkbox', { name: /A · 12 bottles/ }));
  await fill('A · 12 bottles per case quantity in cases', '0.5');
  await fill('A · 12 bottles per case selling price per case in pesos', '120');
}
const saveProduct = () => fireEvent.press(screen.getAllByRole('button', { name: 'Add product', exact: true }).at(-1));
async function receiptLine() {
  await render(<SupplierOrdersScreen />);
  await press('Add product');
  await fireEvent.press(screen.getByRole('button', { name: /Cola/ }));
  await fill('Cola quantity in cases', '1');
  await fill('Cola supplier cost per case in pesos', '100');
}

test('price entry shows a peso prefix and uses a short numeric hint', async () => {
  await stockForm();
  expect(screen.getAllByText('₱').length).toBeGreaterThan(0);
  const price = screen.getByLabelText('A · 12 bottles per case selling price per case in pesos');
  expect(price.props.placeholder).toBe('0');
  expect(price.props.placeholderTextColor).toBe('#94a3b8');
});

test('supplier cost entry shows a peso prefix and uses a short numeric hint', async () => {
  await receiptLine();
  expect(screen.getAllByText('₱').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Cola supplier cost per case in pesos').props.placeholder).toBe('0');
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
  expect(app.addProduct).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'supplier-2', supplier: 'Empty Supplier', casePackIds: ['A'] }));
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

test('stock product editor assigns the next alphabetic case name and its bottle count', async () => {
  await stockForm();
  await fireEvent.press(screen.getByRole('radio', { name: 'Select supplier Supplier One' }));
  expect(screen.getByText('Bottles per case')).toBeOnTheScreen();
  expect(screen.getByText('Add case type D')).toBeOnTheScreen();
  await fill('Custom bottles per case', '18 bottles');
  expect(screen.getByLabelText('Custom bottles per case').props.value).toBe('18');
  await press('Add custom case type');
  expect(screen.getAllByText('D · 18 bottles per case').length).toBeGreaterThan(0);
  await press('Remove case type D');
  expect(screen.queryByText('D · 18 bottles per case')).toBeNull();
  expect(screen.getByText('Add case type D')).toBeOnTheScreen();
  await fill('Custom bottles per case', '18');
  await press('Add custom case type');
  await fill('D · 18 bottles per case quantity in cases', '0.5');
  await fill('D · 18 bottles per case selling price per case in pesos', '750');
  await saveProduct(); await confirm();
  expect(app.addProduct).toHaveBeenCalledWith(expect.objectContaining({
    casePackIds: expect.arrayContaining(['A', expect.stringMatching(/^CUSTOM_[A-F0-9]{32}$/)]),
    newCasePackTypes: [expect.objectContaining({ label: 'D', unitsPerCase: 18 })],
  }));
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

test('new supplier plus multi-pack product stays local, and removing one pack preserves the other', async () => {
  await render(<SupplierOrdersScreen />);
  await press('New supplier'); await fill('New supplier name', 'New Depot'); await press('Use supplier in this order');
  await press('Add product'); await fireEvent.press(screen.getByRole('button', { name: /Create a new product/ }));
  await fill('New product name', 'New Drink');
  for (const label of ['A · 12 bottles per case', 'B · 24 bottles per case']) {
    await fireEvent.press(screen.getByRole('checkbox', { name: label }));
    await fill(`${label} selling price per case in pesos`, '100');
  }
  await press('Add product lines');
  expect(app.addRestockRecord).not.toHaveBeenCalled();
  await press('Remove New Drink A · 12 bottles per case');
  await fill('New Drink quantity in cases', '0.5'); await fill('New Drink supplier cost per case in pesos', '40');
  await press('Save supplier order'); await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Depot' }), [], [], [{ name: 'New Drink', packs: [{ packId: 'B', casePrice: 100, quantity: 0.5, unitCost: 40 }] }]);
});

test('return steppers stop at zero and require a valid manual price without exceeding purchase cost', async () => {
  await receiptLine();
  expect(screen.getByRole('button', { name: 'Remove half case of Case Type A' })).toBeDisabled();
  await press('Add half case of Case Type A');
  await press('Save supplier order');
  expect(screen.getByText('Enter a credit price for each returned case type with a quantity.')).toBeOnTheScreen();
  for (const price of ['-1', '1.001', 'abc', '0']) {
    await fill('Case Type A return credit per case', price); await press('Save supplier order');
    expect(confirmAction).not.toHaveBeenCalled();
  }
  await fill('Case Type A return credit per case', '201'); await press('Save supplier order');
  expect(screen.getByText('Return credits cannot exceed the product cost.')).toBeOnTheScreen();
  await fill('Case Type A return credit per case', '20'); await press('Save supplier order'); await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(app.suppliers[0], expect.any(Array), [{ type: 'Case Type A', quantity: 0.5, creditPerUnit: 20 }], []);
});

test('zero-quantity returns do not require prices or create credits', async () => {
  await receiptLine();
  await press('Add half case of Case Type A'); await press('Remove half case of Case Type A');
  await fill('Case Type B return credit per case', '99');
  await press('Save supplier order'); await confirm();
  expect(app.addRestockRecord).toHaveBeenCalledWith(app.suppliers[0], expect.any(Array), [], []);
});
