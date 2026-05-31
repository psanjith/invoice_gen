import jsPDF from 'jspdf';
import { Invoice } from './types';

const COMPANY_NAME = 'SELVA INSPECTION SERVICES LTD';
const PERSONAL_NAME = 'SELVAKUMAR RAMASAMY';
const COMPANY_ADDRESS = '715, 40Ave, NW\nEdmonton,AB.  T6T 0T3\nPhone: 780 531 0933';
const GST_NUMBER = '796025120RT0001';
const WCB_NUMBER = '8008345';

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    .format(d)
    .replace(/ /g, '-');
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function setGreen(pdf: jsPDF) {
  pdf.setFillColor(221, 232, 194);
}

function yellowBox(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  fontSize = 10,
  bold = true,
) {
  if (text) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(10, 10, 10);
    pdf.text(text, x + w / 2, y + h / 2 + fontSize * 0.35, { align: 'center' });
  }
}

function label(pdf: jsPDF, text: string, x: number, y: number) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(20, 20, 20);
  pdf.text(text, x, y);
}

function body(pdf: jsPDF, text: string, x: number, y: number, opts?: { maxWidth?: number }) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(20, 20, 20);
  pdf.text(text, x, y, opts);
}

function hline(pdf: jsPDF, x1: number, y: number, x2: number) {
  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(0.5);
  pdf.line(x1, y, x2, y);
}

