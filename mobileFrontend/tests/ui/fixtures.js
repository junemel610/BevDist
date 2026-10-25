export function appFixture(overrides = {}) {
  const customer = { id: 'customer-1', name: 'Ana Store', contact: '09123456789', address: 'Pasig' };
  const product = { id: 'product-1', name: 'Cola', supplier: 'Supplier One', supplierId: 'supplier-1', casePackIds: ['A'], casePrices: { A: 100 }, stockByCasePack: { A: { totalStock: 10, reservedStock: 2, lowStockThreshold: 15 } } };
  const item = { productId: product.id, productName: product.name, packId: 'A', packLabel: 'A', unitsPerCase: 12, quantity: 2, stockQuantity: 2, casePrice: 100 };
  const order = { id: 'invoice-1', orderNumber: 'INV-001', invoiceNumber: 'INV-001', customerId: customer.id, customer, items: [item], subtotal: 200, grandTotal: 200, containerRefundTotal: 0, containerReturns: [], status: 'pending', deliveryStatus: 'pending', date: '2026-10-24' };
  const balance = { id: order.id, orderId: order.id, customerId: customer.id, customerName: customer.name, invoiceNumber: order.invoiceNumber, totalAmount: 200, amountPaid: 50, appliedCredit: 0, remainingBalance: 150, dueDate: '2099-12-31', status: 'unpaid' };
  return {
    isLoggedIn: true, currentUser: 'operator', sessionMessage: '', busy: false, dataError: '',
    products: [product], customers: [customer], suppliers: [{ id: 'supplier-1', name: 'Supplier One' }],
    orders: [order], balances: [balance], payments: [], paymentTransactions: [], customerCredits: {}, restockRecords: [],
    getAvailableStock: jest.fn(() => 8), getTodaySales: jest.fn(() => 0), getLowStockCount: jest.fn(() => 1),
    login: jest.fn().mockResolvedValue(), logout: jest.fn().mockResolvedValue(), refreshData: jest.fn().mockResolvedValue(),
    saveCustomer: jest.fn().mockResolvedValue(customer), createOrder: jest.fn().mockResolvedValue({ ...order, products: [product] }),
    editPendingInvoice: jest.fn().mockResolvedValue({ order, products: [product] }), updateOrderStatus: jest.fn().mockResolvedValue(true),
    recordCustomerPayment: jest.fn().mockResolvedValue({ applied: 150, excess: 50 }),
    addProduct: jest.fn().mockResolvedValue(product), updateProductInventory: jest.fn().mockResolvedValue(product), deleteProduct: jest.fn().mockResolvedValue(true),
    addRestockRecord: jest.fn().mockResolvedValue({ id: 'restock-1' }), ...overrides,
  };
}
export function navigationFixture() {
  const navigate = jest.fn();
  return { navigate, getParent: () => ({ navigate }), setParams: jest.fn() };
}
