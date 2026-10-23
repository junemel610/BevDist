const { createPool } = require('../db/connection');
const { migrate } = require('../db/migrate');

async function main() {
  const pool = createPool();
  try {
    const applied = await migrate(pool);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Schema is up to date.');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Migration failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
