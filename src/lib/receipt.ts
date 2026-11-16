import { PDFDocument, popGraphicsState, pushGraphicsState, rgb, setCharacterSpacing, type PDFFont, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Trip } from './types';
import { tripDue, tripReceived, tripStatus } from './calc';
import { daysBetween, num, parseISO, todayISO } from './format';
import { formatPlate } from './vehicle';

/**
 * A customer receipt for one trip: a clean A4 PDF in the style of a ride receipt, in the
 * Covenant Travels colours (navy and gold, taken from the logo).
 *
 * It carries what the customer needs: who paid, the vehicle and dates, the route with starting and
 * ending km, the agreed amount, each payment received, the balance, and the amount in words.
 * Trip expenses and notes are internal and never appear on it.
 */

export interface ReceiptAssets {
  logo: Uint8Array; // PNG
  regular: Uint8Array; // Poppins latin 400
  medium: Uint8Array; // Poppins latin 500
  semibold: Uint8Array; // Poppins latin 600
  rupee: Uint8Array; // Poppins devanagari 600 (only used for ₹)
}

export interface ReceiptBusiness {
  address: string;
  phone: string;
  email: string;
  gstin: string;
}

export const COMPANY = 'Covenant Travels';

const NAVY = rgb(0 / 255, 32 / 255, 80 / 255);
const GOLD = rgb(168 / 255, 118 / 255, 12 / 255); // readable as text on white
const GOLD_LINE = rgb(201 / 255, 151 / 255, 28 / 255);
const INK = rgb(30 / 255, 32 / 255, 38 / 255);
const MUTED = rgb(96 / 255, 100 / 255, 110 / 255);
const RULE = rgb(214 / 255, 217 / 255, 224 / 255);
const WHITE = rgb(1, 1, 1);

const W = 595.28; // A4 portrait, points
const H = 841.89;
const M = 56; // side margin
const CW = W - 2 * M; // content width

// ---------------------------------------------------------------- pure helpers (tested)

/** Stable receipt number from the trip: CT-YYMMDD-XXXX. */
export function receiptNumber(trip: Pick<Trip, 'id' | 'date'>): string {
  const d = trip.date.replace(/-/g, '').slice(2);
  const tail = trip.id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();
  return `CT-${d}-${tail}`;
}

export const receiptFileName = (trip: Pick<Trip, 'id' | 'date'>) => `Receipt-${receiptNumber(trip)}.pdf`;

const longDate = (iso: string) => parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** "2 Nov 2026", "2 – 6 Nov 2026 · 5 days", "From 2 Nov 2026". */
export function tripDates(t: Pick<Trip, 'date' | 'endDate'>): string {
  if (t.endDate === null) return `From ${longDate(t.date)}`;
  if (t.endDate === t.date) return longDate(t.date);
  const a = parseISO(t.date);
  const b = parseISO(t.endDate);
  const n = daysBetween(t.date, t.endDate) + 1;
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const start = sameMonth
    ? String(a.getDate())
    : a.getFullYear() === b.getFullYear()
      ? a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : longDate(t.date);
  return `${start} – ${longDate(t.endDate)} · ${n} days`;
}

/** What the receipt says about payment, worked out from the trip. */
export function paymentSummary(t: Pick<Trip, 'fare' | 'payments'>) {
  const received = tripReceived(t);
  const due = tripDue(t);
  return { received, due, paidInFull: t.fare > 0 && due === 0 };
}

