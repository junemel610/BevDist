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

export function nextSupplierOrderNumber(records, date = new Date()) {
  const period = manilaPeriod(date);
  const prefix = `ORD-${period}-`;
  const highest = (records || []).reduce((max, record) => {
    const number = String(record.orderNumber || '');
    if (!number.startsWith(prefix)) return max;
    const match = number.match(/^ORD-\d{6}-(\d{8})$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(8, '0')}`;
}
