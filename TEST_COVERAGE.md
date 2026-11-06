# Automated feature coverage

Verified 2026-10-25: **302 passing checks** (68 frontend unit, 48 component/provider/export, 90 backend checks including nested cases, and 96 Playwright browser checks). ESLint and TypeScript checks pass. This is a regression baseline across the current feature set, not proof that every possible input or device behavior is covered.

## Run everything

From `Project`:

```bash
node scripts/test-all.mjs
```

Install dependencies in `mobileFrontend` and `mobileBackend` first, then run `npx playwright install chromium` from `mobileFrontend`. PostgreSQL must be running; backend `.env` supplies `DATABASE_URL` and its role needs permission to create a database. No app server or Expo session needs to be running. The runner stops on the first failure and returns a nonzero exit code.

The backend suite creates, migrates and drops a uniquely named `bevdist_test_*` database. It does not seed, truncate or migrate the configured application database. HTTP tests listen on temporary loopback ports. Frontend component tests mock API/native boundaries; a separate backend integration test exercises the actual mobile API helpers against HTTP and PostgreSQL.

Individual commands:

```bash
# mobileFrontend
npm test                 # unit + component/provider/export tests
npm run test:coverage    # component suite with coverage report
npm run lint
npm run typecheck
npm run test:e2e          # desktop + phone-sized Chromium
npm run test:e2e:ui       # interactive browser test runner

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
| Inventory | One generic case unit per product, half-case entry, `1/2` display, reservations, physical deduction at delivery, thresholds, filters/search, reason, stale counts, archive/delete confirmation, concurrent edits | F `inventory-utils`, `case-packs`, `ui/product-entry`, `ui/business-screens`; B catalog / inventory / concurrency / migration tests |
| Supplier orders | Existing/new supplier search, new supplier and multiple new products, no-return receipts, optional manual return credits, half-case entry, purchase-cost vs selling-price labels, confirmation, recent-order details, per-pack stock, idempotency, ownership and rollback | F `supplier-order-utils`, `ui/product-entry`, `ui/business-screens`; B supplier receipt / ownership / inline validation tests |
| Container deposits and returns | Switch type, editable quantity/rate, deposits add and returns deduct, rounding, invalid steps/rates, reject below-settlement totals, explicit clear vs preserve on edit | F `container-returns`, `invoice-documents`, `ui/business-screens`; B invoice / invalid-input tests |
| Dashboard | Expected vs actual vs outstanding reconciliation with SQL, partial payments, excess/cancel exclusions, separate daily payment methods, Manila dates, chart calculations, quick-create route | F `dashboard-*`, `daily-payment-methods`, `business-date`, `ui/business-screens`; B DTO / Bank Transfer / timezone tests |
| GCash page | Cash excluded, GCash amounts/excess displayed, oldest-first persisted allocations mapped to DTOs | F `ui/business-screens`; B GCash allocation test |
| PDF / Excel | Styled workbook serialization and merges, invoice data/escaping/totals/refunds, preview export actions, safe filenames, readable native PDF storage, generation/share errors, web vs native paths | F `invoice-documents`, `ui/invoice-export`, `ui/business-screens` |
| Feedback / confirmations | Stock notice summary, announced message, View stock and dismiss actions, native confirm/cancel, web cancel/missing support, safe API errors | F `stock-notice`, `ui/feedback`, `ui/confirm-action`, `ui/business-screens` |
| Save / refresh recovery | Duplicate-submit guard, busy reset, refresh after writes, saved-but-read-failed recovery gate, uncertain network writes, validation errors, expired session cleanup | F `live-data`, `auth-api`, `ui/app-provider` |
| API / database integrity | All protected business routes, invalid IDs/dates/amounts/lists/methods, malformed/oversized JSON, not-found/health responses, immutable ledgers, cross-customer constraints, migration repeatability and checksum/missing-file detection | B HTTP boundary / SQL integrity / migration tests |

Unit file names in the table omit `.test.mjs`; UI file names omit `.test.js`.

## Browser end-to-end checks

Forty-three scenarios run twice: desktop Chromium and Pixel 7 browser emulation. They use the real navigation container, production web export, Express API and PostgreSQL. The [browser functionality checklist](mobileFrontend/tests/e2e/COVERAGE.md) maps every current screen to its covered workflows: lifecycle changes, generic case units, multi-product receipts with or without returns, CRUD forms, filters, payments, exports, and save/session recovery.

Playwright starts isolated loopback servers and creates/drops its own `bevdist_e2e_*` database. It does not reuse a developer server. Failure screenshots/traces and an HTML report are saved under ignored `mobileFrontend/dist/`. See [Playwright setup and UI runner](mobileFrontend/tests/e2e/README.md) for commands, isolation details, restart requirements and remaining limits.

## Measured coverage and limits

The Jest-only report covers the configured screen, context, API, component and utility JavaScript files: **77.47% lines, 75.24% statements, 73.16% functions, 61.73% branches**. Open `mobileFrontend/dist/test-coverage/ui/index.html` after running coverage. Generated reports live under ignored `dist/`.

These percentages do not include execution from the separate 68 Node unit tests or backend tests. They are not a combined full-stack coverage percentage. Unit tests also cover retained pure demo helpers; provider and HTTP tests separately cover live persisted operations.

Component tests use real screen components but mock HTTP, icons, safe-area metrics, chart drawing and native print/share/storage. They do not launch the app, exercise the real navigation container, inspect screenshots or measure scrolling performance. Chart calculations and quick-action route arguments are covered, but chart drawing and real navigation still need device checks. Type checking covers TypeScript files; JavaScript screens are linted.

Remaining checks are in `mobileFrontend/QA_CHECKLIST.md`: physical Expo Go workflows, real PDF/XLSX opening/sharing, phone API connectivity, safe areas, keyboard behavior, larger fonts, small-screen layout, real chart rendering, and list performance. Browser end-to-end automation is configured; native Android/iOS end-to-end automation is not. Node currently emits existing module-format detection warnings for ESM-style JavaScript imports; they do not fail the tests.

## Defects caught while expanding automation

- Oversized JSON requests now return a safe HTTP 413 response instead of HTTP 500.
- Supplier receipts reject a product assigned to another supplier and roll back without adding stock or a receipt.
- The stock toast's alert role/live announcement is attached to its accessible message text, leaving its action buttons independently accessible.

Browser expansion also fixed invoice-only web printing and blocked-popup feedback, web supplier-change confirmation, mixed valid/invalid supplier line validation, and checked/pressed accessibility states for web choices. Browser PDF checks inspect the actual formatted print window and Chromium-rendered PDF bytes; system print dialogs and native sharing remain separate checks.
