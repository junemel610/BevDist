const { Router } = require('express');
const { authController } = require('../controllers/authController');
const { asyncHandler } = require('../middleware/errors');
const { loginBody } = require('../middleware/validate');
const { authenticate, loginLimiter } = require('../middleware/authenticate');
function authRoutes(pool, secret) {
  const router = Router(), controller = authController(pool, secret);
  router.post('/login', loginLimiter(), loginBody, asyncHandler(controller.login));
  router.post('/logout', authenticate(pool, secret), asyncHandler(controller.logout));
  return router;
}
module.exports = { authRoutes };
