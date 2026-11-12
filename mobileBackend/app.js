const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('./middleware/authenticate');
const { asyncHandler, errorHandler } = require('./middleware/errors');
const { authRoutes } = require('./routes/auth');
const { invoiceRoutes } = require('./routes/invoices');
const { paymentRoutes } = require('./routes/payments');
const { supplierOrderRoutes } = require('./routes/supplierOrders');
const { catalogRoutes } = require('./routes/catalog');
const { appDataController } = require('./controllers/appDataController');

function createApp(pool, secret) {
  if (!secret || secret.length < 32 || /change|your_jwt_secret/i.test(secret)) throw new Error('Set a strong JWT_SECRET of at least 32 characters');
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '128kb' }));
  const frontendDist = path.resolve(__dirname, '../mobileFrontend/dist');
  const frontendIndex = path.join(frontendDist, 'index.html');
  const hasFrontendBuild = fs.existsSync(frontendIndex);
  if (hasFrontendBuild) app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
  app.get('/health', asyncHandler(async (req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
    catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
  }));
  if (hasFrontendBuild) {
    const apiPrefixes = ['/auth', '/app-data', '/customers', '/suppliers', '/products', '/invoices', '/supplier-orders'];
    app.get('*', (req, res, next) => {
      if (req.path === '/health' || apiPrefixes.some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`))) return next();
      res.set('Cache-Control', 'no-cache');
      return res.sendFile(frontendIndex, error => { if (error) next(error); });
    });
  }
  app.use('/auth', authRoutes(pool, secret));
  app.use(authenticate(pool, secret));
  app.get('/app-data', asyncHandler(appDataController(pool)));
  app.use(catalogRoutes(pool));
  app.use('/invoices', invoiceRoutes(pool));
  app.use('/customers', paymentRoutes(pool));
  app.use('/supplier-orders', supplierOrderRoutes(pool));
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
