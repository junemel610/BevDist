export const INVOICE_BUSINESS = {
  name: "Mila's Store",
  street: '737 San Diego St',
  city: 'Sampaloc, Manila, 1008',
  contact: 'CP 09569569553, TEL: 856-70568',
};

export function formatInvoiceDate(value = new Date()) {
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T12:00:00+08:00`)
      : new Date(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
}
