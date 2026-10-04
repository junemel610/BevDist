# BevDist POS — React Native + Node.js + Express + PostgreSQL

Full-stack development guidance for the Jojo's Coke Beverage Distribution POS system. This skill applies to React Native mobile app development, Node.js/Express backend API, PostgreSQL database, and their integration.

**Design Reference:** The web prototype in this directory (built with React + Vite + Figma Make) defines the UI/UX and business logic. Port the flows, screens, and features to React Native.

## Stack

- **Mobile:** React Native (cross-platform iOS/Android)
- **Backend:** Node.js + Express.js REST API
- **Database:** PostgreSQL with persistent data
- **Authentication:** JWT tokens (or similar session-based)

## React Native

- Follow existing project structure and naming conventions.
- Keep UI components focused on presentation; separate business logic into hooks and services.
- Use a consistent navigation pattern (React Navigation or similar).
- Keep API communication in a dedicated API/services layer.
- Reuse existing components and utilities across screens.
- Validate user input before submission.
- Handle loading, success, empty, and error states.
- Use platform-specific styles or conditional rendering only when necessary.
- Keep bundle size minimal — avoid heavy dependencies when lighter alternatives exist.

## Node.js / Express Backend

- Organize code into clear layers: routes → controllers → services → database access.
- Validate and sanitize all incoming request data.
- Use consistent HTTP status codes and response formats.
- Centralize error handling and logging.
- Never expose sensitive information (passwords, API keys, internal error details) in responses.
- Implement rate limiting and basic input validation on all endpoints.
- Use transactions for multi-step operations (e.g., order creation + inventory deduction).
- Document API endpoints with clear request/response examples.

## PostgreSQL

- Use parameterized queries to prevent SQL injection.
- Design schema to reflect the domain (Products, Customers, Orders, Balances, Restocks, etc.).
- Respect relationships and foreign key constraints.
- Use transactions when multiple operations must succeed or fail together.
- Add indexes on frequently queried columns (e.g., `orders.customer_id`, `balances.status`).
- Preserve data integrity with NOT NULL, UNIQUE, and CHECK constraints where appropriate.
- Avoid unnecessary schema changes after deployment.

## API Design (Mobile ↔ Backend)

- Keep request/response structures consistent across all endpoints.
- Return meaningful error messages and appropriate HTTP status codes.
- Handle network timeouts and server errors gracefully on the mobile client.
- Use pagination for large result sets (orders, products, balance records).
- Include timestamps (created_at, updated_at) in all resources.
- Do not duplicate business logic between frontend and backend — calculate once on the backend.

## Domain Model (Port from Prototype)

The prototype defines these core entities. Implement in the database:

- **Products** — Coca-Cola, Pepsi, Magnolia variants; track supplier, unit cost, and stock levels
- **Customers** — Store name, contact, address; track payment method and credit limit
- **Orders** — Customer, items, total amount, status (pending/completed/cancelled), due date
- **OrderItems** — Product, quantity, unit price per order
- **Balances** — Customer outstanding invoices, payment method, due date, status (unpaid/paid/overdue)
- **Inventory** — Product stock levels (total, reserved by pending orders, available)
- **Restocks** — Supplier deliveries; track products received, quantities, and returned case credits
- **Users** — System users (cashiers, managers); track role and login credentials

## Development Rules

1. **Inspect before changing** — Read existing code and understand the pattern before modifying.
2. **Follow conventions** — Match the project's existing style, naming, and architecture.
3. **Reuse, don't reinvent** — Use existing functions, components, and services.
4. **Make the smallest change necessary** — Avoid scope creep and unnecessary refactoring.
5. **Explain architectural decisions** — If introducing a new pattern or library, justify it first.
6. **Do not rewrite working code** — Only refactor if there's a clear reason (bug fix, performance, maintainability).
7. **Test before shipping** — Verify changes work on device or emulator, not just in isolation.

## Security Notes

- Hash and salt passwords (use bcrypt or similar).
- Validate JWT tokens on every protected endpoint.
- Use HTTPS in production.
- Store sensitive data (API keys, DB credentials) in environment variables, never in code.
- Implement CORS appropriately for your deployment.
- Log authentication failures and suspicious activity.
