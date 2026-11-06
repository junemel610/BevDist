# BevDist frontend / API / PostgreSQL contract

## Current integration boundary

The schema, backend services, authenticated routes, and mobile business screens now use PostgreSQL. Login loads `GET /app-data` before showing business screens. Every save awaits its server transaction, then replaces the snapshot. No demo records are loaded or optimistically changed in `AppContext`. Migration 012 seeds the six client-listed distributors and 51 catalog products. Prices remain unset and physical stock starts at zero until the operator enters actual values.

A blocking progress view prevents overlapping saves. If a save result is uncertain or the following refresh fails, a recovery screen requires reloading records before further writes. A successful write is never automatically resubmitted after a failed refresh. Check records after an ambiguous catalog create before entering another; pending UUID keys are retained only in memory for invoices/payments/supplier orders. Restarting the app does not preserve pending keys. Profile includes a manual Refresh records action.

`GET /app-data` returns a consistent read snapshot mapped by `models/app-data.js`. It is a bootstrap endpoint for the current small dataset. Add paginated history endpoints before loading a large production history into memory.

## Layers

- `server.js`: environment, listener, and shutdown.
- `app.js`: Express composition, route mounting, and common middleware.
- `routes/`: paths, input validation, and controller dispatch.
- `controllers/`: HTTP request/response handling and authenticated actor identity.
- `services/`: feature-specific business operations and parameterized SQL in a single database transaction. The services use `db/connection.js`; there is no generic repository abstraction.
- `models/app-data.js`: database reads mapped to the frontend shapes.
- `middleware/`: authentication, validation, login throttling, and safe errors.
- `db/migrations/`: versioned schema, views, and integrity rules.

## Implemented endpoints

All business endpoints require `Authorization: Bearer <token>`. Login and health are public. User identity comes from the verified token, never from a request body.

| Method | Endpoint | Body / result |
|---|---|---|
| GET | `/health` | Reports API and database connectivity |
| POST | `/auth/login` | `{ username, password }`; returns `{ token, user }` |
| POST | `/auth/logout` | Revokes all current tokens for that user; returns 204 |
| GET | `/app-data` | Customers, suppliers, the single generic case unit, products, invoices (`orders` compatibility key), balances, receipts, ledger display, customer credits, supplier orders (`restockRecords`) |
| POST | `/invoices` | `{ requestKey, customerId, dueDate, items, containerReturns? }`; returns `{ id }` |
| PUT | `/invoices/:id` | `{ items, containerReturns? }`; replaces undelivered pending lines atomically |
| POST | `/invoices/:id/deliver` | Deducts stock once; repeated delivery has no further effect |
| POST | `/invoices/:id/cancel` | `{ reason }`; only undelivered, unsettled invoices |
| POST | `/customers/:customerId/payments` | `{ requestKey, method, amountReceived, reference? }`; oldest invoice first |
| POST / PUT | `/customers`, `/customers/:id` | `{ name, contact?, address? }`; returns saved profile |
| POST / PUT | `/suppliers`, `/suppliers/:id` | `{ name, contact?, address? }`; returns saved profile |
| POST / PUT | `/products`, `/products/:id` | `{ name, supplierId, packs: [{ packId: 'B', ... }] }`; returns `{ id }` |
| DELETE | `/products/:id` | Archives a product with zero physical/reserved stock; returns 204 |
| POST | `/products/:id/stock-adjustments` | `{ packId, quantityDelta, reason, requestKey }`; returns movement `{ id }` |
| POST | `/supplier-orders` | `{ requestKey, supplierId | newSupplier, items?, newProducts?, returnedCases? }`; saves supplier, products, receipt lines, return credits, and stock movements in one transaction |

Catalog reads use `GET /app-data`, which includes suppliers and the single active generic case unit. B remains a stable internal key; the UI does not ask for bottle counts or expose case-type choices. Each product's selling price, stock, reservation, and order quantity are measured in that product's case. New invoice, inventory, and supplier-order quantities use half-case increments; clients display 0.5 as `1/2` and 1.5 as `1 1/2`. Product packs use `{ packId: 'B', casePrice, lowStockThreshold? }`, where `casePrice` is either null for an unpriced catalog product or a positive selling price per product case. An unpriced product cannot be invoiced until staff set its price. Thresholds default to 15. Product creation accepts either `supplierId` or `supplierName`; a new named supplier is saved within the product transaction. Optional pack fields `totalStock` and (on edit) `expectedStock` let the inventory form save counts and prices atomically. These require a `stockReason`; the authenticated actor is recorded in opening/adjustment ledger entries. Stale expected counts, unavailable stock, or invalid packs roll back the entire save, including any new supplier. Catalog products start at zero physical stock. Supplier orders remain the normal way to record incoming deliveries.

Supplier order creation accepts exactly one of `supplierId` or `newSupplier: { name, contact?, address? }`. Existing catalog receipt lines go in `items`; new products go in `newProducts: [{ name, packs: [{ packId, casePrice, quantity, unitCost }] }]`. `casePrice` is the selling price per case; `unitCost` is the supplier purchase cost per case. `returnedCases` is optional and defaults to no returns. The server creates a new supplier/product and its case packs, records any returned-case credits, and posts all received stock in one database transaction. A failed request rolls back all of those changes. A new supplier or product is not persisted until this confirmed supplier-order request succeeds.

