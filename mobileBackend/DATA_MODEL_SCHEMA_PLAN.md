# BevDist database schema and implementation status

**Status:** PostgreSQL schema and backend workflows implemented. The user authorized database implementation after the planning stage. Versioned SQL in `db/migrations/` is the source of truth. Screens still use frontend demo state; see `API_CONTRACT.md` for the live integration boundary.

## Confirmed business rules

- Customer transaction = invoice. Supplier restock = supplier order.
- Cases are the unit. Sales, stock, and current return quantities use 0.5-case increments. Individual bottles are descriptive pack metadata only.
- A pending undelivered invoice reserves stock. Delivery deducts physical stock and closes reservations exactly once, even if unpaid.
- Completed means delivered and fully paid. Final payment after delivery never deducts stock again.
- Customer account views group invoices without merging their original amounts. New payments allocate oldest invoice first.
- Excess payments become traceable customer credit, never additional invoice revenue.
- Deposit means returned-container refund. Editable return lines reduce the customer invoice amount due; they do not represent advance payments or cash refunds.
- Completed/cancelled invoices and posted financial/inventory history are preserved.
- Cancel only an undelivered invoice with no payment or applied credit. Other reversals require a separately approved workflow.

## Migration layout

| File | Purpose |
|---|---|
| `001_catalog.sql` | Exact money/case domains; users, customers, suppliers, product and case catalogs |
| `002_transactions.sql` | Invoices, returns, reservations, stock movements, payments, credits, supplier orders, calculated views |
| `003_integrity.sql` | Stock and financial integrity, lifecycle guards, snapshots, immutability, transaction reconciliation |

`schema_migrations` records migration names, checksums and application times. All pending migrations run atomically under an advisory lock. Changed or missing applied migrations are rejected. Make future changes through new numbered migrations.

## Core tables and relationships

All entity IDs are UUIDs. Foreign keys preserve relationships; financial history is not cascade-deleted. Catalog records support archiving through `is_active`.

| Table | Important fields and links |
|---|---|
| `app_users` | Username, password hash, active flag, session version for token revocation |
| `customers` | Name, contact, address; parent of invoices/payments/credit |
| `suppliers` | Name, contact, address; default supplier for products and actual supplier on each receipt |
| `products` | Name, supplier ID, active flag |
| `case_pack_types` | A/12, B/24, C/6, MUCHO_6/6, MUCHO_12/12; explicit associations, never inferred from product names |
| `product_case_packs` | Composite key `(product_id, pack_code)`, direct case price, per-pack low-stock threshold |
| `returned_case_types` | Optional configurable return labels and default refund rates; no guessed values seeded |
| `invoices` | Invoice number, customer ID and printed customer snapshots, due date, delivery/cancellation timestamps, actor, request key/hash |
| `invoice_items` | Invoice ID, product/pack FK, quantity, direct price and label snapshots, generated line total; edits deactivate and replace rows |
| `invoice_container_returns` | Invoice ID, optional return catalog ID, editable label and refund-rate snapshots, quantity, generated refund total |
| `inventory_reservations` | Invoice item ID, quantity, ACTIVE/RELEASED/FINALIZED state and closure timestamp |
| `inventory_movements` | Product/pack, signed case quantity, opening/adjustment/delivery/supplier receipt type, source line, reason, actor, unique operation key |
| `payments` | One receipt: customer ID, method, received amount/time, reference, actor, unique request key |
| `payment_allocations` | Receipt ID, invoice ID, applied amount and oldest-first allocation position |
| `customer_credit_entries` | Immutable ISSUED/APPLIED amounts; issue links to a receipt, use links to that issue and an invoice |
| `supplier_orders` | Supplier snapshot, unique number/request key, creator and receipt timestamp |
| `supplier_order_items` | Product/pack, cases received, direct case-cost snapshot, generated line total |
| `supplier_order_returns` | Return type/label/rate snapshots, returned quantity and generated credit total |

`stock_revision` and `ledger_revision` are internal locking counters on pack/customer records. They are not business balances. They make concurrent stock or credit changes serialize safely, including stale transactions at stronger isolation levels.

## Calculated views

| View | Definition |
|---|---|
| `invoice_totals` | Active beverage line totals minus active container-return deductions |
| `invoice_balances` | Net invoice amount less payment allocations and credit used; cancelled collectible amount is zero |
| `invoice_summary` | Invoice header, totals, balance, lifecycle and payment/delivery status |
| `inventory_stock` | Physical stock from movements; reserved stock from ACTIVE reservations; available = physical − reserved |
| `customer_credit_balances` | Issued credit minus applied credit |
| `supplier_order_totals` | Product purchase cost minus supplier return credits |
| `daily_invoice_summary` | Non-cancelled expected invoice value and lifecycle counts by Manila invoice date |
| `daily_payment_summary` | Receipts, allocations and issued excess grouped by payment method and Manila receipt date |
| `daily_credit_usage` | Earlier credit used on invoices, grouped by application date |

