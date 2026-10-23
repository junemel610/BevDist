const { Router } = require('express');
const { catalogController } = require('../controllers/catalogController');
const { asyncHandler } = require('../middleware/errors');
const { idParam, profileBody, productBody, stockBody } = require('../middleware/validate');
function catalogRoutes(pool) {
  const router = Router();
  const controller = catalogController(pool);
  for (const [path, action, body] of [
    ['/customers', controller.customer, profileBody],
    ['/suppliers', controller.supplier, profileBody],
    ['/products', controller.product, productBody],
  ]) {
    router.post(path, body, asyncHandler(action));
    router.put(`${path}/:id`, idParam('id'), body, asyncHandler(action));
  }
  router.delete('/products/:id', idParam('id'), asyncHandler(controller.archive));
  router.post('/products/:id/stock-adjustments', idParam('id'), stockBody, asyncHandler(controller.adjust));
  return router;
}
module.exports = { catalogRoutes };
