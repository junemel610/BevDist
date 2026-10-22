import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { invoiceSummary } from '../dashboard/salesSummary';

const peso = amount => Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = amount => Number(amount ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });
const safeInvoiceName = order => String(order.invoiceNumber || order.orderNumber || 'invoice').replace(/[^a-z0-9_-]/gi, '-');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function invoiceHtml(order, invoice) {
  const itemRows = order.items.map(item => {
    const price = Number(item.casePrice ?? item.unitPrice) || 0;
    const lineTotal = Number(item.quantity) * price;
    const caseType = item.packLabel || (item.unitsPerCase ? `${item.unitsPerCase} bottles/case` : 'Historical invoice line');
    return `<tr>
      <td>${escapeHtml(item.productName)}</td>
      <td>${escapeHtml(caseType)}</td>
      <td class="number">${quantity(item.quantity)}</td>
      <td class="number">₱${peso(price)}</td>
      <td class="number">₱${peso(lineTotal)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f172a; font-size: 12px; }
    .top { display:flex; justify-content:space-between; gap:24px; padding-bottom:20px; border-bottom:3px solid #1e3a8a; }
    h1 { color:#1e3a8a; font-size:22px; margin:0 0 6px; }
    .muted { color:#475569; line-height:1.6; }
    .invoice { text-align:right; }
    .invoice strong { display:block; font-size:19px; color:#1e3a8a; margin-bottom:5px; }
    .bill { margin:22px 0; padding:14px; background:#f1f5f9; border-radius:8px; }
    .label { color:#475569; font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:.06em; margin-bottom:5px; }
    .customer { font-weight:bold; font-size:14px; }
    table { border-collapse:collapse; width:100%; margin-top:10px; }
    th { background:#1e3a8a; color:white; text-align:left; padding:10px 8px; }
    td { padding:10px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
    tr { break-inside:avoid; }
    .number { text-align:right; white-space:nowrap; }
    .summary { width:55%; margin:22px 0 0 auto; }
    .sumrow { display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid #e2e8f0; }
    .grand { margin-top:8px; padding:12px; background:#1e3a8a; color:white; font-weight:bold; font-size:15px; border-radius:6px; }
    .status { margin-top:16px; padding:10px; background:#eff6ff; color:#1e3a8a; border-radius:6px; font-weight:bold; }
  </style></head><body>
    <div class="top"><div><h1>BevDist Distribution Co.</h1><div class="muted">Beverage distributor<br>Metro Manila, Philippines</div></div>
      <div class="invoice"><strong>INVOICE</strong><div>${escapeHtml(invoice.invoiceNumber)}</div><div class="muted">${escapeHtml(order.date)}</div></div>
    </div>
    <div class="bill"><div class="label">Billed to</div><div class="customer">${escapeHtml(order.customer.name)}</div>
      ${order.customer.contact ? `<div class="muted">${escapeHtml(order.customer.contact)}</div>` : ''}
      ${order.customer.address ? `<div class="muted">${escapeHtml(order.customer.address)}</div>` : ''}
    </div>
    <div class="label">Invoice items</div>
    <table><thead><tr><th>Product</th><th>Case type</th><th class="number">Cases</th><th class="number">Price / case</th><th class="number">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="summary">
      <div class="sumrow"><span>Subtotal</span><span>₱${peso(order.subtotal ?? order.grandTotal)}</span></div>
      <div class="sumrow"><span>Payments received</span><span>−₱${peso(invoice.amountPaid)}</span></div>
      <div class="sumrow"><span>Remaining balance</span><span>₱${peso(invoice.remainingBalance)}</span></div>
      <div class="sumrow grand"><span>Grand total</span><span>₱${peso(order.grandTotal)}</span></div>
    </div>
    <div class="status">Payment status: ${escapeHtml(invoice.status)}</div>
  </body></html>`;
}

function invoiceWorkbook(order, invoice) {
  const rows = [
    ['BevDist Distribution Co.'],
    ['INVOICE', invoice.invoiceNumber],
    ['Date', order.date],
    ['Customer', order.customer.name],
    ['Contact', order.customer.contact || ''],
    ['Address', order.customer.address || ''],
    [],
    ['Product', 'Case type', 'Quantity (cases)', 'Price per case (PHP)', 'Line total (PHP)'],
    ...order.items.map(item => {
      const price = Number(item.casePrice ?? item.unitPrice) || 0;
      return [
        item.productName,
        item.packLabel || (item.unitsPerCase ? `${item.unitsPerCase} bottles/case` : 'Historical invoice line'),
        Number(item.quantity) || 0,
        price,
        (Number(item.quantity) || 0) * price,
      ];
    }),
    [],
    ['Subtotal (PHP)', Number(order.subtotal ?? order.grandTotal) || 0],
    ['Payments received (PHP)', invoice.amountPaid],
    ['Remaining balance (PHP)', invoice.remainingBalance],
    ['Grand total (PHP)', Number(order.grandTotal) || 0],
    ['Payment status', invoice.status],
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 18 }, { wch: 23 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice');
  return workbook;
}

export async function exportInvoicePdf(order, balance) {
  const invoice = invoiceSummary(order, balance);
  const html = invoiceHtml(order, invoice);
  if (Platform.OS === 'web') {
    await Print.printToFileAsync({ html });
    return;
  }
  const result = await Print.printToFileAsync({ html, base64: true });
  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!directory || !result.base64) throw new Error('Could not save the generated PDF on this device.');
  const uri = `${directory}invoice-${safeInvoiceName(order)}.pdf`;
  await FileSystem.writeAsStringAsync(uri, result.base64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: '.pdf',
    dialogTitle: `Invoice ${invoice.invoiceNumber}`,
  });
}

export async function exportInvoiceExcel(order, balance) {
  const invoice = invoiceSummary(order, balance);
  const workbook = invoiceWorkbook(order, invoice);
  const filename = `invoice-${safeInvoiceName(order)}.xlsx`;
  if (Platform.OS === 'web') {
    XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });
    return;
  }

  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('Device storage is unavailable.');
  const uri = `${directory}${filename}`;
  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
    dialogTitle: `Invoice ${invoice.invoiceNumber}`,
  });
}
