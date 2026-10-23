const { login, logout } = require('../services/authService');
function authController(pool, secret) {
  return {
    login: async (req, res) => res.json(await login(pool, req.body.username, req.body.password, secret)),
    logout: async (req, res) => { await logout(pool, req.user.id); res.sendStatus(204); },
  };
}
module.exports = { authController };
