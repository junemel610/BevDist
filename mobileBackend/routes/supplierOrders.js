const { Router } = require('express');
const { supplierOrderController, supplierOrderEditController } = require('../controllers/supplierOrderController');
const { asyncHandler } = require('../middleware/errors');
const { supplierBody, supplierOrderEditBody, idParam } = require('../middleware/validate');
function supplierOrderRoutes(pool) {
  const router = Router();
  router.post('/', supplierBody, asyncHandler(supplierOrderController(pool)));
  router.put('/:id', idParam('id'), supplierOrderEditBody, asyncHandler(supplierOrderEditController(pool)));
  return router;
}
module.exports = { supplierOrderRoutes };
