import { Invoice } from './types';

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    .format(d)
    .replace(/ /g, '-');
}

const YELLOW = 'FFFFFF00';
const GREY = 'FFD3D3D3';
const BORDER_COLOUR = 'FF999999';

function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: BORDER_COLOUR } },
    left: { style: 'thin' as const, color: { argb: BORDER_COLOUR } },
    bottom: { style: 'thin' as const, color: { argb: BORDER_COLOUR } },
    right: { style: 'thin' as const, color: { argb: BORDER_COLOUR } },
  };
}

function yellowFill() {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: YELLOW } };
}

function greyFill() {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: GREY } };
}

export async function exportSummarySpreadsheet(invoices: Invoice[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Invoice Summary');

  const year = new Date().getFullYear();
  const COLS = 8;

  // Column widths
  ws.columns = [
    { width: 20 }, // Invoice #
    { width: 13 }, // From
    { width: 13 }, // To
    { width: 8  }, // Hrs
    { width: 12 }, // LOA
    { width: 12 }, // GST
    { width: 14 }, // Total
    { width: 14 }, // Misc
  ];

  // ── Row 1: Year header ──────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, COLS);
  const yearCell = ws.getCell(1, 1);
  yearCell.value = String(year);
  yearCell.font = { bold: true, size: 13 };
  yearCell.alignment = { horizontal: 'center', vertical: 'middle' };
  yearCell.fill = yellowFill();
  yearCell.border = thinBorder();
  ws.getRow(1).height = 22;

  // ── Row 2: Column headers ───────────────────────────────────────────
  const headers = ['Invoice #', 'From', 'To', 'Hrs', 'LOA', 'GST', 'Total', 'Misc'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 18;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.fill = yellowFill();
    cell.border = thinBorder();
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ── Invoice rows ────────────────────────────────────────────────────
  const sorted = [...invoices].sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));

  let totHrs = 0, totLoa = 0, totGst = 0, totTotal = 0;

  for (const inv of sorted) {
    const hrs = inv.entries.reduce((s, e) => s + e.hours, 0);
    const loaTotal = inv.entries.filter((e) => e.hours > 0).length * inv.loaPerDay;
    const subtotal = inv.entries.reduce((s, e) => {
      const loa = e.hours > 0 ? inv.loaPerDay : 0;
      return s + e.hours * inv.hourlyRate + loa;
    }, 0);
    const gst = subtotal * inv.gstRate;
    const total = subtotal + gst;

    totHrs += hrs;
    totLoa += loaTotal;
    totGst += gst;
    totTotal += total;

    const row = ws.addRow([
      inv.invoiceNumber,
      fmtDate(inv.periodFrom),
      fmtDate(inv.periodTo),
      hrs,
      loaTotal || '',
      Number(gst.toFixed(2)),
      Number(total.toFixed(2)),
      '',
    ]);

    row.height = 17;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle' };
    });

    // Right-align numbers
    [4, 5, 6, 7].forEach((col) => {
      row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(col).numFmt = '#,##0.00';
    });
    row.getCell(4).numFmt = '0'; // hrs is integer
  }

  // ── Total row ────────────────────────────────────────────────────────
  const totalRow = ws.addRow([
    '', '', 'Total',
    totHrs,
    totLoa || '',
    Number(totGst.toFixed(2)),
    Number(totTotal.toFixed(2)),
    '',
  ]);

  totalRow.height = 18;
  totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.border = thinBorder();
    if (col >= 4) {
      cell.fill = greyFill();
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (col !== 4) cell.numFmt = '#,##0.00';
      else cell.numFmt = '0';
    }
  });

  // ── Download ─────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-summary-${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
