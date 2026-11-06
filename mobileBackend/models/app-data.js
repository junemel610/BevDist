const { transaction } = require('../db/connection');

const METHODS = { CASH: 'Cash', GCASH: 'GCash', BANK_TRANSFER: 'Bank Transfer' };
const group = (rows, key) => rows.reduce((map, row) => {
  (map[row[key]] ||= []).push(row);
  return map;
}, {});

// PostgreSQL keeps exact numeric arithmetic. Number conversion is for screen display only.
// This DTO matches the current screen shapes without storing duplicate financial data.
async function loadAppData(pool) {
  return transaction(pool, async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rows = async sql => (await client.query(sql)).rows;
    const customers = await rows('SELECT id,name,contact,address FROM customers WHERE is_active ORDER BY name,id');
    const products = await rows(`SELECT p.*,s.name AS supplier FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE p.is_active ORDER BY p.name,p.id`);
    const packs = group(await rows('SELECT * FROM inventory_stock WHERE is_active ORDER BY pack_code'), 'product_id');
    const allCasePackTypes = await rows('SELECT code,label,units_per_case,family,is_active FROM case_pack_types ORDER BY code');
    const casePackTypes = allCasePackTypes.filter(type => type.is_active);
    const casePackTypeByCode = Object.fromEntries(allCasePackTypes.map(type => [type.code, {
      id: type.code, code: type.code, label: type.label, unitsPerCase: Number(type.units_per_case), family: type.family,
    }]));
    const invoices = await rows(`SELECT *, (created_at AT TIME ZONE 'Asia/Manila')::date::text AS date, due_date::text AS due
      FROM invoice_summary ORDER BY created_at DESC,id`);
    const items = group(await rows('SELECT * FROM invoice_items WHERE is_active ORDER BY created_at,id'), 'invoice_id');
    const returns = group(await rows('SELECT * FROM invoice_container_returns WHERE is_active ORDER BY created_at,id'), 'invoice_id');
    const payments = await rows(`SELECT p.*, (received_at AT TIME ZONE 'Asia/Manila')::date::text AS date FROM payments p ORDER BY received_at,id`);
    const allocations = group(await rows('SELECT * FROM payment_allocations ORDER BY allocation_order'), 'payment_id');
    const credits = await rows('SELECT * FROM customer_credit_balances WHERE available_credit>0');
    const supplierOrders = await rows(`SELECT *, (received_at AT TIME ZONE 'Asia/Manila')::date::text AS date FROM supplier_order_totals WHERE received_at IS NOT NULL ORDER BY received_at DESC,id`);
    const supplierItems = group(await rows('SELECT * FROM supplier_order_items ORDER BY id'), 'supplier_order_id');
    const supplierReturns = group(await rows('SELECT * FROM supplier_order_returns ORDER BY id'), 'supplier_order_id');
    const invoiceById = Object.fromEntries(invoices.map(row => [row.id, row]));

    const caseItem = row => ({
      id: row.id, productId: row.product_id, productName: row.product_name_snapshot,
      packId: row.pack_code, packLabel: row.pack_label_snapshot, unitsPerCase: row.units_per_case_snapshot,
      quantity: Number(row.quantity_cases),
    });
    const returnItem = row => ({
      id: row.id, returnTypeId: row.return_type_id, type: row.label_snapshot,
      kind: row.entry_kind || 'return', quantity: Number(row.quantity_cases),
      amountPerCase: Number(row.refund_per_case_snapshot), refundPerCase: Number(row.refund_per_case_snapshot),
      amountTotal: Number(row.refund_total), refundTotal: Number(row.refund_total),
    });
    return {
      customers,
      casePackTypes: casePackTypes.map(type => casePackTypeByCode[type.code]),
      suppliers: await rows('SELECT id,name,contact,address FROM suppliers WHERE is_active ORDER BY name,id'),
      products: products.map(row => ({
        id: row.id, name: row.name, supplierId: row.supplier_id, supplier: row.supplier,
        casePackIds: (packs[row.id] || []).map(pack => pack.pack_code),
        casePacks: (packs[row.id] || []).map(pack => ({ ...casePackTypeByCode[pack.pack_code], casePrice: pack.case_price == null ? null : Number(pack.case_price) })),
        casePrices: Object.fromEntries((packs[row.id] || []).map(pack => [pack.pack_code, pack.case_price == null ? null : Number(pack.case_price)])),
        stockByCasePack: Object.fromEntries((packs[row.id] || []).map(pack => [pack.pack_code, {
          totalStock: Number(pack.total_stock_cases), reservedStock: Number(pack.reserved_stock_cases),
          lowStockThreshold: Number(pack.low_stock_threshold_cases),
        }])),
      })),
      orders: invoices.map(row => ({
        id: row.id, invoiceNumber: row.invoice_number, orderNumber: row.invoice_number,
        customerId: row.customer_id,
        customer: { id: row.customer_id, name: row.customer_name_snapshot, contact: row.customer_contact_snapshot, address: row.customer_address_snapshot },
        items: (items[row.id] || []).map(item => ({ ...caseItem(item), stockQuantity: Number(item.quantity_cases), casePrice: Number(item.case_price_snapshot) })),
        containerReturns: (returns[row.id] || []).map(returnItem),
        subtotal: Number(row.subtotal), containerRefundTotal: Number(row.container_refund_total),
        containerDepositTotal: Number(row.container_deposit_total), grandTotal: Number(row.total_amount),
        status: row.status.toLowerCase(), deliveryStatus: row.delivery_status.toLowerCase(), date: row.date,
      })),
      balances: invoices.map(row => ({
        id: row.id, orderId: row.id, customerId: row.customer_id, customerName: row.customer_name_snapshot,
        invoiceNumber: row.invoice_number, totalAmount: Number(row.total_amount), amountPaid: Number(row.amount_paid),
        appliedCredit: Number(row.credit_applied), remainingBalance: Number(row.remaining_balance), dueDate: row.due, status: row.balance_status,
      })),
      // Canonical receipts remain separate from the legacy per-invoice ledger display.
      payments: payments.map(row => ({
        id: row.id, customerId: row.customer_id, method: METHODS[row.method], amountReceived: Number(row.received_amount), date: row.date,
        allocations: (allocations[row.id] || []).map(a => ({ invoiceId: a.invoice_id, amountApplied: Number(a.amount_applied), order: a.allocation_order })),
      })),
      paymentTransactions: payments.flatMap(row => {
        const entries = allocations[row.id] || [];
        const excess = Math.round((Number(row.received_amount) - entries.reduce((sum, a) => sum + Number(a.amount_applied), 0)) * 100) / 100;
        return entries.map((entry, index) => {
          const invoice = invoiceById[entry.invoice_id];
          const remainder = index === entries.length - 1 ? excess : 0;
          return {
            id: `${row.id}:${entry.invoice_id}`, receiptId: row.id, balanceId: entry.invoice_id, orderId: entry.invoice_id,
            customerId: row.customer_id, customerName: invoice.customer_name_snapshot, invoiceNumber: invoice.invoice_number,
            method: METHODS[row.method], amountReceived: Math.round((Number(entry.amount_applied) + remainder) * 100) / 100,
            amountApplied: Number(entry.amount_applied), excess: remainder, date: row.date,
          };
        });
      }),
      customerCredits: Object.fromEntries(credits.map(row => [`customer:${row.customer_id}`, Number(row.available_credit)])),
      restockRecords: supplierOrders.map(row => ({
        id: row.id, orderNumber: row.order_number, supplierId: row.supplier_id, supplier: row.supplier_name_snapshot,
        items: (supplierItems[row.id] || []).map(item => ({ ...caseItem(item), unitCost: Number(item.cost_per_case_snapshot) })),
        returnedCases: (supplierReturns[row.id] || []).map(entry => ({ ...returnItem(entry), creditPerUnit: Number(entry.refund_per_case_snapshot) })),
        totalProductCost: Number(row.product_cost), totalReturnedCredit: Number(row.returned_credit), netCost: Number(row.net_cost), date: row.date,
      })),
    };
  });
}

module.exports = { loadAppData };