There is no separately writable invoice total, balance, reserved-stock counter, or available-stock total. The views derive them from the underlying records, avoiding duplicate totals that can drift. `invoice_balances` is a view, not the physical balance table proposed in the earlier plan.

## Amounts and reports

Use exact constrained PostgreSQL `numeric` values. Money rejects more than two decimal places; case quantities reject values outside half-case increments. Do not silently round invalid input into a valid quantity. Generated line values round case quantity × price to cents.

Customer invoice calculation:

1. Subtotal = sum of beverage line totals.
2. Container refund = sum of returned-container line values.
3. Net invoice amount = subtotal − container refund.
4. Balance = net invoice amount − payment allocations − previously issued credit used.

Example: ₱5,248 beverage subtotal minus ₱200 returned containers leaves ₱5,048 due. A ₱5,500 receipt applies ₱5,048 and issues ₱452 customer credit. Returned empty containers do not increase beverage inventory.

Recommended reporting labels remain subject to client review:

- **Expected invoice sales:** non-cancelled net invoice amounts, including unpaid and partially paid invoices.
- **Cash received:** actual cash handed over, including excess credited to the customer. This is a receipt metric, not invoice revenue.
- **Cash applied / current Actual Sales:** cash receipt allocations applied to invoices. Excludes unapplied excess, GCash and later credit use.
- **Customer credit used:** prior excess applied now; never record it as new cash received.
- **GCash received/applied:** separate payment-method report.
- **Outstanding balances:** remaining collectible invoice amounts.

Store event times as `timestamptz`; derive daily report dates explicitly using `Asia/Manila`. Do not compare invoice-day expected totals with payment-day collections as if they represented identical transactions.

## Integrity and workflow rules

- Invoice numbers come from a database sequence; sequence gaps are allowed.
- Create invoice, line snapshots, reservations, returns and any available-credit application in one transaction.
- Retain existing line prices when editing a pending invoice; new product/pack lines use catalog prices. Client-supplied totals/prices are ignored.
- Reject negative invoice totals and edits that reduce the invoice below settlements already applied.
- Delivered/cancelled invoice lines and headers cannot be edited. Payment history can settle delivered pending invoices.
- Delivery closes reservations and creates one uniquely linked negative stock movement per active item.
- Supplier posting creates one uniquely linked positive movement per item; repeated API requests cannot restock twice.
- Lock customers before payments or credit spending, and lock stock packs in stable order. Concurrent attempts cannot oversell or spend one credit twice.
- Every committed receipt equals allocations plus issued credit. Allocations and credit uses must belong to the same customer as the invoice.
- Payment, allocation, credit and stock movement history are immutable. Do not edit ledgers in pgAdmin; use transaction services.
- Retried create/payment/supplier operations reuse a UUID request key. A changed request using that same key is rejected.
- Refunds exceeding invoice/purchase value are rejected pending a policy for excess return credit; no value is silently discarded.

## Frontend alignment

The backend maps normalized rows into the screen's existing nested product, invoice, balance and supplier-order shapes through `models/app-data.js`. Existing `orders` and `restockRecords` response keys are compatibility names, not separate database entities.

Frontend changes in this implementation:

- Deduct stock when marked delivered, rather than waiting for full payment.
- Final payment changes lifecycle status without another stock deduction.
- Explicit product case-pack IDs take precedence over product-name heuristics.
- Replace the ambiguous payment `deposit` field with `containerReturns` and `containerRefundTotal`.
- Preserve container deductions when updating pending invoice amounts.
- API helpers use actual invoice, account-payment and supplier-order routes. Authentication tokens are held in memory rather than browser-only storage.

The app is not yet switched to live persistence. Customer/catalog HTTP editing, complete AppContext read/write integration, and editable customer return UI/export presentation remain follow-up work. No production customers, products, invoice history or test passwords are seeded by migrations.

## Validation and remaining decisions

Automated PostgreSQL/API tests cover migrations, receipt allocation, excess credit, returned-container deductions, delivery stock, pending edits, cancellations, concurrent reservations/payments/credit use, method separation, snapshot mapping, authentication and Manila reporting dates. They use a disposable generated database and do not mutate the project database.

Still confirm with the client:

- Final Cash Received / Cash Applied / Credit Used labels and accounting presentation.
- Real return catalog labels and rates; current invoice lines allow an editable label and rate.
- Whether container returns follow the same half-case increment rule.
- Refund/reversal behavior and excess container/supplier-return credit.
- Whether product purchasing needs more than one default supplier.

Further implementation: catalog/customer endpoints, frontend live persistence, container-return forms and exports, then device validation. Test SQL migrations and deployment backups before client installation.

## Technical references

- [PostgreSQL 15 constraints](https://www.postgresql.org/docs/15/ddl-constraints.html)
- [PostgreSQL 15 triggers](https://www.postgresql.org/docs/15/sql-createtrigger.html)
- [node-postgres transactions](https://node-postgres.com/features/transactions)
