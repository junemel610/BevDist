# BevDist backend

Node.js + Express + PostgreSQL 15 for BevDist. The schema, transaction services, and authenticated catalog/invoice/payment/supplier endpoints are implemented. Mobile screens still use demo state; see [API_CONTRACT.md](API_CONTRACT.md) before connecting live reads and writes.

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

The server listens on `127.0.0.1:5000` by default. `GET /health` verifies database connectivity. Configure `HOST=0.0.0.0` only when intentionally testing over your local network. A physical phone must use the Mac's network address for `EXPO_PUBLIC_API_URL`.

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

Tests create a uniquely named `bevdist_test_*` database, migrate it, exercise the workflows, and drop that database when finished. The configured PostgreSQL role therefore needs permission to create databases. Tests do not seed, truncate, or clear `bevdist_db`.

Run `npm run db:migrate` again safely to verify there are no pending migrations. Once applied, migration files must not be edited; add a new numbered migration for later schema changes. The runner applies pending changes atomically and serializes simultaneous migration attempts.

## Inspect in pgAdmin

Expand **Servers → BevDist Local → Databases → bevdist_db → Schemas → public**. Refresh **Tables** and **Views** after running migrations. `invoice_balances`, `inventory_stock`, and report summaries are views; their numbers are calculated from underlying records.

See [DATA_MODEL_SCHEMA_PLAN.md](DATA_MODEL_SCHEMA_PLAN.md) for tables, rules and remaining business decisions, and [API_CONTRACT.md](API_CONTRACT.md) for endpoint bodies and field mappings.
