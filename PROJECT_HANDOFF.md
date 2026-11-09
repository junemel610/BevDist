# BevDist / Jojo's Coke — Project Handoff

**Updated:** 2026-11-09
**Repository branch:** `trunk`
**Repository:** `https://github.com/junemel610/BevDist.git` (private)

Use this file to resume work from another ChatGPT account or coding session. The Git repository is the source of truth for code; this handoff summarizes current product decisions and work state. An exported chat archive can be attached separately when older conversation wording is needed.

## Product and stack

BevDist is a single-user beverage distributor POS. The prototype in `Prototype/` was the original visual reference; the current mobile app is in `mobileFrontend/`. The backend and schema are in `mobileBackend/`.

- Mobile: React Native with Expo; React Navigation.
- API: Node.js and Express.
- Database: PostgreSQL 15.
- Client deployment target: Windows 8 laptop hosting the backend/database; mobile devices use the same Wi-Fi. Client setup and maintenance scripts are in `ops/*.ps1`.

## Current business rules

- Customer sales are **Invoices**. Supplier purchases/restocking are **Supplier Orders**.
- Inventory, invoice and supplier quantities use a generic **Case** unit per product. The client knows whether the product contains 6, 12 or 24 bottles; the app does not show bottle counts. The API/database retain `B` as an internal compatibility key.
- Quantities are entered in half-case increments. Display `0.5` as `1/2`.
- Pending, undelivered invoices reserve stock. Delivery deducts physical stock. An invoice is completed only when delivered and fully paid. Cancellation releases the reservation and excludes the invoice from sales reporting.
- Invoice **Deposit** lines add to the amount due. Invoice **Return** lines reduce the amount due. Each line names the container/item, uses a half-case quantity, and has a per-case amount.
- Supplier Orders have returned-case/item lines only; there is no supplier deposit option. Their refund/credit reduces the supplier order's net cost.
- Payments apply to the customer's oldest open invoice first. Any unapplied excess becomes customer credit and is not sales.
- Dashboard **Sales today** uses the Asia/Manila business date: Expected Sales counts non-cancelled invoices created today; Actual Sales counts cash applied today, including payments received today against older invoices. Excess payments are excluded, and GCash/Bank Transfer remain separate methods. The dashboard refreshes its date every minute so the figures roll over after midnight.
- The client-listed distributor catalog is seeded by migration 012 with zero stock and no selling prices. Enter actual stock and prices in Inventory before selling.

## Recent commits

The working tree was clean when this handoff was written.

```text
6494010 Show daily sales on dashboard
e2b1b8b docs: add cross-account project handoff
c96fff1 Rework invoice entry and deposit return flow
f182d60 Prevent duplicate customer profiles
1551144 Standardize inventory around generic cases
2be01ae Align backend schema with client workflows
96e300f Refine supplier order entry and returned cases
```

These commits are local to `trunk`; check `git status -sb` and `git log` before starting. Do not assume they have been pushed to GitHub.

## Key locations

- `mobileFrontend/src/screens/` — Dashboard, invoices, inventory, supplier orders, customer profiles, balances, login/profile.
- `mobileFrontend/src/components/orders/` — Invoice editor, distributor product picker, deposits/returns, invoice PDF/XLSX generation, case quantity helpers.
- `mobileFrontend/src/context/AppContext.js` — live application state and write/refresh flow.
- `mobileBackend/routes/`, `controllers/`, `services/` — API layers and transactional business logic.
- `mobileBackend/db/migrations/` — ordered schema/data migrations. Applied migration files must not be edited; create the next numbered migration.
- `mobileBackend/API_CONTRACT.md` — API payloads and response mapping.
- `mobileBackend/DATA_MODEL_SCHEMA_PLAN.md` — schema reference; review for stale planning text.
- `TEST_COVERAGE.md` and `mobileFrontend/tests/e2e/COVERAGE.md` — automated test inventory.
- `ops/setup-server.ps1`, `manage-server.ps1`, `backup-cloud.ps1`, `restore-db.ps1` — client Windows server scripts.

## Database and secrets

- **Never inspect or paste `mobileBackend/.env`.** It contains local credentials/secrets and is gitignored. Use `.env.example` for configuration guidance.
- The state of the user's local database and which migrations it has applied is unknown. Migration 009 requires an empty business database before switching to generic cases. Use a separate disposable development database when verifying migrations. Never drop, reset or migrate the client's database without a verified backup and explicit direction.
- Migration 012 seeds catalog suppliers/products but invents no stock, prices or customer transactions.
- Migrations 010 and 011 add monthly invoice numbering and invoice deposit/return accounting. Migration 014 adds monthly supplier order numbering (`ORD-MMYYYY-NNNNNNNN`).

## Verification status and next checks

Latest focused checks passed: Expo lint; 10 dashboard sales/payment unit tests; 22 dashboard/business-screen UI tests; 6 desktop Chromium dashboard Playwright tests; and 11 supplier-order UI plus 3 supplier Playwright tests. The full regression suites were not rerun after the other feature commits. Before a release/demo, run the full supported checks and resolve failures:

```bash
# From Project/
node scripts/test-all.mjs

# Or individually from mobileFrontend/
npm test
npm run lint
npm run typecheck
npm run test:e2e

# From mobileBackend/
npm run test:db
```

The PostgreSQL test suite and Playwright setup require a working local PostgreSQL service and create disposable test databases. They must not target the client's production database.

Manual Expo Go/device checks remain necessary, especially the local-Wi-Fi API URL, mobile layout, PDF/XLSX sharing and complete invoice/payment/restock workflows. The current Expo tunnel exposes Metro only; it does not expose the backend.

## Documentation caveat

Some older parts of `mobileBackend/BACKEND_AUDIT.md` and `DATA_MODEL_SCHEMA_PLAN.md` contain planning-era statements that conflict with the implemented live backend and newer business decisions. Read the dated/latest sections and source code, then reconcile those docs as a separate task.

## Suggested first message in the new chat

> Continue the BevDist project from `PROJECT_HANDOFF.md`. First inspect `git status -sb`, recent commits, and the relevant current code/docs. Do not inspect `mobileBackend/.env`. Preserve the latest client rules in this handoff, work in small feature-sized changes, and keep commits focused. Before migrations or DB resets, verify the target is a disposable development database. Start by telling me what is already complete and the next safest task.
