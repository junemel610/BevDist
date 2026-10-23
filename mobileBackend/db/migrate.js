const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { transaction } = require('./connection');

async function migrate(pool) {
  return transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(68743125)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const directory = path.join(__dirname, 'migrations');
    const names = (await fs.readdir(directory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort();
    const applied = (await client.query('SELECT name, checksum FROM schema_migrations')).rows;
    for (const old of applied) {
      if (!names.includes(old.name)) throw new Error(`Applied migration missing: ${old.name}`);
    }
    const completed = [];
    for (const name of names) {
      const sql = await fs.readFile(path.join(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const old = applied.find(row => row.name === name);
      if (old) {
        if (old.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)', [name, checksum]);
      completed.push(name);
    }
    return completed;
  });
}

module.exports = { migrate };
