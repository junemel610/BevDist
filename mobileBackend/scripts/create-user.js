const readline = require('node:readline');
const { Writable } = require('node:stream');
const bcrypt = require('bcryptjs');
const { createPool } = require('../db/connection');

async function main() {
  const username = process.argv[2]?.trim();
  if (!username || username.length > 100) throw new Error('Usage: npm run user:create -- username');
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal');
  let muted = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  const password = await new Promise(resolve => {
    rl.question('Password (12+ characters; hidden): ', resolve);
    muted = true;
  });
  muted = false;
  rl.close();
  process.stdout.write('\n');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Use at least 12 characters and at most 72 UTF-8 bytes');
  const pool = createPool();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO app_users(username,password_hash) VALUES ($1,$2)', [username, passwordHash]);
    console.log('User created. Sign in using this username and password.');
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.code === '23505' ? 'Username already exists' : error.message); process.exitCode = 1; });
