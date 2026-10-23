import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from '@redoper1/xlsx-js-style';
import { invoiceHtml, invoiceWorkbook } from './invoiceDocuments';
import { invoiceSummary } from '../dashboard/salesSummary';

const safeInvoiceName = order => String(order.invoiceNumber || order.orderNumber || 'invoice').replace(/[^a-z0-9_-]/gi, '-');

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
