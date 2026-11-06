export function formatCaseQuantity(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value ?? '0');
  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute);
  const fraction = absolute - whole;
  if (Math.abs(fraction - 0.5) < 0.000001) return `${sign}${whole ? `${whole} ` : ''}1/2`;
  if (fraction < 0.000001) return `${sign}${whole}`;
  return `${sign}${absolute.toLocaleString('en-PH', { maximumFractionDigits: 3 })}`;
}
