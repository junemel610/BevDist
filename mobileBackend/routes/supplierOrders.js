const { Router } = require('express');
const { supplierOrderController } = require('../controllers/supplierOrderController');
const { asyncHandler } = require('../middleware/errors');
const { supplierBody } = require('../middleware/validate');
function supplierOrderRoutes(pool) {
  const router = Router();
  router.post('/', supplierBody, asyncHandler(supplierOrderController(pool)));
  return router;
}
module.exports = { supplierOrderRoutes };
