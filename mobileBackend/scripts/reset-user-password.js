const readline = require('node:readline');
const { Writable } = require('node:stream');
const bcrypt = require('bcryptjs');
const { createPool } = require('../db/connection');

async function readHiddenPassword() {
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal');
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  try {
    const password = await new Promise(resolve => {
      rl.question('New password (12+ characters; hidden): ', resolve);
      muted = true;
    });
    return password;
  } finally {
    muted = false;
    rl.close();
    process.stdout.write('\n');
  }
}

async function main() {
  const username = process.argv[2]?.trim();
  if (!username || username.length > 100) throw new Error('Usage: npm run user:reset -- username');
  const password = await readHiddenPassword();
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Use at least 12 characters and at most 72 UTF-8 bytes');
  }

  const pool = createPool();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `UPDATE app_users
       SET password_hash = $1, session_version = session_version + 1
       WHERE lower(username) = lower($2) AND is_active
       RETURNING username`,
      [passwordHash, username],
    );
    if (!result.rowCount) throw new Error(`Active user '${username}' was not found`);
    console.log(`Password reset for '${result.rows[0].username}'. Existing sessions have been invalidated.`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
