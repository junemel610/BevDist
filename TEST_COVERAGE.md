# Automated feature coverage

Verified 2026-10-24: **167 passing tests** (66 frontend unit, 38 component/provider/export, 63 backend checks including nested cases). ESLint and TypeScript checks pass. This is a regression baseline across the current feature set, not proof that every possible input or device behavior is covered.

## Run everything

From `Project`:

```bash
node scripts/test-all.mjs
```

Install dependencies in `mobileFrontend` and `mobileBackend` first. PostgreSQL must be running; backend `.env` supplies `DATABASE_URL` and its role needs permission to create a database. No app server or Expo session needs to be running. The runner stops on the first failure and returns a nonzero exit code.

The backend suite creates, migrates and drops a uniquely named `bevdist_test_*` database. It does not seed, truncate or migrate the configured application database. HTTP tests listen on temporary loopback ports. Frontend component tests mock API/native boundaries; a separate backend integration test exercises the actual mobile API helpers against HTTP and PostgreSQL.

Individual commands:

```bash
# mobileFrontend
npm test                 # unit + component/provider/export tests
npm run test:coverage    # component suite with coverage report
npm run lint
npm run typecheck

# mobileBackend
npm run test:db
```

## Feature checklist

`F` refers to `mobileFrontend/tests/`; `B` is `mobileBackend/test/schema.test.js`. Each row describes the specific cases automated, rather than claiming complete coverage of that feature.

| Feature | Automated scenarios | Suites |
| --- | --- | --- |
| Login / profile | Required credentials, rejected login, persisted bootstrap, refresh, sign-out confirmation, failed sign-out, expired/revoked/inactive/invalid JWTs, login rate limit | F `auth-api`, `ui/auth-screens`, `ui/app-provider`; B authentication / protected-route tests |
| Invoices | Typed quantities, half-case steps, insufficient stock, confirmation, live edits, preserved prices/returns, delivery independent of payment, immutable completed invoices, cancellation and reservation release | F `typed-case-quantity`, `case-packs`, `pending-invoice`, `order-lifecycle`, `ui/business-screens`; B invoice workflows |
| Payments | Initial amount zero, zero rejected, Cash/GCash/Bank Transfer, oldest first, partial/full payments, excess credit, concurrent receipts, idempotency, separate invoice balances | F `payment-ledger`, `balance-utils`, `customer-accounts`, `ui/business-screens`, `ui/app-provider`; B payment / concurrency / Bank Transfer tests |
| Customer profiles / credits | Name validation, save confirmation, searchable credit list, navigation to credits, grouping/identity and credit deductions | F `customer-profiles`, `customer-credits`, `customer-accounts`, `ui/business-screens`; B customer/catalog and invoice flows |
| Inventory | A/B/C/Mucho 6/Mucho 12 stock separation, reservations, physical deduction at delivery, thresholds, labels, filters/search, count reason, stale counts, product archiving/deletion confirmation, concurrent last-half-case reservations | F `inventory-utils`, `case-packs`, `ui/business-screens`; B catalog / inventory / concurrency / five-pack tests |
| Supplier orders | Empty form validation, half-case entry, save confirmation, recent-order details, per-pack stock receipt, return credits, idempotency, supplier ownership and rollback | F `supplier-order-utils`, `ui/business-screens`; B supplier receipt / ownership tests |
| Returned containers | Editable type/quantity/rate, rounding and total deduction, reject invalid steps/negative rates/excessive deductions/below-settlement totals, explicit clear vs preserve on edit | F `container-returns`, `ui/business-screens`; B invoice / invalid-input tests |
| Dashboard | Expected vs actual vs outstanding reconciliation with SQL, partial payments, excess/cancel exclusions, separate daily payment methods, Manila dates, chart calculations, quick-create route | F `dashboard-*`, `daily-payment-methods`, `business-date`, `ui/business-screens`; B DTO / Bank Transfer / timezone tests |
| GCash page | Cash excluded, GCash amounts/excess displayed, oldest-first persisted allocations mapped to DTOs | F `ui/business-screens`; B GCash allocation test |
| PDF / Excel | Styled workbook serialization and merges, invoice data/escaping/totals/refunds, preview export actions, safe filenames, readable native PDF storage, generation/share errors, web vs native paths | F `invoice-documents`, `ui/invoice-export`, `ui/business-screens` |
| Feedback / confirmations | Stock notice summary, announced message, View stock and dismiss actions, native confirm/cancel, web cancel/missing support, safe API errors | F `stock-notice`, `ui/feedback`, `ui/confirm-action`, `ui/business-screens` |
| Save / refresh recovery | Duplicate-submit guard, busy reset, refresh after writes, saved-but-read-failed recovery gate, uncertain network writes, validation errors, expired session cleanup | F `live-data`, `auth-api`, `ui/app-provider` |
| API / database integrity | All protected business routes, invalid IDs/dates/amounts/lists/methods, malformed/oversized JSON, not-found/health responses, immutable ledgers, cross-customer constraints, migration repeatability and checksum/missing-file detection | B HTTP boundary / SQL integrity / migration tests |

Unit file names in the table omit `.test.mjs`; UI file names omit `.test.js`.

## Measured coverage and limits

The Jest-only report covers the configured screen, context, API, component and utility JavaScript files: **72.86% lines, 70.47% statements, 67.68% functions, 57.31% branches**. Open `mobileFrontend/dist/test-coverage/ui/index.html` after running coverage. Generated reports live under ignored `dist/`.

These percentages do not include execution from the separate 66 Node unit tests or backend tests. They are not a combined full-stack coverage percentage. Unit tests also cover retained pure demo helpers; provider and HTTP tests separately cover live persisted operations.

Component tests use real screen components but mock HTTP, icons, safe-area metrics, chart drawing and native print/share/storage. They do not launch the app, exercise the real navigation container, inspect screenshots or measure scrolling performance. Chart calculations and quick-action route arguments are covered, but chart drawing and real navigation still need device checks. Type checking covers TypeScript files; JavaScript screens are linted.

Remaining checks are in `mobileFrontend/QA_CHECKLIST.md`: physical Expo Go workflows, real PDF/XLSX opening/sharing, phone API connectivity, safe areas, keyboard behavior, larger fonts, small-screen layout, real chart rendering, and list performance. App-to-device end-to-end automation is not configured. Node currently emits existing module-format detection warnings for ESM-style JavaScript imports; they do not fail the tests.

## Defects caught while expanding automation

- Oversized JSON requests now return a safe HTTP 413 response instead of HTTP 500.
- Supplier receipts reject a product assigned to another supplier and roll back without adding stock or a receipt.
- The stock toast's alert role/live announcement is attached to its accessible message text, leaving its action buttons independently accessible.
