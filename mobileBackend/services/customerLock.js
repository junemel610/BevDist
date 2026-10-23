const { HttpError } = require('../middleware/errors');
async function lockCustomer(client, customerId) {
  const result = await client.query('SELECT id FROM customers WHERE id=$1 AND is_active FOR UPDATE', [customerId]);
  if (!result.rowCount) throw new HttpError(404, 'Customer is missing or archived');
}


module.exports = { lockCustomer };