function vline(pdf: jsPDF, x: number, y1: number, y2: number) {
  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(0.5);
  pdf.line(x, y1, x, y2);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function exportInvoiceToPdf(invoice: Invoice): Promise<void> {
  const sigImg = await loadImage('/signature.png').catch(() => null);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();

  const mx = 52;
  const my = 38;
  const W = PW - mx * 2;
  const H = PH - my * 2 - 10;
  const ix = mx + 1.5;
  const iy = my + 1.5;
  const iW = W - 3;

  // Outer border
  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(1.1);
  pdf.rect(mx, my, W, H);

  // ── HEADER ──────────────────────────────────────────────────────────────
  const hdrH = 32;
  setGreen(pdf);
  pdf.rect(ix, iy, iW, hdrH, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(15, 15, 15);
  pdf.text('INVOICE', ix + iW / 2, iy + 22, { align: 'center' });

  const leftW = iW * 0.44;
  const splitX = ix + leftW;
  const rightW = iW - leftW;

  // ── ROW 1: Company Name | Invoice Date ──────────────────────────────────
  let y = iy + hdrH;
  const r1H = 36;
  vline(pdf, splitX, y, y + r1H);
  hline(pdf, ix, y + r1H, ix + iW);

  label(pdf, 'Company Name', ix + 2, y + 11);
  body(pdf, COMPANY_NAME, ix + 2, y + 26);

  label(pdf, 'Invoice Date', splitX + 2, y + 11);
  const bw1 = rightW * 0.72;
  const bh1 = r1H - 20;
  yellowBox(pdf, ix + iW - bw1 - 4, y + 18, bw1, bh1, fmtDate(invoice.invoiceDate));

  // ── ROW 2: Personal Name | Invoice # ────────────────────────────────────
  y += r1H;
  const r2H = 38;
  vline(pdf, splitX, y, y + r2H);
  hline(pdf, ix, y + r2H, ix + iW);

  label(pdf, 'Personal Name', ix + 2, y + 11);
  body(pdf, PERSONAL_NAME, ix + 2, y + 26);

  label(pdf, 'Invoice #', splitX + 2, y + 11);
  const bw2 = rightW * 0.72;
  const bh2 = r2H - 20;
  yellowBox(pdf, ix + iW - bw2 - 4, y + 18, bw2, bh2, invoice.invoiceNumber);

  // ── ROW 3: Company Address | To: ────────────────────────────────────────
  y += r2H;
  const r3H = 70;
  vline(pdf, splitX, y, y + r3H);
  hline(pdf, ix, y + r3H, ix + iW);

  label(pdf, 'Company Address', ix + 2, y + 12);
  body(pdf, COMPANY_ADDRESS, ix + 2, y + 26);

  const toX = splitX + 7;
  const toY = y + 8;
  const toW = rightW - 14;
  label(pdf, 'To:', splitX + 2, y + 12);
  if (invoice.clientInfo) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(10, 10, 10);
    const lines = pdf.splitTextToSize(invoice.clientInfo, toW - 10) as string[];
    pdf.text(lines, toX + 5, toY + 13);
  }

  // ── ROW 4: GST# | WCB# ──────────────────────────────────────────────────
  y += r3H;
  const r4H = 24;
  const gstSplit = ix + iW * 0.46;
  vline(pdf, gstSplit, y, y + r4H);
  hline(pdf, ix, y + r4H, ix + iW);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(20, 20, 20);
  pdf.text(`GST#: ${GST_NUMBER}`, ix + 2, y + 16);
  pdf.text(`WCB#: ${WCB_NUMBER}`, gstSplit + 2, y + 16);

  // ── ROW 5: Phase Code ────────────────────────────────────────────────────
  y += r4H;
  const r5H = 22;
  hline(pdf, ix, y + r5H, ix + iW);

  label(pdf, 'Phase Code:', ix + 2, y + 15);
  yellowBox(pdf, ix + 68, y + 4, 170, 15, invoice.phaseCode, 9.5, false);

  // ── ROW 6: Project Name | Project # | Invoice Period ────────────────────
  y += r5H;
  const r6H = 75;
  const c1 = ix;
  const c2 = ix + iW * 0.34;
  const c3 = ix + iW * 0.53;
  const c4 = ix + iW;
  const midPeriod = c3 + (c4 - c3) / 2;

  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(0.5);
  pdf.rect(c1, y, iW, r6H);
  vline(pdf, c2, y, y + r6H);
  vline(pdf, c3, y, y + r6H);
  hline(pdf, c3, y + 34, c4);
  vline(pdf, midPeriod, y + 34, y + r6H);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(20, 20, 20);
  pdf.text('Project Name:', c1 + (c2 - c1) / 2, y + 16, { align: 'center' });
  pdf.text('Project #:', c2 + (c3 - c2) / 2, y + 16, { align: 'center' });
  pdf.text('Invoice Period', c3 + (c4 - c3) / 2, y + 16, { align: 'center' });
  pdf.text('From', c3 + (midPeriod - c3) / 2, y + 30, { align: 'center' });
  pdf.text('To', midPeriod + (c4 - midPeriod) / 2, y + 30, { align: 'center' });

  yellowBox(pdf, c1 + 16, y + 38, c2 - c1 - 32, 18, invoice.projectName, 9, false);
  yellowBox(pdf, c2 + 14, y + 38, c3 - c2 - 28, 18, invoice.projectNumber, 9, false);
  yellowBox(
    pdf,
    c3 + 10,
    y + 40,
    midPeriod - c3 - 20,
    18,
    invoice.periodFrom ? fmtDate(invoice.periodFrom) : '',
    9,
    false,
  );
  yellowBox(
    pdf,
    midPeriod + 10,
    y + 40,
    c4 - midPeriod - 20,
    18,
    invoice.periodTo ? fmtDate(invoice.periodTo) : '',
    9,
    false,
  );

  // ── TABLE ─────────────────────────────────────────────────────────────────
  y += r6H + 6;
  const tX = ix;
  const tW = iW;
  const thH = 18;
  const trH = 21;
  const entries = invoice.entries;

  const dateW = 82;
  const descW = 112;
  const hrsW = 48;
  const rateW = 60;
  const loaW = 62;
  const amtW = tW - dateW - descW - hrsW - rateW - loaW;

  // Header
  setGreen(pdf);
  pdf.rect(tX, y, tW, thH, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(20, 20, 20);
  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(0.5);

  const cx = {
    date: tX + dateW / 2,
    desc: tX + dateW + descW / 2,
    hrs: tX + dateW + descW + hrsW / 2,
    rate: tX + dateW + descW + hrsW + rateW / 2,
    loa: tX + dateW + descW + hrsW + rateW + loaW / 2,
    amt: tX + dateW + descW + hrsW + rateW + loaW + amtW / 2,
  };

  pdf.text('Date', cx.date, y + 12, { align: 'center' });
  pdf.text('Description', cx.desc, y + 12, { align: 'center' });
  pdf.text('Hrs', cx.hrs, y + 12, { align: 'center' });
  pdf.text('Rate', cx.rate, y + 12, { align: 'center' });
  pdf.text('LOA', cx.loa, y + 12, { align: 'center' });
  pdf.text('Amount', cx.amt, y + 12, { align: 'center' });

  const bodyTop = y + thH;
  const bodyH = entries.length * trH;

  // Row lines and column dividers
  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(0.5);
  for (let i = 0; i <= entries.length; i++) {
    hline(pdf, tX, bodyTop + i * trH, tX + tW);
  }
  vline(pdf, tX + dateW, bodyTop, bodyTop + bodyH);
  vline(pdf, tX + dateW + descW, bodyTop, bodyTop + bodyH);
  vline(pdf, tX + dateW + descW + hrsW, bodyTop, bodyTop + bodyH);
  vline(pdf, tX + dateW + descW + hrsW + rateW, bodyTop, bodyTop + bodyH);
  vline(pdf, tX + dateW + descW + hrsW + rateW + loaW, bodyTop, bodyTop + bodyH);

  // Row data
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(20, 20, 20);

  let subtotal = 0;
  entries.forEach((entry, i) => {
    const ry = bodyTop + i * trH + 14;
    const loa = entry.hours > 0 ? invoice.loaPerDay : 0;
    const amount = entry.amountOverride != null ? entry.amountOverride : entry.hours * invoice.hourlyRate + loa;
    subtotal += amount;

    pdf.text(fmtDate(entry.date), cx.date, ry, { align: 'center' });
    pdf.text(entry.description || 'Straight', tX + dateW + 6, ry, { maxWidth: descW - 10 });

    pdf.setTextColor(10, 10, 10);
    pdf.text(String(entry.hours), cx.hrs, ry, { align: 'center' });
    pdf.setTextColor(20, 20, 20);

    const displayRate = entry.hours > 0 ? invoice.hourlyRate : 0;
    pdf.text(`$${fmtMoney(displayRate)}`, cx.rate, ry, { align: 'center' });

    pdf.text(`$${fmtMoney(loa)}`, cx.loa, ry, { align: 'center' });

    if (amount > 0) {
      pdf.text(`$${fmtMoney(amount)}`, tX + tW - 6, ry, { align: 'right' });
    } else {
      pdf.text('-', tX + tW - 6, ry, { align: 'right' });
    }
  });

  // ── TOTALS ────────────────────────────────────────────────────────────────
  const gst = subtotal * invoice.gstRate;
  const total = subtotal + gst;

  const totStartX = tX + dateW + descW; // aligned with Hrs column start
  const totLabelW = hrsW + rateW + loaW; // spans Hrs+Rate+LOA
  const totAmtW = amtW;
  const totDivX = totStartX + totLabelW;
  const totEndX = tX + tW;
  const totY = bodyTop + bodyH;

  hline(pdf, totStartX, totY, totEndX);
  hline(pdf, totStartX, totY + 20, totEndX);
  hline(pdf, totStartX, totY + 40, totEndX);
  hline(pdf, totStartX, totY + 60, totEndX);
  vline(pdf, totStartX, totY, totY + 60);
  vline(pdf, totDivX, totY, totY + 60);
  vline(pdf, totEndX, totY, totY + 60);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(20, 20, 20);
  pdf.text('Sub Total', totDivX - 6, totY + 14, { align: 'right' });
  pdf.text('GST', totDivX - 6, totY + 34, { align: 'right' });
  pdf.text('Total', totDivX - 6, totY + 54, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.text(`$${fmtMoney(subtotal)}`, totEndX - 6, totY + 14, { align: 'right' });
  pdf.text(`$${fmtMoney(gst)}`, totEndX - 6, totY + 34, { align: 'right' });
  pdf.text(`$${fmtMoney(total)}`, totEndX - 6, totY + 54, { align: 'right' });

  // Unused totals column width lint suppression
  void totAmtW;

  // ── SIGNATURE ─────────────────────────────────────────────────────────────
  const sigY = totY + 62;
  hline(pdf, ix, sigY, ix + iW);

  const boxBottom = my + H - 4;
  const available = boxBottom - sigY;

  const labelY = boxBottom - 4;
  const ratio = sigImg ? sigImg.naturalWidth / sigImg.naturalHeight : 1;
  const sigH = Math.min(30, available - 18);
  const sigW = Math.min(70, sigH * ratio);

  if (sigImg) {
    pdf.addImage(sigImg, 'PNG', ix + 8, labelY - 12 - sigH, sigW, sigH);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(20, 20, 20);
  pdf.text("Contractor's signature", ix + 2, labelY);

  pdf.save(`${invoice.invoiceNumber}.pdf`);
}
