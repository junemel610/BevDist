const { recordPayment } = require('../services/paymentService');
const paymentController = pool => async (req, res) => {
  const id = await recordPayment(pool, { ...req.body, customerId: req.params.customerId }, req.user.id);
  res.status(201).json({ id });
};
module.exports = { paymentController };
