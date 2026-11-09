import * as XLSX from '@redoper1/xlsx-js-style';
import { refundAmount, caseLineAmount } from './containerReturns.js';
import { casePackDisplay } from './casePacks.js';
import { formatCaseQuantity } from './caseQuantity.js';

const peso = amount => Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = amount => formatCaseQuantity(amount);

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
    return `<tr>
      <td>${escapeHtml(item.productName)}<span class="subline">${escapeHtml(item.unitsPerCase ? casePackDisplay({ id: item.packId, label: item.packLabel, unitsPerCase: item.unitsPerCase }) : item.packLabel || 'Case')}</span></td>
      <td class="number">${quantity(item.quantity)}</td>
      <td class="number">₱${peso(lineTotal)}</td>
    </tr>`;
  }).join('');
  const returnRows = (order.containerReturns || []).map(entry => {
    const deposit = entry.kind === 'deposit';
    return `<tr>
      <td>${escapeHtml(entry.type)}<span class="subline">${deposit ? 'Deposit' : 'Return'} · ₱${peso(entry.amountPerCase ?? entry.refundPerCase)} per case</span></td>
      <td class="number">${quantity(entry.quantity)}</td>
      <td class="number">${deposit ? '+' : '−'}₱${peso(refundAmount(entry))}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: A4; margin: 14mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color:#111; font-size:12pt; }
    .business { width:100%; margin:0 auto 28px; line-height:1.42; text-align:center; }
    .business strong { display:block; font-size:14pt; }
    .meta { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin:0 0 30px; }
    .meta-block { display:flex; align-items:flex-end; gap:6px; }
    .meta-line { display:inline-block; min-width:205px; min-height:21px; border-bottom:1px solid #222; }
    .date-line { min-width:210px; }
    .customer { width:58%; margin:0 auto 18px; line-height:1.65; }
    .customer-line { display:flex; gap:6px; align-items:flex-end; }
    .customer-line span:first-child { white-space:nowrap; }
    .fill-line { flex:1; min-height:19px; border-bottom:1px solid #222; }
    .table-heading, table { width:100%; }
    table { border-collapse:collapse; margin-top:0; table-layout:fixed; }
    th { text-align:left; padding:6px 8px 8px; font-weight:normal; border-bottom:1px solid #333; }
    td { padding:9px 8px; border-bottom:1px solid #d1d1d1; vertical-align:top; }
    tr { break-inside:avoid; }
    th:nth-child(1), td:nth-child(1) { width:48%; }
    th:nth-child(2), td:nth-child(2) { width:18%; text-align:center; }
    th:nth-child(3), td:nth-child(3) { width:34%; text-align:right; }
    .subline { display:block; margin-top:2px; color:#444; font-size:9pt; }
    .adjustment-note { margin:12px 0 0; text-align:right; font-size:9pt; line-height:1.5; }
    .grand { width:55%; margin:54px 0 0 auto; display:flex; align-items:flex-end; justify-content:space-between; gap:18px; font-weight:bold; }
    .grand strong { min-width:47%; padding-bottom:3px; border-bottom:1px solid #222; text-align:right; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style></head><body>
    <div class="business"><strong>Mila's Store</strong>737 San Diego St<br>Sampaloc, Manila, 1008<br>CP 09569569553, TEL: 856-70568</div>
    <div class="meta">
      <div class="meta-block"><span>INV:</span><span class="meta-line">${escapeHtml(invoice.invoiceNumber)}</span></div>
      <div class="meta-block"><span>Date:</span><span class="meta-line date-line">${escapeHtml(order.date)}</span></div>
    </div>
    <div class="customer">
      <div class="customer-line"><span>Customer Name:</span><span class="fill-line">${escapeHtml(order.customer.name)}</span></div>
      <div class="customer-line"><span>Tel No:</span><span class="fill-line">${escapeHtml(order.customer.contact || '')}</span></div>
      <div class="customer-line"><span>Address:</span><span class="fill-line">${escapeHtml(order.customer.address || '')}</span></div>
    </div>
    <table><thead><tr><th>Product</th><th>QTY</th><th>PRICE</th></tr></thead><tbody>${itemRows}${returnRows}</tbody></table>
    ${(order.containerReturns || []).length ? `<div class="adjustment-note">+ Deposit &nbsp;&nbsp; − Return</div>` : ''}
    <div class="grand"><span>GRAND TOTAL</span><strong>₱${peso(order.grandTotal)}</strong></div>
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
    ['Product', 'Unit', 'Quantity (cases)', 'Price / amount per case', 'Amount'],
    ...order.items.map(item => {
      const price = Number(item.casePrice ?? item.unitPrice) || 0;
      return [
        item.productName,
        item.unitsPerCase ? casePackDisplay({ id: item.packId, label: item.packLabel, unitsPerCase: item.unitsPerCase }) : item.packLabel || 'Historical invoice line',
        quantity(item.quantity),
        price,
        caseLineAmount(item.quantity || 0, price),
      ];
    }),
    ...returnEntries.map(entry => [
      `${entry.kind === 'deposit' ? 'Deposit' : 'Returned'}: ${entry.type}`,
      entry.kind === 'deposit' ? 'Container deposit' : 'Container return',
      quantity(entry.quantity), Number(entry.amountPerCase ?? entry.refundPerCase),
      (entry.kind === 'deposit' ? 1 : -1) * refundAmount(entry),
    ]),
    [],
    ['Subtotal', null, null, null, Number(order.subtotal ?? order.grandTotal) || 0],
    ['Container deposits', null, null, null, Number(order.containerDepositTotal) || 0],
    ['Container returns', null, null, null, -(Number(order.containerRefundTotal) || 0)],
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
