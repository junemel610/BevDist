# BevDist POS — Backend API

Node.js + Express REST API for the Jojo's Coke Beverage Distribution POS system.

## Setup

```bash
npm install
npm run dev
```

API will run on `http://localhost:5000`

## Environment

Create a `.env` file:

```
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/bevdist_db
JWT_SECRET=your_jwt_secret_key_change_in_production
```

## Database

PostgreSQL setup and migrations coming next. For now, set up a local PostgreSQL database:

```bash
createdb bevdist_db
```

## Project Structure

```
/
├── server.js         # Express app entry point
├── routes/           # API endpoints
├── controllers/      # Business logic
├── services/         # Database and external service calls
├── middleware/       # Auth, validation, error handling
└── models/           # Database models and queries
```

## Development

Follow the `bevdist-stack` skill in the parent `.claude/skills/` directory for guidance on:
- API design and validation
- Database schema
- Authentication
- Error handling