Stock adjustments use signed half-case deltas, not replacement totals. Each adjustment requires a reason and a UUID request key, reused unchanged on retry. Negative adjustments cannot consume reserved stock. The authenticated user is recorded as the actor. Product removal archives rows; historical invoice and supplier item snapshots remain intact. Catalog profile/product creation does not yet have idempotency keys: after an ambiguous network error, refresh the catalog before retrying to avoid duplicates.

Invoice item input: `{ productId, packId, quantity }`. Quantity uses cases in 0.5 increments. Prices come from the database; edits retain stored prices for existing product/pack lines. New lines use current catalog prices. Client totals and prices are not trusted.

Invoice numbers are generated by PostgreSQL in the `INV-MMYYYY-NNNNNNNN` format, using the Asia/Manila calendar. Each month starts at `00000001`; cancelled invoices still consume a number, and previously issued invoice numbers remain unchanged.

Invoice container adjustment: `{ returnTypeId?, kind: 'deposit' | 'return', type, quantity, amountPerCase }`. Quantity uses half-case increments. Deposits add to invoice amount due; returns reduce it. These are invoice adjustments and do not add beverage stock or create cash receipts. Legacy rows without a kind are treated as returns.

On invoice edit, omitting `containerReturns` preserves existing return lines; sending `[]` explicitly removes them. Existing product/pack prices are retained even if catalog prices have changed.

Supplier item: `{ productId, packId, quantity, unitCost }`. Supplier return: `{ returnTypeId?, type, quantity, creditPerUnit }`. Rates are manual inputs for the single authorized operator. Supplier return credit reduces purchase cost.

`requestKey` is a UUID generated once per create/payment/receipt action and reused on retry. Reusing it with different content is rejected. Amounts may be decimal strings or numbers with at most two decimals. The database computes all financial arithmetic using exact numeric values.

HTTP errors: 400 invalid input, 401 unauthenticated, 404 unknown record/route, 409 conflicting state, 429 login throttling, 500 unexpected failure. Database details and credentials are not returned.

## Response mapping

| Database source | Frontend shape |
|---|---|
| `products` / `suppliers` / `inventory_stock` | Product `id`, `name`, `supplierId`, `supplier`, `casePackIds`, `casePrices`, `stockByCasePack` |
| `invoice_summary` | `orders[]`: `invoiceNumber`, `customerId`, customer snapshot, `subtotal`, `containerDepositTotal`, `containerRefundTotal`, `grandTotal`, lowercase status/deliveryStatus, Manila date |
| `invoice_items` | `productId`, `packId`, label snapshots, `quantity`, `casePrice`; compatibility `stockQuantity` always equals cases |
| `invoice_container_returns` | `containerReturns[]`: editable type snapshot, adjustment kind, quantity, per-case amount and total |
| `invoice_balances` view | `balances[]`: `id` and `orderId` both equal invoice UUID, `totalAmount`, `amountPaid`, `appliedCredit`, `remainingBalance`, `dueDate`, status |
| `payments` / `payment_allocations` | Canonical `payments[]`: one receipt with nested allocations |
| Same receipts/allocations | Compatibility `paymentTransactions[]`: one row per allocation, linked by `receiptId`; excess is attached only to the final allocation |
| `customer_credit_balances` | `customerCredits['customer:<UUID>']` |
| Supplier order tables/views | `restockRecords[]` with product lines, returned cases, cost totals and date |

A receipt with no allocations appears in canonical `payments` and customer credit, not in the compatibility invoice-payment list. Use canonical receipts for Cash Received. Use allocation amounts for Cash Applied. Credit Used is a separate settlement metric. Historical invoice snapshots remain available when a customer/product is archived.

Database payment codes `CASH`, `GCASH`, `BANK_TRANSFER` map to the frontend labels `Cash`, `GCash`, `Bank Transfer`. Invoice lifecycle is derived: cancelled first; otherwise completed only when delivered and fully settled; otherwise pending. Balance status is separate from invoice lifecycle.

The obsolete frontend `deposit` payment field is removed. Container deposits and returns are explicit invoice lines: deposits increase the invoice total; returns reduce it. Payments and applied customer credit remain separate from these adjustments.

## Remaining screen work before live mode

- [x] Connect login/logout to `authAPI`, handle failed requests, and return to login when the current token expires. Tokens live in memory; sign-in is required after reload. Business records are cleared from memory on sign-out/session expiry.
- [x] Load the database snapshot after login and successful mutations; reset to empty data on sign-out.
- [x] Connect customer, inventory, invoice, payment and supplier-order saves to HTTP, awaiting operations and preserving confirmation dialogs. Inventory adjustments record a reason and reject stale stock counts.
- [x] Add editable container deposits and returns to create/edit invoice forms and PDF/XLSX output. Deposits add to invoice totals; returns deduct. Explicitly removing all rows sends `[]`.
- [x] Generate native UUID request keys for invoice/payment/supplier-order creates using Expo Crypto. Keep the same key for an ambiguous retry in the current session; always review recovered records first.
- Use the Mac's network IP as `EXPO_PUBLIC_API_URL` for a physical phone; `localhost` on a phone refers to the phone. The server defaults to loopback until `HOST` is explicitly configured.
- Test the entire persisted flow on Expo Go before client use.

## Container-return device check

- Create a pending invoice with returned cases and verify the displayed refund and amount due after saving/reloading.
- Change a return label/rate, then remove every return line and save. Confirm the full product subtotal becomes due again.
- Check that a refund below recorded settlements is rejected and delivered invoices remain locked.
- Export PDF and Excel. Confirm return names, half-case quantities, rates, deductions, grand total and balance match the persisted invoice. Test native file sharing on the client device.
