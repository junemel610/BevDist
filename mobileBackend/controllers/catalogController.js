const catalog = require('../services/catalogService');
const catalogController = pool => ({
  customer: async (req, res) => res.status(req.params.id ? 200 : 201).json(await catalog.saveCustomer(pool, req.params.id, req.body)),
  supplier: async (req, res) => res.status(req.params.id ? 200 : 201).json(await catalog.saveSupplier(pool, req.params.id, req.body)),
  product: async (req, res) => res.status(req.params.id ? 200 : 201).json(await catalog.saveProduct(pool, req.params.id, req.body)),
  archive: async (req, res) => { await catalog.archiveProduct(pool, req.params.id); res.sendStatus(204); },
  adjust: async (req, res) => res.status(201).json(await catalog.adjustStock(pool, req.params.id, req.body, req.user.id)),
});
module.exports = { catalogController };
