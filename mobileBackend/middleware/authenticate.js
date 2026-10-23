const jwt = require('jsonwebtoken');
const { HttpError, asyncHandler } = require('./errors');

function authenticate(pool, secret) {
  return asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    let claims;
    try { claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'bevdist-api', audience: 'bevdist-mobile' }); }
    catch { throw new HttpError(401, 'Please sign in'); }
    if (typeof claims.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.sub)) throw new HttpError(401, 'Please sign in');
    const user = (await pool.query('SELECT id,username,session_version FROM app_users WHERE id=$1 AND is_active', [claims.sub])).rows[0];
    if (!user || user.session_version !== claims.version) throw new HttpError(401, 'Please sign in again');
    req.user = user;
    next();
  });
}

// Bounded in-memory throttling is sufficient for the single local server.
function loginLimiter() {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 60000 };
    if (++entry.count > 10 || (!attempts.has(key) && attempts.size >= 1000)) return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
    attempts.set(key, entry);
    next();
  };
}

module.exports = { authenticate, loginLimiter };
