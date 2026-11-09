function manilaPeriod(date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const month = parts.find(part => part.type === 'month')?.value;
  const year = parts.find(part => part.type === 'year')?.value;
  return `${month}${year}`;
}

export function nextInvoiceNumber(orders, date = new Date()) {
  const period = manilaPeriod(date);
  const prefix = `INV-${period}-`;
  const highest = (orders || []).reduce((max, order) => {
    const number = String(order.invoiceNumber || '');
    if (!number.startsWith(prefix)) return max;
    const match = number.match(/^INV-\d{6}-(\d{8})$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(8, '0')}`;
}
