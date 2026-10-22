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
