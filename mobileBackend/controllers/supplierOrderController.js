const { receiveSupplierOrder } = require('../services/supplierOrderService');
const supplierOrderController = pool => async (req, res) => res.status(201).json({ id: await receiveSupplierOrder(pool, req.body, req.user.id) });
module.exports = { supplierOrderController };
