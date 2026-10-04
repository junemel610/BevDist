export const INITIAL_PRODUCTS = [
  { id: 'p1', name: 'Coca-Cola 1.5L', supplier: 'Coca-Cola', totalStock: 200, reservedStock: 30, unitPrice: 55 },
  { id: 'p2', name: 'Coca-Cola 330ml Can', supplier: 'Coca-Cola', totalStock: 500, reservedStock: 60, unitPrice: 25 },
  { id: 'p3', name: 'Sprite 1.5L', supplier: 'Coca-Cola', totalStock: 150, reservedStock: 20, unitPrice: 50 },
  { id: 'p4', name: 'Royal Tru-Orange 1.5L', supplier: 'Coca-Cola', totalStock: 8, reservedStock: 5, unitPrice: 48 },
  { id: 'p5', name: 'Magnolia Fresh Milk 1L', supplier: 'Magnolia', totalStock: 80, reservedStock: 10, unitPrice: 78 },
  { id: 'p6', name: 'Magnolia Choco Milk 250ml', supplier: 'Magnolia', totalStock: 0, reservedStock: 0, unitPrice: 35 },
  { id: 'p7', name: 'Pepsi 1.5L', supplier: 'Pepsi', totalStock: 180, reservedStock: 40, unitPrice: 52 },
  { id: 'p8', name: 'Mountain Dew 1.5L', supplier: 'Pepsi', totalStock: 12, reservedStock: 8, unitPrice: 52 },
  { id: 'p9', name: '7UP 1.5L', supplier: 'Pepsi', totalStock: 130, reservedStock: 15, unitPrice: 50 },
  { id: 'p10', name: 'Wilkins Water 500ml', supplier: 'Others', totalStock: 400, reservedStock: 0, unitPrice: 12 },
  { id: 'p11', name: 'C2 Apple Green Tea', supplier: 'Others', totalStock: 250, reservedStock: 20, unitPrice: 18 },
  { id: 'p12', name: 'Gatorade Lemon-Lime', supplier: 'Others', totalStock: 60, reservedStock: 10, unitPrice: 45 },
];

export const INITIAL_CUSTOMERS = [
  { id: 'c1', name: 'Maria Santos', contact: '09171234567', address: '123 Rizal St., Pasig City' },
  { id: 'c2', name: 'Juan Dela Cruz', contact: '09281234567', address: '456 Mabini Ave., Quezon City' },
  { id: 'c3', name: 'Ana Reyes', contact: '09391234567', address: '789 Bonifacio Blvd., Makati' },
  { id: 'c4', name: 'Roberto Gomez', contact: '09451234567', address: '321 Luna St., Marikina' },
  { id: 'c5', name: 'Lilia Cruz', contact: '09561234567', address: '654 Aguinaldo St., Taguig' },
];

