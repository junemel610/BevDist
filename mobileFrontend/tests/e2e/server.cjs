const path = require('node:path');
const { createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
const backend = createRequire(path.resolve(__dirname, '../../../mobileBackend/package.json'));
backend('dotenv').config({ path: path.resolve(__dirname, '../../../mobileBackend/.env'), quiet: true });
const { createPool } = backend('./db/connection');
const { migrate } = backend('./db/migrate');
const { createApp } = backend('./app');
const bcrypt = backend('bcryptjs');
const { username, password, apiURL } = require('./settings.cjs');

// Only this generated database is migrated, seeded, or removed.
const database = `bevdist_e2e_${process.pid}_${Date.now()}`;
const admin = createPool();
let pool, server, created = false, closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  try {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
  } catch (error) { console.error('E2E cleanup failed:', error.message); code = 1; }
  finally { await admin.end(); process.exit(code); }
}
async function start() {
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  pool = createPool(url.href);
  await migrate(pool);
  await pool.query('INSERT INTO app_users(username,password_hash) VALUES ($1,$2)', [username, await bcrypt.hash(password, 12)]);
  const app = createApp(pool, randomBytes(32).toString('hex'));
  // Test clients have distinct simulated IPs; keep production login throttling intact.
  app.set('trust proxy', 'loopback');
  server = app.listen(Number(new URL(apiURL).port), '127.0.0.1', () => console.log(`E2E API ready: ${apiURL}`));
  server.on('error', error => { console.error(error.message); void close(1); });
  process.once('SIGTERM', () => { void close(); });
  process.once('SIGINT', () => { void close(); });
}
start().catch(error => { console.error('E2E setup failed:', error.code || error.message || error.name, error.stack); void close(1); });