const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "₹23,880.00" */
export const money2 = (n: number) => inr2.format(Math.round((n || 0) * 100) / 100);

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}
function below1000(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? below100(r) : ''].filter(Boolean).join(' ');
}
function wholeWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  return [
    crore ? `${wholeWords(crore)} Crore` : '',
    lakh ? `${below100(lakh)} Lakh` : '',
    thousand ? `${below100(thousand)} Thousand` : '',
    rest ? below1000(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Indian style: 23880 → "Rupees Twenty Three Thousand Eight Hundred Eighty Only"; 150000 → "… One Lakh Fifty Thousand …". */
export function rupeesInWords(amount: number): string {
  const paise = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${wholeWords(rupees)}${p ? ` and ${below100(p)} Paise` : ''} Only`;
}

// ---------------------------------------------------------------- the PDF

export async function buildReceipt(
  trip: Trip,
  assets: ReceiptAssets,
  business: ReceiptBusiness = { address: '', phone: '', email: '', gstin: '' },
  issued = todayISO(),
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, medium, semibold, rupee] = await Promise.all([
    doc.embedFont(assets.regular, { subset: true }),
    doc.embedFont(assets.medium, { subset: true }),
    doc.embedFont(assets.semibold, { subset: true }),
    doc.embedFont(assets.rupee, { subset: true }),
  ]);
  const logo = await doc.embedPng(assets.logo);

  const no = receiptNumber(trip);
  const pay = paymentSummary(trip);
  const status = tripStatus(trip, issued);
  const isBooking = pay.received === 0;

  doc.setTitle(`${isBooking ? 'Booking' : 'Receipt'} ${no}`);
  doc.setSubject(`${trip.from} to ${trip.to}`);
  doc.setAuthor(COMPANY);
  doc.setCreator(COMPANY);
  doc.setProducer(COMPANY);

  const page = doc.addPage([W, H]);
  const top = (y: number) => H - y; // lay out top-down
  const xr = W - M;

  // -------------------------------------------------------------- drawing helpers
  const runs = (s: string) => s.split(/(₹)/).filter(Boolean);
  const width = (s: string, size: number, font: PDFFont, spacing = 0) =>
    runs(s).reduce((w, part) => w + (part === '₹' ? rupee : font).widthOfTextAtSize(part, size) + spacing * [...part].length, 0);
  /** Text with ₹ in the rupee font; letter-spacing via the PDF's own character spacing. Returns width. */
  const text = (s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = INK, spacing = 0) => {
    let cx = x;
    for (const part of runs(s)) {
      const f = part === '₹' ? rupee : font;
      if (spacing) page.pushOperators(pushGraphicsState(), setCharacterSpacing(spacing));
      page.drawText(part, { x: cx, y: top(y), size, font: f, color });
      if (spacing) page.pushOperators(popGraphicsState());
      cx += f.widthOfTextAtSize(part, size) + spacing * [...part].length;
    }
    return cx - x;
  };
  const right = (s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = INK, spacing = 0) =>
    text(s, x - width(s, size, font, spacing) + spacing, y, size, font, color, spacing);
  const center = (s: string, cx: number, y: number, size: number, font: PDFFont, color: RGB = INK) =>
    text(s, cx - width(s, size, font) / 2, y, size, font, color);
  /** Word-wrap to a width; very long words are broken. */
  const wrap = (s: string, maxW: number, size: number, font: PDFFont): string[] => {
    const lines: string[] = [];
    let line = '';
    for (const word of s.split(/\s+/).filter(Boolean)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (width(tryLine, size, font) <= maxW) {
        line = tryLine;
        continue;
      }
      if (line) lines.push(line);
      let w = word;
      while (width(w, size, font) > maxW) {
        let cut = w.length - 1;
        while (cut > 1 && width(w.slice(0, cut), size, font) > maxW) cut--;
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const hline = (x1: number, x2: number, y: number, color: RGB = RULE, thickness = 0.75) =>
    page.drawLine({ start: { x: x1, y: top(y) }, end: { x: x2, y: top(y) }, thickness, color });
  const rect = (x: number, y: number, w: number, h: number, opts: { color?: RGB; borderColor?: RGB; borderWidth?: number }) =>
    page.drawRectangle({ x, y: top(y + h), width: w, height: h, ...opts });
  const pill = (s: string, xRight: number, y: number, color: RGB, filled: boolean) => {
    const size = 7.5;
    const w = width(s, size, semibold, 1.1) + 20;
    page.drawSvgPath(
      `M 9 0 H ${w - 9} A 9 9 0 0 1 ${w - 9} 18 H 9 A 9 9 0 0 1 9 0 Z`,
      filled ? { x: xRight - w, y: top(y), color } : { x: xRight - w, y: top(y), borderColor: color, borderWidth: 1 },
    );
    text(s, xRight - w + 10, y + 12.3, size, semibold, filled ? WHITE : color, 1.1);
  };
  const section = (title: string, y: number) => {
    text(title, M, y, 12.5, semibold, INK);
    return y + 22;
  };
  /** One label/amount line. Returns the next y. */
  const line = (label: string, value: string, y: number, opts: { sub?: string; strong?: boolean; color?: RGB } = {}) => {
    const size = opts.strong ? 11 : 10;
    text(label, M, y, size, opts.strong ? semibold : regular, opts.color ?? INK);
    right(value, xr, y, size, opts.strong ? semibold : regular, opts.color ?? INK);
    if (opts.sub) text(opts.sub, M, y + 13, 8.5, regular, MUTED);
    return y + (opts.sub ? 32 : 24);
  };

  // -------------------------------------------------------------- brand band
  rect(0, 0, W, 6, { color: NAVY });
  rect(0, 6, W, 1.4, { color: GOLD_LINE });

  // -------------------------------------------------------------- header: logo left, receipt number right
  const headTop = 34;
  const logoW = 84;
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: M - 6, y: top(headTop + logoH), width: logoW, height: logoH });
  right(isBooking ? 'Booking confirmation' : 'Receipt', xr, headTop + 16, 9, semibold, MUTED, 0.4);
  right(no, xr, headTop + 32, 11, semibold, INK);
  right(`Issued ${longDate(issued)}`, xr, headTop + 47, 9, regular, MUTED);

  // -------------------------------------------------------------- greeting
  let y = headTop + logoH + 34;
  const first = trip.customerName.trim().split(/\s+/)[0] ?? '';
  const booked = isBooking || status === 'upcoming';
  const greeting = `Thanks for ${booked ? 'booking' : 'travelling'} with us${first ? `, ${first}` : ''}`;
  for (const l of wrap(greeting, CW, 22, semibold)) {
    text(l, M, y, 22, semibold, NAVY);
    y += 28;
  }
  const when = trip.endDate === null ? `starting ${longDate(trip.date)}` : `on ${tripDates(trip).replace(/ · .*$/, '')}`;
  const lead = isBooking
    ? `Here is your booking confirmation for the trip ${when}.`
    : status === 'upcoming'
      ? `Here is your receipt for the advance on your trip ${when}.`
      : `Here is your receipt for the trip ${when}.`;
  text(lead, M, y - 6, 10.5, regular, MUTED);
  y += 26;

  // -------------------------------------------------------------- total
  hline(M, xr, y, INK, 1.4);
  y += 38;
  text('Total', M, y, 17, semibold, INK);
  right(money2(trip.fare), xr, y + 2, 26, semibold, INK);
  y += 22;
  text(rupeesInWords(trip.fare), M, y, 8.5, regular, MUTED);
  if (pay.paidInFull) pill('PAID IN FULL', xr, y - 11, GOLD, false);
  else if (pay.due > 0) pill(`BALANCE DUE  ${money2(pay.due)}`, xr, y - 11, NAVY, true);
  y += 22;
  hline(M, xr, y, INK, 1.4);

  // -------------------------------------------------------------- trip: pickup → drop timeline, details on the right
  y = section('Trip details', y + 34);
  const routeW = 280;
  const dx = M + 5;
  const nameX = M + 22;
  const startLines = wrap(trip.from.trim() || '—', routeW - 22, 11, semibold).slice(0, 2);
  const endLines = wrap(trip.to.trim() || '—', routeW - 22, 11, semibold).slice(0, 2);
  const startDate = longDate(trip.date);
  const endDate = trip.endDate ? longDate(trip.endDate) : 'End date to be confirmed';
  const startSub = [startDate, trip.startKm != null ? `Starting km ${num(trip.startKm)}` : ''].filter(Boolean).join('   ·   ');
  const endSub = [endDate, trip.endKm != null ? `Ending km ${num(trip.endKm)}` : ''].filter(Boolean).join('   ·   ');

  const sY = y + 4;
  startLines.forEach((l, i) => text(l, nameX, sY + i * 14, 11, semibold, INK));
  text(startSub, nameX, sY + startLines.length * 14 + 1, 8.8, regular, MUTED);
  const eY = sY + startLines.length * 14 + 34;
  endLines.forEach((l, i) => text(l, nameX, eY + i * 14, 11, semibold, INK));
  text(endSub, nameX, eY + endLines.length * 14 + 1, 8.8, regular, MUTED);
  // Pickup dot, drop square, joined by a line — read at a glance, like a ride receipt.
  const dotY = sY - 4;
  const sqY = eY - 4;
  page.drawLine({ start: { x: dx, y: top(dotY + 6) }, end: { x: dx, y: top(sqY - 6) }, thickness: 1.2, color: RULE });
  page.drawCircle({ x: dx, y: top(dotY), size: 4.2, color: GOLD_LINE });
  rect(dx - 4, sqY - 4, 8, 8, { color: NAVY });

  const facts: [string, string][] = [
    ['Vehicle', trip.vehicle.trim() ? formatPlate(trip.vehicle) : '—'],
    ['Distance', trip.km > 0 ? `${num(trip.km)} km` : '—'],
    ['Duration', trip.endDate === null ? '—' : (() => { const n = daysBetween(trip.date, trip.endDate) + 1; return `${n} ${n === 1 ? 'day' : 'days'}`; })()],
    ['Status', status === 'done' ? 'Completed' : status === 'ongoing' ? 'On trip' : 'Upcoming'],
  ];
  const fx = M + routeW + 30;
  facts.forEach(([l, v], i) => {
    const fy = y + 4 + i * 19;
    text(l, fx, fy, 9, regular, MUTED);
    right(v, xr, fy, 9.5, semibold, INK, l === 'Vehicle' ? 0.4 : 0);
  });
  y = Math.max(eY + endLines.length * 14 + 20, y + 4 + facts.length * 19) + 14;
  hline(M, xr, y);

  // -------------------------------------------------------------- fare and payments
  y = section('Fare and payments', y + 30);
  y = line('Trip fare (agreed)', money2(trip.fare), y);
  const payments = [...trip.payments].sort((a, b) => a.date.localeCompare(b.date));
  const shown = payments.length > 5 ? payments.slice(0, 4) : payments;
  for (const p of shown) {
    y = line(`${p.kind === 'advance' ? 'Advance received' : 'Payment received'}   ·   ${longDate(p.date)}`, `− ${money2(p.amount)}`, y, { color: MUTED });
  }
  if (payments.length > shown.length) {
    const rest = payments.slice(shown.length);
    y = line(`${rest.length} more payments`, `− ${money2(rest.reduce((s, p) => s + p.amount, 0))}`, y, { color: MUTED });
  }
  if (payments.length === 0) y = line('No payment received yet', money2(0), y, { color: MUTED });
  hline(M, xr, y - 10);
  y = line('Total received', money2(pay.received), y + 6, { strong: true });
  y = line('Balance due', money2(pay.due), y, { strong: true, color: pay.due > 0 ? NAVY : INK });
  hline(M, xr, y - 4);

  // -------------------------------------------------------------- billed to · issued by
  y += 26;
  const colW = (CW - 30) / 2;
  const block = (title: string, x: number, lines: string[]) => {
    text(title.toUpperCase(), x, y, 7.5, semibold, MUTED, 0.9);
    let by = y + 17;
    lines.forEach((l, i) => {
      for (const w of wrap(l, colW, i === 0 ? 10 : 9, i === 0 ? semibold : regular)) {
        text(w, x, by, i === 0 ? 10 : 9, i === 0 ? semibold : regular, i === 0 ? INK : MUTED);
        by += i === 0 ? 15 : 13;
      }
    });
  };
  const name = trip.customerName.trim();
  const phone = trip.customerPhone.trim();
  block('Billed to', M, name || phone ? [name || phone, ...(name && phone ? [phone] : [])] : ['Walk-in customer']);
  block('Issued by', M + colW + 30, [
    COMPANY,
    business.address.trim(),
    business.phone.trim() ? `Phone ${business.phone.trim()}` : '',
    business.email.trim(),
    business.gstin.trim() ? `GSTIN ${business.gstin.trim().toUpperCase()}` : '',
  ].filter(Boolean));

  // -------------------------------------------------------------- footer
  const fy = H - 44;
  hline(M, xr, fy - 18, RULE, 0.6);
  const help = business.phone.trim() ? `Questions about this ${isBooking ? 'booking' : 'receipt'}? Call ${business.phone.trim()}.` : 'Your journey, our promise.';
  center(help, W / 2, fy, 8.5, medium, NAVY);
  center('This is a computer-generated document and does not need a signature.', W / 2, fy + 13, 7.5, regular, MUTED);
  rect(0, H - 6, W, 6, { color: NAVY });

  return doc.save();
}
