class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error.code === '23505' && error.constraint === 'customers_normalized_name_unique') {
    return res.status(409).json({ error: 'A customer with this name already exists. Select the existing customer instead.' });
  }
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (['23514', '23502', '22P02', '22003'].includes(error.code)) return res.status(400).json({ error: 'Invalid quantities, amounts, or required fields' });
  const requestPath = (req.originalUrl || req.url || '').split('?')[0];
  if (error.code === 'P0001' && req.method === 'PUT' && requestPath.startsWith('/supplier-orders/')) {
    return res.status(409).json({ error: error.message });
  }
  if (['40001', '40P01'].includes(error.code)) {
    return res.status(409).json({ error: 'Another inventory update happened at the same time. Refresh records and try again.' });
  }
  if (['23503', '23505', 'P0001', '40001', '40P01'].includes(error.code)) return res.status(409).json({ error: 'The operation conflicts with current records. Refresh and try again.' });
  console.error('API error:', error.code || error.name);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, asyncHandler, errorHandler };
