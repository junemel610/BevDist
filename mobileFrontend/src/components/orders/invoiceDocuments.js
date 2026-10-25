import * as XLSX from '@redoper1/xlsx-js-style';
import { refundAmount, caseLineAmount } from './containerReturns.js';
import { casePackDisplay } from './casePacks.js';

const peso = amount => Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = amount => Number(amount ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function invoiceHtml(order, invoice) {
  const itemRows = order.items.map(item => {
    const price = Number(item.casePrice ?? item.unitPrice) || 0;
    const lineTotal = caseLineAmount(item.quantity, price);
    const caseType = item.unitsPerCase ? casePackDisplay({ id: item.packId, label: item.packLabel, unitsPerCase: item.unitsPerCase }) : item.packLabel || 'Historical invoice line';
    return `<tr>
      <td>${escapeHtml(item.productName)}</td>
      <td>${escapeHtml(caseType)}</td>
      <td class="number">${quantity(item.quantity)}</td>
      <td class="number">₱${peso(price)}</td>
      <td class="number">₱${peso(lineTotal)}</td>
    </tr>`;
  }).join('');
  const returnRows = (order.containerReturns || []).map(entry => `<tr>
    <td>${escapeHtml(entry.type)}</td><td>Container refund</td>
    <td class="number">${quantity(entry.quantity)}</td><td class="number">₱${peso(entry.refundPerCase)}</td>
    <td class="number">−₱${peso(refundAmount(entry))}</td></tr>`).join('');

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
    <table><thead><tr><th>Product</th><th>Case type</th><th class="number">Cases</th><th class="number">Price / refund per case</th><th class="number">Amount</th></tr></thead><tbody>${itemRows}${returnRows}</tbody></table>
    <div class="summary">
      <div class="sumrow"><span>Subtotal</span><span>₱${peso(order.subtotal ?? order.grandTotal)}</span></div>
      <div class="sumrow"><span>Container refunds</span><span>−₱${peso(order.containerRefundTotal || 0)}</span></div>
      <div class="sumrow"><span>Payments and credit applied</span><span>−₱${peso(invoice.amountPaid)}</span></div>
      <div class="sumrow"><span>Remaining balance</span><span>₱${peso(invoice.remainingBalance)}</span></div>
      <div class="sumrow grand"><span>Grand total</span><span>₱${peso(order.grandTotal)}</span></div>
    </div>
    <div class="status">Payment status: ${escapeHtml(invoice.status)}</div>
  </body></html>`;
}

export function invoiceWorkbook(order, invoice) {
  const navy = 'FF1E3A8A';
  const ink = 'FF0F172A';
  const muted = 'FF475569';
  const pale = 'FFF1F5F9';
  const border = 'FFE2E8F0';
  const white = 'FFFFFFFF';
  const returnEntries = order.containerReturns || [];
  const itemCount = order.items.length + returnEntries.length;
  const rows = [
    ['BEVDIST DISTRIBUTION CO.'],
    ['Beverage distributor · Metro Manila, Philippines'],
    [],
    [`INVOICE  ·  ${invoice.invoiceNumber}`],
    [`Issue date: ${order.date}`],
    [],
    ['BILLED TO', null, 'INVOICE SUMMARY'],
    [order.customer.name, null, 'Invoice total', null, Number(order.grandTotal) || 0],
    [order.customer.contact || '—', null, 'Payments and credit applied', null, invoice.amountPaid],
    [order.customer.address || '—', null, 'Balance due', null, invoice.remainingBalance],
    [],
    ['ITEMIZED CASES'],
    ['Product', 'Case type', 'Quantity (cases)', 'Price / refund per case', 'Amount'],
    ...order.items.map(item => {
      const price = Number(item.casePrice ?? item.unitPrice) || 0;
      return [
        item.productName,
        item.unitsPerCase ? casePackDisplay({ id: item.packId, label: item.packLabel, unitsPerCase: item.unitsPerCase }) : item.packLabel || 'Historical invoice line',
        Number(item.quantity) || 0,
        price,
        caseLineAmount(item.quantity || 0, price),
      ];
    }),
    ...returnEntries.map(entry => [`Returned: ${entry.type}`, 'Container refund', Number(entry.quantity), Number(entry.refundPerCase), -refundAmount(entry)]),
    [],
    ['Subtotal', null, null, null, Number(order.subtotal ?? order.grandTotal) || 0],
    ['Container refunds', null, null, null, -(Number(order.containerRefundTotal) || 0)],
    ['Payments and credit applied', null, null, null, invoice.amountPaid],
    ['Remaining balance', null, null, null, invoice.remainingBalance],
    ['GRAND TOTAL', null, null, null, Number(order.grandTotal) || 0],
    ['Payment status', null, null, null, invoice.status],
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 16 }, { wch: 22 }, { wch: 22 }];
  worksheet['!rows'] = [
    { hpt: 32 }, { hpt: 20 }, { hpt: 10 }, { hpt: 27 }, { hpt: 21 }, { hpt: 10 },
    { hpt: 21 }, { hpt: 23 }, { hpt: 23 }, { hpt: 23 }, { hpt: 10 }, { hpt: 22 }, { hpt: 36 },
    ...Array.from({ length: itemCount }, () => ({ hpt: 26 })), { hpt: 10 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 28 }, { hpt: 22 },
  ];
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } },
    { s: { r: 6, c: 2 }, e: { r: 6, c: 4 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
    { s: { r: 7, c: 2 }, e: { r: 7, c: 3 } },
    { s: { r: 8, c: 2 }, e: { r: 8, c: 3 } },
    { s: { r: 9, c: 2 }, e: { r: 9, c: 3 } },
    { s: { r: 11, c: 0 }, e: { r: 11, c: 4 } },
    ...Array.from({ length: 6 }, (_, index) => rows.length - 6 + index).map(r => (
      { s: { r, c: 0 }, e: { r, c: 3 } }
    )),
  ];

  const styleRange = (startRow, endRow, startCol, endCol, style) => {
    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        worksheet[address] ||= { t: 's', v: '' };
        worksheet[address].s = style;
      }
    }
  };
  const navyBand = { fill: { patternType: 'solid', fgColor: { rgb: navy } }, font: { name: 'Aptos', color: { rgb: white }, bold: true }, alignment: { vertical: 'center' } };
  const sectionBand = { fill: { patternType: 'solid', fgColor: { rgb: navy } }, font: { name: 'Aptos', color: { rgb: white }, bold: true, sz: 10 }, alignment: { vertical: 'center' } };
  const detailsLabel = { font: { name: 'Aptos', color: { rgb: muted }, bold: true, sz: 9 }, alignment: { vertical: 'center' } };
  const detailCell = { font: { name: 'Aptos', color: { rgb: ink }, sz: 10 }, alignment: { vertical: 'center', wrapText: true } };
  const tableHeading = { fill: { patternType: 'solid', fgColor: { rgb: navy } }, font: { name: 'Aptos', color: { rgb: white }, bold: true, sz: 9 }, alignment: { vertical: 'center', wrapText: true }, border: { bottom: { style: 'thin', color: { rgb: navy } } } };
  const itemCell = { font: { name: 'Aptos', color: { rgb: ink }, sz: 10 }, alignment: { vertical: 'center', wrapText: true }, border: { bottom: { style: 'thin', color: { rgb: border } } } };
  const totalLabel = { font: { name: 'Aptos', color: { rgb: muted }, bold: true, sz: 10 }, border: { bottom: { style: 'thin', color: { rgb: border } } } };
  const totalValue = { ...totalLabel, alignment: { horizontal: 'right' }, numFmt: '₱#,##0.00' };

  styleRange(0, 1, 0, 4, navyBand);
  worksheet.A1.s = { ...navyBand, font: { ...navyBand.font, sz: 19 } };
  worksheet.A2.s = { ...navyBand, font: { ...navyBand.font, sz: 9, bold: false } };
  styleRange(3, 3, 0, 4, { ...navyBand, font: { ...navyBand.font, sz: 15 } });
  styleRange(4, 4, 0, 4, { fill: { patternType: 'solid', fgColor: { rgb: pale } }, font: { name: 'Aptos', color: { rgb: muted }, sz: 10 }, alignment: { vertical: 'center' } });
  styleRange(6, 6, 0, 4, sectionBand);
  styleRange(7, 9, 0, 1, detailCell);
  styleRange(7, 9, 2, 3, detailsLabel);
  styleRange(7, 9, 4, 4, { ...detailCell, alignment: { horizontal: 'right', vertical: 'center' } });
  [7, 8, 9].forEach(row => {
    styleRange(row, row, 2, 3, { ...detailsLabel, fill: { patternType: 'solid', fgColor: { rgb: pale } } });
    styleRange(row, row, 4, 4, { ...detailCell, alignment: { horizontal: 'right', vertical: 'center' } });
  });
  styleRange(11, 11, 0, 4, sectionBand);
  const firstItemRow = 13;
  const lastItemRow = firstItemRow + itemCount - 1;
  styleRange(12, 12, 0, 4, tableHeading);
  if (itemCount) {
    styleRange(firstItemRow, lastItemRow, 0, 4, itemCell);
    Array.from({ length: itemCount }).forEach((_, index) => {
      const row = firstItemRow + index;
      if (index % 2 === 1) styleRange(row, row, 0, 4, { ...itemCell, fill: { patternType: 'solid', fgColor: { rgb: 'FFF8FAFC' } } });
      worksheet[XLSX.utils.encode_cell({ r: row, c: 2 })].z = '0.##';
      worksheet[XLSX.utils.encode_cell({ r: row, c: 3 })].s = { ...itemCell, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '₱#,##0.00' };
      worksheet[XLSX.utils.encode_cell({ r: row, c: 4 })].s = { ...itemCell, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '₱#,##0.00' };
    });
  }
  const firstTotalRow = rows.length - 6;
  styleRange(firstTotalRow, rows.length - 2, 0, 3, totalLabel);
  styleRange(firstTotalRow, rows.length - 2, 4, 4, totalValue);
  styleRange(rows.length - 2, rows.length - 2, 0, 3, {
    fill: { patternType: 'solid', fgColor: { rgb: navy } },
    font: { name: 'Aptos', color: { rgb: white }, bold: true, sz: 12 },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  styleRange(rows.length - 2, rows.length - 2, 4, 4, {
    fill: { patternType: 'solid', fgColor: { rgb: navy } },
    font: { name: 'Aptos', color: { rgb: white }, bold: true, sz: 12 },
    alignment: { horizontal: 'right', vertical: 'center' },
  });
  styleRange(rows.length - 1, rows.length - 1, 0, 3, detailsLabel);
  styleRange(rows.length - 1, rows.length - 1, 4, 4, { ...detailCell, alignment: { horizontal: 'right', vertical: 'center' } });
  worksheet['!autofilter'] = { ref: `A13:E${Math.max(13, lastItemRow + 1)}` };
  workbook.Props = { Title: `Invoice ${invoice.invoiceNumber}`, Subject: `Invoice for ${order.customer.name}`, Author: 'BevDist Distribution Co.' };
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice');
  return workbook;
}
