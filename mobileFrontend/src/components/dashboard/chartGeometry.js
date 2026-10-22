// Geometry is independent of the renderer so zero/empty series stay safe.
export function chartGeometry(values, width = 360, height = 204) {
  const left = 56;
  const right = width - 20;
  const top = 12;
  const bottom = height - 30;
  const maximum = Math.max(1, ...values);
  const unit = 10 ** Math.floor(Math.log10(maximum));
  const ceiling = Math.ceil(maximum / unit) * unit;
  const slot = (right - left) / Math.max(1, values.length);
  const points = values.map((value, index) => ({
    x: left + slot * (index + 0.5),
    y: bottom - (Math.max(0, value) / ceiling) * (bottom - top),
  }));
  return { left, right, top, bottom, ceiling, slot, points };
}

export const formatPeso = (amount) => `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
export const formatAxis = (amount) => amount >= 1000 ? `₱${Number((amount / 1000).toFixed(1))}k` : `₱${amount}`;
