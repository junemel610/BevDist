const { Router } = require('express');
const { invoiceController } = require('../controllers/invoiceController');
const { asyncHandler } = require('../middleware/errors');
const { idParam, invoiceBody, invoiceCreate, cancelBody } = require('../middleware/validate');
function invoiceRoutes(pool) {
  const router = Router(), controller = invoiceController(pool);
  router.post('/', invoiceCreate, invoiceBody, asyncHandler(controller.create));
  router.put('/:id', idParam('id'), invoiceBody, asyncHandler(controller.edit));
  router.post('/:id/deliver', idParam('id'), asyncHandler(controller.deliver));
  router.post('/:id/cancel', idParam('id'), cancelBody, asyncHandler(controller.cancel));
  return router;
}
module.exports = { invoiceRoutes };
