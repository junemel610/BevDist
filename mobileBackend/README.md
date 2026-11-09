# BevDist backend

Node.js + Express + PostgreSQL 15 for BevDist. The schema, transaction services, and authenticated catalog/invoice/payment/supplier endpoints are implemented. Mobile business screens now read and save PostgreSQL records; see [API_CONTRACT.md](API_CONTRACT.md) before connecting live reads and writes.

## Local setup

```bash
brew install postgresql@15
brew services start postgresql@15
/opt/homebrew/opt/postgresql@15/bin/createdb bevdist_db
npm install
```

Run `createdb` only if the database does not already exist. On Apple Silicon, versioned tools are in `/opt/homebrew/opt/postgresql@15/bin`. Use `brew --prefix postgresql@15` to find the installation on other Macs.

Create `.env` from `.env.example`. Set your macOS username in the database URL for Homebrew's default local development cluster. Set a private random JWT secret of at least 32 characters; do not reuse the example placeholder. Generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then run:

```bash
npm run db:check
npm run db:migrate
npm run user:create -- junemel
npm run dev
```

The user-creation command asks for a hidden password and stores only its hash. Migrations do not create a default login or load demo business data. The database connection and JWT secret belong only in the ignored backend `.env`, never in `EXPO_PUBLIC_*` variables or Git.

The server listens on `127.0.0.1:5000` by default. For web testing on this Mac, use `EXPO_PUBLIC_API_URL=http://127.0.0.1:5000`. Avoid `localhost:5000`: macOS AirPlay may answer its IPv6 address instead of this IPv4 backend. `GET /health` verifies database connectivity. Configure `HOST=0.0.0.0` only when intentionally testing over your local network. A physical phone must use the Mac's network address for `EXPO_PUBLIC_API_URL`.

## Structure

```text
app.js                 Express composition
server.js              Listener and graceful shutdown
routes/                Feature endpoints and validation
controllers/           HTTP requests/responses
services/              Feature workflows and transactional database queries
models/app-data.js     Frontend response mapping
middleware/            Authentication, validation and error responses
db/connection.js       Pool and transaction helper
db/migrate.js          Checksum-verified migration runner
db/migrations/         Ordered PostgreSQL schema migrations
scripts/               Database checks, migration CLI, user provisioning
test/schema.test.js    Database, concurrency, API and frontend mapping tests
```

Use the feature service for each multi-record write. Do not update invoice totals, balances or stock directly; the schema derives these from line items and immutable ledgers. Pending invoices are edited by replacing active item snapshots inside one transaction. Delivery consumes stock; later payment can complete the invoice without touching stock again.

## Validation

```bash
npm run test:db
```

The suite includes real HTTP authentication/validation, invoice/payment/inventory workflows, the single generic case unit, supplier ownership, concurrency and migration integrity checks. See [TEST_COVERAGE.md](../TEST_COVERAGE.md) for the full matrix and `node scripts/test-all.mjs` to run both applications’ checks from `Project`.

Tests create a uniquely named `bevdist_test_*` database, migrate it, exercise the workflows, and drop that database when finished. The configured PostgreSQL role therefore needs permission to create databases. Tests do not seed, truncate, or clear `bevdist_db`.

Run `npm run db:migrate` again safely to verify there are no pending migrations. Migration 009 expects an empty business database before switching to the generic case unit; use a fresh development database when resetting mock records. Migration 010 generates invoice numbers as `INV-MMYYYY-NNNNNNNN`, and migration 014 generates supplier order numbers as `ORD-MMYYYY-NNNNNNNN`; both have independent counters for each Manila calendar month. Migration 012 seeds the client-listed suppliers and products with zero stock. Migration 013 stores supplier cost separately and applies the initial prices to catalog products with matching names. Migration 015 applies the latest Recibo supplier costs and selling prices only to matching saved products; unmatched products remain unchanged. Once applied, migration files must not be edited; add a new numbered migration for later schema changes. The runner applies pending changes atomically and serializes simultaneous migration attempts.

## Inspect in pgAdmin

Expand **Servers → BevDist Local → Databases → bevdist_db → Schemas → public**. Refresh **Tables** and **Views** after running migrations. `invoice_balances`, `inventory_stock`, and report summaries are views; their numbers are calculated from underlying records.

See [DATA_MODEL_SCHEMA_PLAN.md](DATA_MODEL_SCHEMA_PLAN.md) for tables, rules and remaining business decisions, and [API_CONTRACT.md](API_CONTRACT.md) for endpoint bodies and field mappings.

## Mobile authentication setup

Login now requires a real active account created with `npm run user:create -- <username>` in this backend directory. No default credentials are provided. Start the backend with `npm run dev` before signing in.

Copy `mobileFrontend/.env.example` to `mobileFrontend/.env.local` and set `EXPO_PUBLIC_API_URL`. For a physical phone, use the Mac's LAN IP and set backend `HOST=0.0.0.0`; both devices must reach the same network. Restart Expo after changing the URL. Expo's Metro tunnel does not expose the separate backend server.

The app loads persisted records after login and refreshes them after saves. A new database starts with empty business lists. Add a product in Inventory (including its supplier and opening stock), save a customer, then create an invoice. Confirmations precede writes. Inventory count changes require a reason; stale counts and changes below reserved stock are rejected. If the save result or refresh is uncertain, the app requires a refresh and review before further saves. Session tokens are held only in memory; app reload requires another sign-in. Failed network sign-out keeps the session available for retry; successful sign-out revokes the server session.

Current verification covers a real HTTP/database flow through the mobile API helpers and a web bundle export. Customer container deposit/return editing and signed PDF/XLSX lines are implemented. Manual Expo Go checks, including native file sharing, remain pending. Demo fixtures remain available for pure unit tests but are not loaded into the running app. No business data was inserted into the local app database during this implementation.
