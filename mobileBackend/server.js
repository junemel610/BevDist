const { createPool } = require('./db/connection');
const { createApp } = require('./app');

const pool = createPool();
const app = createApp(pool, process.env.JWT_SECRET);
const port = Number(process.env.PORT || 5000);
pool.on('error', error => console.error('Idle database connection failed:', error.code));
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`BevDist API listening on port ${port}`));
function shutdown() { server.close(() => pool.end()); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
