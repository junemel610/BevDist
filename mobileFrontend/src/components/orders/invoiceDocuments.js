import * as XLSX from '@redoper1/xlsx-js-style';
import { refundAmount, caseLineAmount } from './containerReturns.js';
import { casePackDisplay } from './casePacks.js';
import { formatCaseQuantity } from './caseQuantity.js';
import { INVOICE_BUSINESS, formatInvoiceDate } from './invoiceIdentity.js';

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
  const productSubtotal = Number(order.subtotal ?? order.items.reduce((sum, item) => sum + caseLineAmount(item.quantity, Number(item.casePrice ?? item.unitPrice) || 0), 0));
  const depositTotal = Number(order.containerDepositTotal ?? (order.containerReturns || []).filter(entry => entry.kind === 'deposit').reduce((sum, entry) => sum + refundAmount(entry), 0));
  const returnTotal = Number(order.containerRefundTotal ?? (order.containerReturns || []).filter(entry => entry.kind !== 'deposit').reduce((sum, entry) => sum + refundAmount(entry), 0));
  const itemRows = order.items.map(item => {
    const price = Number(item.casePrice ?? item.unitPrice) || 0;
    const lineTotal = caseLineAmount(item.quantity, price);
    return `<tr>
      <td>${escapeHtml(item.productName)}<span class="subline">${escapeHtml(item.unitsPerCase ? casePackDisplay({ id: item.packId, label: item.packLabel, unitsPerCase: item.unitsPerCase }) : item.packLabel || 'Case')} · ₱${peso(price)} per case</span></td>
      <td class="number">${quantity(item.quantity)}</td>
      <td class="number">₱${peso(lineTotal)}</td>
    </tr>`;
  }).join('');
  const adjustmentRows = (order.containerReturns || []).map(entry => {
    const deposit = entry.kind === 'deposit';
    return `<tr>
      <td>${deposit ? 'Deposit' : 'Return'}: ${escapeHtml(entry.type)}<span class="subline">₱${peso(entry.amountPerCase ?? entry.refundPerCase)} per case</span></td>
      <td class="number">${quantity(entry.quantity)}</td>
      <td class="number">${deposit ? '+' : '−'}₱${peso(refundAmount(entry))}</td>
    </tr>`;
  }).join('');
  const adjustmentsHeading = adjustmentRows ? '<tr class="section-row"><td colspan="3">Deposit / Return</td></tr>' : '';

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: A4; margin: 14mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color:#111; font-size:12pt; }
    .business { width:100%; margin:0 auto 28px; line-height:1.42; text-align:center; color:#111; }
    .business strong { display:block; font-size:14pt; }
    .meta { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin:0 0 30px; }
    .meta-block { display:flex; align-items:flex-end; gap:6px; }
    .meta-line { display:inline-block; min-width:205px; min-height:21px; border-bottom:1px solid #222; }
    .date-line { min-width:210px; }
    .customer { width:66%; margin:0 auto 24px; line-height:1.65; }
    .customer-line { display:flex; gap:6px; align-items:flex-end; }
    .customer-line span:first-child { white-space:nowrap; }
    .fill-line { flex:1; min-height:19px; border-bottom:1px solid #222; }
    .table-heading, table { width:100%; }
    table { border-collapse:collapse; margin-top:0; table-layout:fixed; }
    th { text-align:left; padding:7px 8px 9px; font-weight:bold; border-bottom:1px solid #222; }
    td { padding:9px 8px; border-bottom:1px solid #bbb; vertical-align:top; }
    tr { break-inside:avoid; }
    th:nth-child(1), td:nth-child(1) { width:48%; }
    th:nth-child(2), td:nth-child(2) { width:18%; text-align:center; }
    th:nth-child(3), td:nth-child(3) { width:34%; text-align:right; }
    .subline { display:block; margin-top:2px; color:#333; font-size:9pt; }
    .section-row td { padding-top:15px; border-bottom:1px solid #222; font-weight:bold; }
    .totals { width:62%; margin:28px 0 0 auto; line-height:1.55; }
    .total-row { display:flex; justify-content:space-between; gap:18px; padding:3px 8px; }
    .grand { margin-top:7px; border-top:1px solid #222; border-bottom:1px solid #222; padding:8px; font-weight:bold; font-size:12pt; }
    .balance { border-top:1px solid #aaa; margin-top:8px; padding-top:8px; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style></head><body>
    <div class="business"><strong>${escapeHtml(INVOICE_BUSINESS.name)}</strong>${escapeHtml(INVOICE_BUSINESS.street)}<br>${escapeHtml(INVOICE_BUSINESS.city)}<br>${escapeHtml(INVOICE_BUSINESS.contact)}</div>
    <div class="meta">
      <div class="meta-block"><span>INV:</span><span class="meta-line">${escapeHtml(invoice.invoiceNumber)}</span></div>
      <div class="meta-block"><span>Date:</span><span class="meta-line date-line">${escapeHtml(formatInvoiceDate(order.date))}</span></div>
    </div>
    <div class="customer">
      <div class="customer-line"><span>Customer Name:</span><span class="fill-line">${escapeHtml(order.customer.name)}</span></div>
      <div class="customer-line"><span>Tel No:</span><span class="fill-line">${escapeHtml(order.customer.contact || '')}</span></div>
      <div class="customer-line"><span>Address:</span><span class="fill-line">${escapeHtml(order.customer.address || '')}</span></div>
    </div>
    <table><thead><tr><th>Product</th><th>QTY</th><th>PRICE</th></tr></thead><tbody>${itemRows}${adjustmentsHeading}${adjustmentRows}</tbody></table>
    <div class="totals">
      <div class="total-row"><span>Product subtotal</span><span>₱${peso(productSubtotal)}</span></div>
      <div class="total-row"><span>Deposits added</span><span>+₱${peso(depositTotal)}</span></div>
      <div class="total-row"><span>Returns deducted</span><span>−₱${peso(returnTotal)}</span></div>
      <div class="total-row grand"><span>GRAND TOTAL</span><span>₱${peso(order.grandTotal)}</span></div>
      <div class="balance">
        <div class="total-row"><span>Payments and credit applied</span><span>−₱${peso(invoice.amountPaid)}</span></div>
        <div class="total-row"><span>Remaining balance</span><span>₱${peso(invoice.remainingBalance)}</span></div>
      </div>
    </div>
  </body></html>`;
}

export function invoiceWorkbook(order, invoice) {
  const ink = 'FF111111';
  const border = 'FF999999';
  const returnEntries = order.containerReturns || [];
  const productSubtotal = Number(order.subtotal ?? order.items.reduce((sum, item) => sum + caseLineAmount(item.quantity, Number(item.casePrice ?? item.unitPrice) || 0), 0));
  const depositTotal = Number(order.containerDepositTotal ?? returnEntries.filter(entry => entry.kind === 'deposit').reduce((sum, entry) => sum + refundAmount(entry), 0));
  const returnTotal = Number(order.containerRefundTotal ?? returnEntries.filter(entry => entry.kind !== 'deposit').reduce((sum, entry) => sum + refundAmount(entry), 0));
  const rows = [
    [INVOICE_BUSINESS.name],
    [INVOICE_BUSINESS.street],
    [INVOICE_BUSINESS.city],
    [INVOICE_BUSINESS.contact],
    [],
    ['INV:', invoice.invoiceNumber, 'Date:', formatInvoiceDate(order.date)],
    [],
    ['Customer details'],
    ['Customer Name:', order.customer.name],
    ['Tel No:', order.customer.contact || ''],
    ['Address:', order.customer.address || ''],
    [],
    ['Product', null, 'QTY', 'PRICE'],
    ...order.items.map(item => {
      const price = Number(item.casePrice ?? item.unitPrice) || 0;
      return [
        `${item.productName}\n${item.unitsPerCase ? casePackDisplay({ id: item.packId, label: item.packLabel, unitsPerCase: item.unitsPerCase }) : item.packLabel || 'Case'} · ₱${peso(price)} per case`,
        null,
        quantity(item.quantity),
        caseLineAmount(item.quantity || 0, price),
      ];
    }),
  ];
  const itemStart = 13;
  const itemEnd = itemStart + order.items.length - 1;
  let adjustmentHeadingRow = null;
  let adjustmentStart = null;
  if (returnEntries.length) {
    adjustmentHeadingRow = rows.length;
    rows.push(['Deposit / Return']);
    adjustmentStart = rows.length;
    rows.push(...returnEntries.map(entry => [
      `${entry.kind === 'deposit' ? 'Deposit' : 'Return'}: ${entry.type}\n₱${peso(entry.amountPerCase ?? entry.refundPerCase)} per case`,
      null,
      quantity(entry.quantity),
      (entry.kind === 'deposit' ? 1 : -1) * refundAmount(entry),
    ]));
  }
  rows.push([]);
  const summaryStart = rows.length;
  rows.push(
    ['Product subtotal', null, null, productSubtotal],
    ['Deposits added', null, null, depositTotal],
    ['Returns deducted', null, null, -returnTotal],
    ['GRAND TOTAL', null, null, Number(order.grandTotal) || 0],
    ['Payments and credit applied', null, null, -Number(invoice.amountPaid || 0)],
    ['Remaining balance', null, null, Number(invoice.remainingBalance || 0)],
    ['Payment status', null, null, invoice.status],
  );
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 20 }];
  worksheet['!rows'] = rows.map((_, row) => ({ hpt: row === 0 ? 28 : row === 1 || row === 2 || row === 3 ? 20 : row === 12 ? 24 : (row >= itemStart && row <= itemEnd) || (adjustmentStart !== null && row >= adjustmentStart && row < adjustmentStart + returnEntries.length) ? 36 : 21 }));
  worksheet['!merges'] = [
    ...[0, 1, 2, 3, 7].map(row => ({ s: { r: row, c: 0 }, e: { r: row, c: 3 } })),
    { s: { r: 8, c: 1 }, e: { r: 8, c: 3 } },
    { s: { r: 9, c: 1 }, e: { r: 9, c: 3 } },
    { s: { r: 10, c: 1 }, e: { r: 10, c: 3 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: 1 } },
    ...Array.from({ length: order.items.length }, (_, index) => ({ s: { r: itemStart + index, c: 0 }, e: { r: itemStart + index, c: 1 } })),
    ...(adjustmentHeadingRow === null ? [] : [{ s: { r: adjustmentHeadingRow, c: 0 }, e: { r: adjustmentHeadingRow, c: 3 } }]),
    ...Array.from({ length: 7 }, (_, index) => ({ s: { r: summaryStart + index, c: 0 }, e: { r: summaryStart + index, c: 2 } })),
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
  const bodyStyle = { font: { name: 'Arial', color: { rgb: ink }, sz: 10 }, alignment: { vertical: 'center', wrapText: true } };
  const lineStyle = { ...bodyStyle, border: { bottom: { style: 'thin', color: { rgb: border } } } };
  styleRange(0, 0, 0, 3, { ...bodyStyle, font: { ...bodyStyle.font, bold: true, sz: 16 }, alignment: { horizontal: 'center', vertical: 'center' } });
  styleRange(1, 3, 0, 3, { ...bodyStyle, alignment: { horizontal: 'center', vertical: 'center' } });
  styleRange(5, 5, 0, 3, { ...bodyStyle, font: { ...bodyStyle.font, bold: true } });
  styleRange(7, 7, 0, 3, { ...bodyStyle, font: { ...bodyStyle.font, bold: true }, border: { bottom: { style: 'thin', color: { rgb: ink } } } });
  styleRange(8, 10, 0, 0, { ...bodyStyle, font: { ...bodyStyle.font, bold: true } });
  styleRange(8, 10, 1, 3, bodyStyle);
  styleRange(12, 12, 0, 3, { ...bodyStyle, font: { ...bodyStyle.font, bold: true }, border: { bottom: { style: 'medium', color: { rgb: ink } } } });
  if (order.items.length) {
    styleRange(itemStart, itemEnd, 0, 1, lineStyle);
    styleRange(itemStart, itemEnd, 2, 2, { ...lineStyle, alignment: { horizontal: 'center', vertical: 'center' } });
    styleRange(itemStart, itemEnd, 3, 3, { ...lineStyle, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '₱#,##0.00' });
  }
  if (adjustmentHeadingRow !== null) {
    styleRange(adjustmentHeadingRow, adjustmentHeadingRow, 0, 3, { ...bodyStyle, font: { ...bodyStyle.font, bold: true }, border: { bottom: { style: 'thin', color: { rgb: ink } } } });
    styleRange(adjustmentStart, adjustmentStart + returnEntries.length - 1, 0, 1, lineStyle);
    styleRange(adjustmentStart, adjustmentStart + returnEntries.length - 1, 2, 2, { ...lineStyle, alignment: { horizontal: 'center', vertical: 'center' } });
    styleRange(adjustmentStart, adjustmentStart + returnEntries.length - 1, 3, 3, { ...lineStyle, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '₱#,##0.00;[Red](₱#,##0.00)' });
  }
  styleRange(summaryStart, summaryStart + 5, 0, 2, { ...bodyStyle, font: { ...bodyStyle.font, bold: true } });
  styleRange(summaryStart, summaryStart + 5, 3, 3, { ...bodyStyle, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '₱#,##0.00;[Red](₱#,##0.00)' });
  styleRange(summaryStart + 3, summaryStart + 3, 0, 3, { ...bodyStyle, font: { ...bodyStyle.font, bold: true, sz: 12 }, border: { top: { style: 'thin', color: { rgb: ink } }, bottom: { style: 'double', color: { rgb: ink } } } });
  styleRange(summaryStart + 6, summaryStart + 6, 0, 2, { ...bodyStyle, font: { ...bodyStyle.font, bold: true } });
  styleRange(summaryStart + 6, summaryStart + 6, 3, 3, bodyStyle);
  workbook.Props = { Title: `Invoice ${invoice.invoiceNumber}`, Subject: `Invoice for ${order.customer.name}`, Author: "Mila's Store" };
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice');
  return workbook;
}
