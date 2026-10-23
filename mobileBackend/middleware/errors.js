class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (['23514', '23502', '22P02', '22003'].includes(error.code)) return res.status(400).json({ error: 'Invalid quantities, amounts, or required fields' });
  if (['23503', '23505', 'P0001', '40001', '40P01'].includes(error.code)) return res.status(409).json({ error: 'The operation conflicts with current records. Refresh and try again.' });
  console.error('API error:', error.code || error.name);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, asyncHandler, errorHandler };
