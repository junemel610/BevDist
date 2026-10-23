const { createInvoice, editInvoice, transitionInvoice } = require('../services/invoiceService');

function invoiceController(pool) {
  return {
    create: async (req, res) => res.status(201).json({ id: await createInvoice(pool, req.body, req.user.id) }),
    edit: async (req, res) => res.json({ id: await editInvoice(pool, req.params.id, req.body) }),
    deliver: async (req, res) => res.json({ id: await transitionInvoice(pool, req.params.id, 'deliver') }),
    cancel: async (req, res) => res.json({ id: await transitionInvoice(pool, req.params.id, 'cancel', req.body.reason) }),
  };
}
module.exports = { invoiceController };
