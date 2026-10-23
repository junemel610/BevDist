const { Router } = require('express');
const { paymentController } = require('../controllers/paymentController');
const { asyncHandler } = require('../middleware/errors');
const { idParam, paymentBody } = require('../middleware/validate');
function paymentRoutes(pool) {
  const router = Router();
  router.post('/:customerId/payments', idParam('customerId'), paymentBody, asyncHandler(paymentController(pool)));
  return router;
}
module.exports = { paymentRoutes };
