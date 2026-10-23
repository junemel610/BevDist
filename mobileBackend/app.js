const express = require('express');
const cors = require('cors');
const { authenticate } = require('./middleware/authenticate');
const { asyncHandler, errorHandler } = require('./middleware/errors');
const { authRoutes } = require('./routes/auth');
const { invoiceRoutes } = require('./routes/invoices');
const { paymentRoutes } = require('./routes/payments');
const { supplierOrderRoutes } = require('./routes/supplierOrders');
const { appDataController } = require('./controllers/appDataController');

function createApp(pool, secret) {
  if (!secret || secret.length < 32 || /change|your_jwt_secret/i.test(secret)) throw new Error('Set a strong JWT_SECRET of at least 32 characters');
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '128kb' }));
  app.get('/health', asyncHandler(async (req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
    catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
  }));
  app.use('/auth', authRoutes(pool, secret));
  app.use(authenticate(pool, secret));
  app.get('/app-data', asyncHandler(appDataController(pool)));
  app.use('/invoices', invoiceRoutes(pool));
  app.use('/customers', paymentRoutes(pool));
  app.use('/supplier-orders', supplierOrderRoutes(pool));
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
