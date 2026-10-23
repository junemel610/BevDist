const { HttpError } = require('./errors');
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
const amount = value => ['string', 'number'].includes(typeof value) && /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) <= 9999999999.99;
const quantity = value => amount(value) && Number(value) > 0 && Number(value) <= 99999999.5 && Number.isInteger(Number(value) * 2);
const list = (value, predicate, required = false) => Array.isArray(value) && value.length <= 100 && (!required || value.length > 0) && value.every(predicate);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const item = value => value && uuid(value.productId) && text(value.packId) && quantity(value.quantity);
const returned = value => value && (!value.returnTypeId || uuid(value.returnTypeId)) && text(value.type) && quantity(value.quantity);

function validate(predicate, message) {
  return (req, res, next) => {
    try {
      if (!predicate(req)) throw new HttpError(400, message);
      next();
    } catch (error) { next(error instanceof HttpError ? error : new HttpError(400, message)); }
  };
}

const idParam = name => validate(req => uuid(req.params[name]), 'Invalid record ID');
const invoiceBody = validate(req => req.body && list(req.body.items, item, true)
  && list(req.body.containerReturns ?? [], r => returned(r) && amount(r.refundPerCase)), 'Provide valid invoice items and container refunds');
const invoiceCreate = validate(req => req.body && uuid(req.body.customerId) && uuid(req.body.requestKey) && date(req.body.dueDate), 'Customer, due date, and request key are required');
const paymentBody = validate(req => req.body && uuid(req.body.requestKey) && amount(req.body.amountReceived)
  && Number(req.body.amountReceived) > 0 && ['Cash','GCash','Bank Transfer'].includes(req.body.method)
  && (req.body.reference == null || text(req.body.reference)), 'Provide a valid payment amount, method, and request key');
const supplierBody = validate(req => req.body && uuid(req.body.supplierId) && uuid(req.body.requestKey)
  && list(req.body.items, r => item(r) && amount(r.unitCost) && Number(r.unitCost)>0, true)
  && list(req.body.returnedCases ?? [], r => returned(r) && amount(r.creditPerUnit)), 'Provide valid supplier order items and returns');
const loginBody = validate(req => req.body && text(req.body.username) && typeof req.body.password === 'string'
  && req.body.password.length > 0 && Buffer.byteLength(req.body.password, 'utf8') <= 72, 'Username and password are required');
const cancelBody = validate(req => req.body && text(req.body.reason), 'A cancellation reason is required');

const profile = body => body && text(body.name)
  && [body.contact, body.address].every(value => value == null || (typeof value === 'string' && value.length <= 500));
const profileBody = validate(req => profile(req.body), 'Provide a name and valid contact details');
const productBody = validate(req => req.body && text(req.body.name) && (uuid(req.body.supplierId) || (!req.body.supplierId && text(req.body.supplierName)))
  && list(req.body.packs, p => p && text(p.packId) && amount(p.casePrice) && Number(p.casePrice) > 0
    && (p.lowStockThreshold == null || (amount(p.lowStockThreshold) && Number(p.lowStockThreshold) <= 99999999.5 && Number.isInteger(Number(p.lowStockThreshold) * 2))), true)
  && req.body.packs.every(p => p.totalStock == null || (amount(p.totalStock) && Number(p.totalStock) <= 99999999.5
    && Number.isInteger(Number(p.totalStock) * 2) && text(req.body.stockReason)
    && (!req.params.id || (amount(p.expectedStock) && Number.isInteger(Number(p.expectedStock) * 2)))))
  && new Set(req.body.packs.map(p => p.packId)).size === req.body.packs.length, 'Provide a supplier and unique case types with valid prices and thresholds');
const stockBody = validate(req => req.body && uuid(req.body.requestKey) && text(req.body.packId) && text(req.body.reason)
  && ['string', 'number'].includes(typeof req.body.quantityDelta) && /^-?\d+(\.\d{1,2})?$/.test(String(req.body.quantityDelta))
  && quantity(Math.abs(Number(req.body.quantityDelta))), 'Provide a nonzero half-case adjustment, reason, and request key');

module.exports = { profileBody, productBody, stockBody, idParam, invoiceBody, invoiceCreate, paymentBody, supplierBody, loginBody, cancelBody };
