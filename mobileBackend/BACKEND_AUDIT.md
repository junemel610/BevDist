# Backend audit and implementation plan

## Current state

- `server.js` exposes `/health` and placeholder `/auth/login` and `/auth/logout` only.
- The frontend already calls product, order, customer, inventory, balance, and restock routes that the backend does not expose.
- PostgreSQL is configured, but no route queries it, no schema or migrations exist, and `/health` does not check database connectivity.
- Login accepts any request body and returns a placeholder message. It does not authenticate users or issue tokens.
- CORS allows every origin. This is suitable only for local prototyping, not production.
- The error handler returns a generic 500 response, but there is no explicit 404 response or request validation.
- `npm test` is a placeholder that exits with an error; there are no backend tests.
- `mobileBackend/.env` is ignored by Git. Keep database credentials and secrets there; do not commit them.

## Recommended sequence

1. Define request/response contracts and PostgreSQL tables for users, customers, products, orders, order items, balances, and restocks.
2. Plan migrations and seed data that match the Prototype and current mobile screens.
3. Separate app creation from server startup so routes can be tested without opening a port on import.
4. Add validated, parameterized API routes. Use transactions for order creation, stock changes, and payments.
5. Implement authentication and authorization before exposing business routes. Restrict CORS to approved app origins and keep secrets in environment variables.
6. Add health checks for both API and database, a consistent 404/error response, and backend tests before wiring the mobile app to live data.

## Keep deferred

Do not remove `bcryptjs`, `jsonwebtoken`, or `pg` until the authentication and database plans are accepted. Do not connect the mobile API client to placeholder auth responses.

## Requirements adopted from the latest client meeting

These meeting notes are newer than the original BRD where the two conflict. Keep the mobile app as a frontend prototype until its screens are approved; backend implementation remains deferred.

### Sales and invoice lifecycle

- Use **Invoice** for sales to customers and **Order** for supplier restocking.
- Create a customer invoice in `PENDING` and reserve its stock immediately.
- Keep delivery and payment status as separate facts. An invoice is `COMPLETED` only when it is fully delivered and fully paid.
- A `CANCELLED` invoice releases its reservation and is excluded from sales. Preserve it in history.
- A pending invoice can be edited; its live invoice totals and stock reservation must update together.
- Keep each customer invoice and its outstanding balance as a separate record. When a returning customer orders again, show all their open invoices together in the customer account view; do not merge or transfer an older balance into the new invoice.
- Apply a payment made from the combined customer account to the oldest open invoice first, then continue through newer invoices. Record the amount applied to each invoice separately. Any amount left after all invoices are paid becomes customer credit.
- Cancelling a new invoice changes only that invoice and its stock reservation; older invoices and balances remain unchanged.

### Case quantities and inventory

- Use cases as the canonical inventory, reservation, invoice, and restock quantity. Do not expose loose-item counts as stock quantities.
- Sales invoice lines must support multiple pack groups for one product and quantities in 0.5-case increments.
- Initial pack definitions from the meeting: A = 12 bottles per case, B = 24 bottles per case, C = 6 bottles per case; Mucho Red Horse has 6-bottle and 12-bottle packs. Save a direct price for each case type; pack size must not calculate the price or convert stock balances into loose-item counts.
- Returned-case credits on supplier orders are a separate rule from the sales pack definitions. Preserve the four supplier return-case types from the BRD/prototype.
- Inventory responses should include total, reserved, and available case quantities. Low-stock feedback should report available cases.
- Supplier restock quantities and costs should be recorded per case; support 0.5-case increments where received quantities allow them.

### Payments and reports

- Record every payment as an immutable transaction with customer, invoice, date, method, received amount, applied amount, and excess credit.
- Methods include Cash, GCash, and Bank Transfer. Keep a dedicated GCash report.
- Apply no more than the outstanding amount to an invoice. Record excess separately as customer credit and carry it forward; never count excess as sales.
- For the dashboard, expected sales include all non-cancelled invoices, including partial or unpaid invoices. Actual Sales includes cash applied to invoices only; report GCash separately.
- For a payment made against a customer account, allocate oldest invoice first across its distinct open invoices. Expose each invoice allocation in payment history and count every invoice's sale once.

### Customer and audit records

- Persist customer profiles with stable IDs. Link invoices, balances, credits, and payment transactions by `customer_id`, never by display name alone.
- Preserve permanent histories for invoices (including pending and cancelled), supplier orders/restocks, customer account payments and their invoice allocations, and financial transactions.
- Use database transactions for invoice creation/edit, stock reservations/releases/deduction, customer account payments and their allocations, and customer credits.

## Proposed schema and API planning checklist

Add these to the design before implementing backend routes:

- `customers`: profile fields and timestamps.
- `products`: supplier, case stock and reservation totals, and low-stock threshold.
- `product_case_packs`: product/pack label, item count per case, and direct price per case; seed the meeting's A/B/C and Mucho pack sizes only after product associations are confirmed.
- `invoices` and `invoice_items`: customer, delivery status, invoice status, totals, pack ID, case quantity, unit conversion, and price snapshots.
- `inventory_reservations`: invoice/item reference and reserved case quantity, with one-time release/finalize state.
- `invoice_balances`: one independent receivable balance per invoice, including original amount, amount paid, and remaining amount.
- `payment_transactions` and `payment_allocations`: method, received/applied/excess amounts, customer account, and each invoice amount settled oldest-first.
- `supplier_orders`, `supplier_order_items`, and returned-case credits, keeping the supplier return-case catalog separate from sales packs.

Plan the route contracts around these operations: customer profile CRUD; invoice create/read/update/cancel/deliver; customer account receivables and account payment allocation/history; product/inventory read/update; supplier restock create/read; cash dashboard summary; and GCash transaction summary/history. Validate inputs and use parameterized SQL. Do not use the current placeholder API responses as persisted success.

### Backend acceptance criteria for later implementation

- Duplicate completion, cancellation, payment, or stock release cannot apply twice.
- Concurrent pending invoices cannot reserve more stock than is available.
- A 0.5 case reserves 0.5 cases; invoice totals use the direct saved price for the selected case type.
- Creating a second invoice leaves the first invoice's balance intact and shows both invoices in the customer's account total.
- A customer account payment settles the oldest open invoice first, creates a separate allocation for each invoice paid, and never changes either invoice's original sale total.
- Cancelling a new invoice leaves all older invoice balances unchanged.
- For a 5,248 invoice paid with 5,500, record 5,248 applied and 252 as customer credit; only the applied cash is counted in Actual Sales.
- Cash and GCash reports reconcile to payment records, and cancelled invoices stay out of sales totals while remaining in history.
- PostgreSQL and API health checks, authentication for single-user access, validation, error handling, and integration tests pass before the app connects to live routes.
