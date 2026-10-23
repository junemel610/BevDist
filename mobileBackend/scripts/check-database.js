require('dotenv').config();
const { Client } = require('pg');

async function checkDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env first.');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const { rows } = await client.query('SELECT current_database() AS database, version() AS version');
    console.log(`Connected to ${rows[0].database}`);
    console.log(rows[0].version);
  } finally {
    await client.end();
  }
}

checkDatabase().catch(() => {
  console.error('Database connection failed. Check PostgreSQL is running and DATABASE_URL is configured correctly.');
  process.exitCode = 1;
});
