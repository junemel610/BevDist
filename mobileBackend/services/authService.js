const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { HttpError } = require('../middleware/errors');

async function login(pool, username, password, secret) {
  const user = (await pool.query('SELECT * FROM app_users WHERE lower(username)=lower($1) AND is_active', [username.trim()])).rows[0];
  if (!user || !await bcrypt.compare(password, user.password_hash)) throw new HttpError(401, 'Invalid username or password');
  return {
    token: jwt.sign({ sub: user.id, version: user.session_version }, secret, { algorithm: 'HS256', expiresIn: '8h', issuer: 'bevdist-api', audience: 'bevdist-mobile' }),
    user: { id: user.id, username: user.username },
  };
}

async function logout(pool, userId) {
  await pool.query('UPDATE app_users SET session_version=session_version+1 WHERE id=$1', [userId]);
}
module.exports = { login, logout };