export const INITIAL_ORDERS = [
  {
    id: 'o1',
    orderNumber: 'ORD-2026-001',
    customer: INITIAL_CUSTOMERS[0],
    items: [
      { productId: 'p1', productName: 'Coca-Cola 1.5L', quantity: 10, unitPrice: 55 },
      { productId: 'p2', productName: 'Coca-Cola 330ml Can', quantity: 24, unitPrice: 25 },
    ],
    subtotal: 1150,
    deposit: 500,
    grandTotal: 1150,
    status: 'pending',
    date: '2026-06-17',
  },
  {
    id: 'o2',
    orderNumber: 'ORD-2026-002',
    customer: INITIAL_CUSTOMERS[1],
    items: [
      { productId: 'p7', productName: 'Pepsi 1.5L', quantity: 20, unitPrice: 52 },
      { productId: 'p9', productName: '7UP 1.5L', quantity: 10, unitPrice: 50 },
    ],
    subtotal: 1540,
    deposit: 800,
    grandTotal: 1540,
    status: 'completed',
    date: '2026-06-16',
  },
  {
    id: 'o3',
    orderNumber: 'ORD-2026-003',
    customer: INITIAL_CUSTOMERS[2],
    items: [
      { productId: 'p5', productName: 'Magnolia Fresh Milk 1L', quantity: 12, unitPrice: 78 },
    ],
    subtotal: 936,
    deposit: 300,
    grandTotal: 936,
    status: 'pending',
    date: '2026-06-18',
  },
  {
    id: 'o4',
    orderNumber: 'ORD-2026-004',
    customer: INITIAL_CUSTOMERS[3],
    items: [
      { productId: 'p3', productName: 'Sprite 1.5L', quantity: 15, unitPrice: 50 },
      { productId: 'p10', productName: 'Wilkins Water 500ml', quantity: 48, unitPrice: 12 },
    ],
    subtotal: 1326,
    deposit: 0,
    grandTotal: 1326,
    status: 'cancelled',
    date: '2026-06-15',
  },
  {
    id: 'o5',
    orderNumber: 'ORD-2026-005',
    customer: INITIAL_CUSTOMERS[4],
    items: [
      { productId: 'p11', productName: 'C2 Apple Green Tea', quantity: 30, unitPrice: 18 },
      { productId: 'p12', productName: 'Gatorade Lemon-Lime', quantity: 10, unitPrice: 45 },
    ],
    subtotal: 990,
    deposit: 500,
    grandTotal: 990,
    status: 'completed',
    date: '2026-06-14',
  },
];

export const INITIAL_BALANCES = [
  {
    id: 'b1',
    orderId: 'o1',
    customerName: 'Maria Santos',
    invoiceNumber: 'INV-2026-001',
    totalAmount: 1150,
    amountPaid: 500,
    remainingBalance: 650,
    dueDate: '2026-06-24',
    status: 'unpaid',
  },
  {
    id: 'b2',
    orderId: 'o2',
    customerName: 'Juan Dela Cruz',
    invoiceNumber: 'INV-2026-002',
    totalAmount: 1540,
    amountPaid: 1540,
    remainingBalance: 0,
    dueDate: '2026-06-23',
    status: 'paid',
  },
  {
    id: 'b3',
    orderId: 'o3',
    customerName: 'Ana Reyes',
    invoiceNumber: 'INV-2026-003',
    totalAmount: 936,
    amountPaid: 300,
    remainingBalance: 636,
    dueDate: '2026-06-25',
    status: 'unpaid',
  },
  {
    id: 'b4',
    orderId: 'o5',
    customerName: 'Lilia Cruz',
    invoiceNumber: 'INV-2026-005',
    totalAmount: 990,
    amountPaid: 500,
    remainingBalance: 490,
    dueDate: '2026-06-21',
    status: 'overdue',
  },
];

export const INITIAL_RESTOCK_RECORDS = [
  {
    id: 'r1',
    supplier: 'Coca-Cola',
    items: [
      { productId: 'p1', productName: 'Coca-Cola 1.5L', quantity: 100, unitCost: 40 },
      { productId: 'p2', productName: 'Coca-Cola 330ml Can', quantity: 240, unitCost: 15 },
    ],
    returnedCases: [{ type: 'PET Bottle', quantity: 15, creditPerUnit: 5 }],
    totalProductCost: 7600,
    totalReturnedCredit: 75,
    netCost: 7525,
    date: '2026-06-10',
  },
];

export const DAILY_SALES = [
  { day: 'Mon', sales: 4500 },
  { day: 'Tue', sales: 5200 },
  { day: 'Wed', sales: 4800 },
  { day: 'Thu', sales: 5500 },
  { day: 'Fri', sales: 6200 },
  { day: 'Sat', sales: 7100 },
  { day: 'Sun', sales: 6800 },
];

export const MONTHLY_SALES = [
  { month: 'Jan', revenue: 125000 },
  { month: 'Feb', revenue: 118000 },
  { month: 'Mar', revenue: 145000 },
  { month: 'Apr', revenue: 152000 },
  { month: 'May', revenue: 168000 },
  { month: 'Jun', revenue: 175000 },
];
