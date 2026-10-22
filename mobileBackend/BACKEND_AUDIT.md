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
- Carry a customer's unpaid amount into their next invoice. Mark the old balance as transferred and link it to the new invoice so it cannot be counted twice. If the new invoice is cancelled before payment or delivery, restore the transferred balances.

### Case quantities and inventory

- Keep inventory in its smallest stock unit and reserve the equivalent units for case quantities.
- Sales invoice lines must support multiple pack groups for one product and quantities in 0.5-case increments.
- Initial pack definitions from the meeting: A = 12 bottles, B = 24 bottles, C = 6 bottles; Mucho Red Horse has 6-bottle and 12-bottle packs.
- Returned-case credits on supplier orders are a separate rule from the sales pack definitions. Preserve the four supplier return-case types from the BRD/prototype.
- Inventory responses should include total, reserved, available, and available case equivalents. Low-stock feedback should report cases for the selected pack.

### Payments and reports

- Record every payment as an immutable transaction with customer, invoice, date, method, received amount, applied amount, and excess credit.
- Methods include Cash, GCash, and Bank Transfer. Keep a dedicated GCash report.
- Apply no more than the outstanding amount to an invoice. Record excess separately as customer credit and carry it forward; never count excess as sales.
- For the dashboard, expected sales include all non-cancelled invoices, including partial or unpaid invoices. Actual Sales includes cash applied to invoices only; report GCash separately.
- Apply payments to transferred older balances before the current invoice portion. Expose the allocation in payment history while counting the original sale once.

### Customer and audit records

- Persist customer profiles with stable IDs. Link invoices, balances, credits, and payment transactions by `customer_id`, never by display name alone.
- Preserve permanent histories for invoices (including pending and cancelled), supplier orders/restocks, balance transfers, and financial transactions.
- Use database transactions for invoice creation/edit, stock reservations/releases/deduction, balance transfer/cancellation restoration, and payments/credits.

## Proposed schema and API planning checklist

Add these to the design before implementing backend routes:

- `customers`: profile fields and timestamps.
- `products`: supplier, unit price, smallest stock unit, and low-stock threshold.
- `product_case_packs`: product/pack label, units per case, active flag; seed the meeting's A/B/C and Mucho pack sizes only after product associations are confirmed.
- `invoices` and `invoice_items`: customer, delivery status, invoice status, totals, pack ID, case quantity, unit conversion, and price snapshots.
- `inventory_reservations`: invoice/item reference and reserved smallest-unit quantity, with one-time release/finalize state.
- `balances` and `balance_transfers`: current invoice amount, carried-forward amount, remaining amount, source balance, and destination invoice.
- `payment_transactions`: method, received/applied/excess amounts and allocation to current versus carried balances.
- `supplier_orders`, `supplier_order_items`, and returned-case credits, keeping the supplier return-case catalog separate from sales packs.

Plan the route contracts around these operations: customer profile CRUD; invoice create/read/update/cancel/deliver; invoice payment; balance transfer/history; product/inventory read/update; supplier restock create/read; cash dashboard summary; and GCash transaction summary/history. Validate inputs and use parameterized SQL. Do not use the current placeholder API responses as persisted success.

### Backend acceptance criteria for later implementation

- Duplicate completion, cancellation, payment, or stock release cannot apply twice.
- Concurrent pending invoices cannot reserve more stock than is available.
- A 0.5 case reserves half of the pack's unit count; invoice totals use saved price snapshots.
- Carrying a balance does not duplicate expected sales or outstanding debt; cancelling the receiving invoice restores the source balance.
- For a 5,248 invoice paid with 5,500, record 5,248 applied and 252 as customer credit; only the applied cash is counted in Actual Sales.
- Cash and GCash reports reconcile to payment records, and cancelled invoices stay out of sales totals while remaining in history.
- PostgreSQL and API health checks, authentication for single-user access, validation, error handling, and integration tests pass before the app connects to live routes.
