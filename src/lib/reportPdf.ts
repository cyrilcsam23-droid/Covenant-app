import { rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { A4, BRAND, Pen, startPdf, type PdfAssets } from './pdfKit';
import type { ReportData, Share } from './report';
import { tripDue, tripExpense, tripProfit, tripReceived } from './calc';
import { money, num, parseISO } from './format';
import { formatPlate } from './vehicle';

/**
 * The period report as a branded A4 PDF: a one-page summary (net result, key figures, trend,
 * averages), then where the money went, by vehicle, money to collect, open bookings and partner
 * capital, then every trip and every company expense in the period.
 */

export const COMPANY = 'Covenant Travels';
const { w: W, h: H } = A4;
const M = 44;
const CW = W - 2 * M;
const BOTTOM = H - 58; // content stops here; the footer sits below

/** "₹1,200", "−₹300" */
const sm = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));
const short = (iso: string) => parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const full = (iso: string) => parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** "2 Nov", "2–6 Nov", "30 Nov – 2 Dec" */
const span = (a: string, b: string | null) => {
  if (!b || b === a) return short(a);
  return a.slice(0, 7) === b.slice(0, 7) ? `${parseISO(a).getDate()}–${short(b)}` : `${short(a)}–${short(b)}`;
};

export const reportFileName = (r: Pick<ReportData, 'from' | 'to' | 'period'>) =>
  `Covenant-report-${r.period.kind === 'all' ? 'all-time' : r.from === r.to ? r.from : `${r.from}_to_${r.to}`}`;

interface Col {
  label: string;
  w: number;
  align?: 'left' | 'right';
}

export async function buildReportPdf(r: ReportData, assets: PdfAssets): Promise<Uint8Array> {
  const { doc, fonts, logo } = await startPdf(assets, {
    title: `${COMPANY} report · ${r.title}`,
    subject: `Business report for ${r.title}`,
    author: COMPANY,
  });
  const { regular, medium, semibold } = fonts;
  const pages: PDFPage[] = [];
  let pen!: Pen;
  let y = 0;

  const newPage = () => {
    const page = doc.addPage([W, H]);
    pages.push(page);
    pen = new Pen(page, fonts);
    pen.rect(0, 0, W, 6, { color: BRAND.navy });
    pen.rect(0, 6, W, 1.4, { color: BRAND.goldLine });
    y = 34;
    if (pages.length > 1) {
      // Running head on later pages.
      pen.text(COMPANY, M, y, 8.5, semibold, BRAND.navy);
      pen.right(`Report · ${r.title}`, W - M, y, 8.5, regular, BRAND.muted);
      pen.hline(M, W - M, y + 9, BRAND.rule, 0.6);
      y += 32;
    }
  };
  /** Start a new page when `h` more points won't fit. Returns true if it did. */
  const need = (h: number) => {
    if (y + h <= BOTTOM) return false;
    newPage();
    return true;
  };
  /**
   * Section title. `rows` (for a table that follows) keeps a short table together with its
   * title: if it would split but fits on a fresh page, it starts one.
   */
  const heading = (title: string, sub?: string, rows = 0, rowH = 19) => {
    const whole = 30 + 20 + rows * rowH;
    if (rows && y + whole > BOTTOM && whole <= BOTTOM - 66) newPage();
    else need(80);
    y += 8;
    pen.text(title, M, y, 13, semibold, BRAND.navy);
    if (sub) pen.right(sub, W - M, y, 8.5, regular, BRAND.muted);
    y += rows ? 12 : 9;
    if (!rows) {
      pen.hline(M, W - M, y, BRAND.navy, 1);
      y += 16;
    }
  };
  const caps = (s: string, x: number, yy: number, color: RGB = BRAND.muted, size = 6.8) => pen.text(s.toUpperCase(), x, yy, size, semibold, color, 0.8);

  /** A table that carries on over pages, repeating its header. */
  const table = (cols: Col[], rows: { cells: string[]; sub?: string; strong?: boolean; colors?: (RGB | undefined)[] }[], opts: { size?: number } = {}) => {
    const size = opts.size ?? 8;
    const xs: number[] = [];
    cols.reduce((x, c) => (xs.push(x), x + c.w), M);
    const pad = 6;
    const head = () => {
      pen.rect(M, y, CW, 20, { color: BRAND.navy });
      cols.forEach((c, i) => {
        const label = c.label.toUpperCase();
        if (c.align === 'right') pen.right(label, xs[i] + c.w - pad, y + 13, 6.6, semibold, BRAND.white, 0.5);
        else pen.text(label, xs[i] + pad, y + 13, 6.6, semibold, BRAND.white, 0.5);
      });
      y += 20;
    };
    need(20 + 24);
    head();
    rows.forEach((row, ri) => {
      const rowH = row.sub ? 28 : 19;
      if (need(rowH)) head();
      if (row.strong) pen.rect(M, y, CW, rowH, { color: BRAND.tint });
      else if (ri % 2 === 1) pen.rect(M, y, CW, rowH, { color: BRAND.tint });
      const font: PDFFont = row.strong ? semibold : regular;
      row.cells.forEach((cell, i) => {
        const c = cols[i];
        const color = row.colors?.[i] ?? BRAND.ink;
        const s = pen.fit(cell, c.w - 2 * pad, size, font);
        if (c.align === 'right') pen.right(s, xs[i] + c.w - pad, y + 12.5, size, font, color);
        else pen.text(s, xs[i] + pad, y + 12.5, size, font, color);
      });
      if (row.sub) pen.text(pen.fit(row.sub, cols[1].w - 2 * pad, 7, regular), xs[1] + pad, y + 23, 7, regular, BRAND.muted);
      y += rowH;
      pen.hline(M, W - M, y, BRAND.rule, 0.5);
    });
  };

  // ================================================================ page 1: summary
  newPage();
  const logoH = pen.image(logo, M - 4, 26, 70);
  caps('Business report', W - M - pen.width('BUSINESS REPORT', 6.8, semibold, 0.8) + 0.8, 44, BRAND.gold);
  pen.right(r.title, W - M, 66, r.title.length > 30 ? 13 : 17, semibold, BRAND.navy);
  pen.right(`Generated ${full(r.generated)}`, W - M, 82, 8.5, regular, BRAND.muted);
  y = Math.max(26 + logoH, 90) + 18;

  // ---- hero: net result
  const t = r.totals;
  const heroH = 104;
  pen.roundRect(M, y, CW, heroH, 10, { color: BRAND.navy });
  caps(t.net < 0 ? 'Net loss' : 'Net profit', M + 22, y + 26, rgbOf(201, 151, 28), 7.5);
  pen.text(sm(t.net), M + 22, y + 62, 32, semibold, BRAND.white);
  pen.text(`Trip profit ${sm(t.tripProfit)}  −  company expenses ${money(t.companyExpenses)}`, M + 22, y + 84, 8.5, regular, rgbOf(190, 200, 222));
  const heroStats: [string, string][] = [
    ['Finished trips', num(t.tripCount)],
    ['Distance', `${num(t.km)} km`],
  ];
  heroStats.forEach(([l, v], i) => {
    const hx = W - M - 22;
    const hy = y + 30 + i * 36;
    pen.right(l.toUpperCase(), hx, hy, 6.8, semibold, rgbOf(190, 200, 222), 0.8);
    pen.right(v, hx, hy + 18, 15, semibold, BRAND.white);
  });
  y += heroH + 16;

  // ---- key figures
  const cards: { label: string; value: string; note: string; color?: RGB }[] = [
    { label: 'Fares', value: money(t.fares), note: 'Agreed on finished trips' },
    { label: 'Trip expenses', value: money(t.tripCost), note: 'Fuel, toll, bata and more' },
    { label: 'Trip profit', value: sm(t.tripProfit), note: 'Fares − trip expenses', color: t.tripProfit < 0 ? BRAND.loss : undefined },
    { label: 'Company expenses', value: money(t.companyExpenses), note: 'Service, EMI, salary…' },
    { label: 'Payments received', value: money(t.paymentsReceived), note: 'By the date received' },
    { label: 'To collect', value: money(t.due), note: t.due > 0 ? `From ${r.dues.length} finished ${r.dues.length === 1 ? 'trip' : 'trips'}` : 'Nothing owed' },
  ];
  const cardW = (CW - 2 * 10) / 3;
  const cardH = 64;
  cards.forEach((c, i) => {
    const cx = M + (i % 3) * (cardW + 10);
    const cy = y + Math.floor(i / 3) * (cardH + 10);
    pen.roundRect(cx, cy, cardW, cardH, 7, { borderColor: BRAND.rule, borderWidth: 0.75 });
    caps(c.label, cx + 12, cy + 18);
    pen.text(c.value, cx + 12, cy + 40, 15, semibold, c.color ?? BRAND.ink);
    pen.text(pen.fit(c.note, cardW - 24, 7.5, regular), cx + 12, cy + 54, 7.5, regular, BRAND.muted);
  });
  y += 2 * cardH + 10 + 14;
  if (t.openTrips > 0) {
    pen.text(
      `Not counted yet: ${t.openTrips} ${t.openTrips === 1 ? 'booking or trip' : 'bookings or trips'} still running, worth ${money(t.openFares)} in fares.`,
      M,
      y,
      8.5,
      regular,
      BRAND.muted,
    );
    y += 16;
  }

  // ---- trend chart
  if (r.trend && r.trend.buckets.length > 1) {
    const tr = r.trend;
    y += 10;
    pen.text(`Net result by ${tr.unit}`, M, y, 11, semibold, BRAND.ink);
    pen.right('Trip profit − company expenses', W - M, y, 8, regular, BRAND.muted);
    y += 14;
    const chartH = 120;
    const maxUp = Math.max(0, ...tr.buckets.map((b) => b.net));
    const maxDown = Math.max(0, ...tr.buckets.map((b) => -b.net));
    const range = maxUp + maxDown || 1;
    const upH = maxDown ? (chartH * maxUp) / range : chartH;
    const zero = y + upH;
    const n = tr.buckets.length;
    const step = CW / n;
    const barW = Math.max(1.5, Math.min(22, step * 0.66));
    pen.hline(M, W - M, zero, BRAND.rule, 0.8);
    tr.buckets.forEach((b, i) => {
      if (b.net === 0) return;
      const h = (Math.abs(b.net) / range) * chartH;
      const bx = M + i * step + (step - barW) / 2;
      const isBest = tr.best?.key === b.key;
      const color = b.net < 0 ? BRAND.loss : isBest ? BRAND.goldLine : BRAND.navy;
      if (b.net > 0) pen.rect(bx, zero - Math.max(h, 1), barW, Math.max(h, 1), { color });
      else pen.rect(bx, zero, barW, Math.max(h, 1), { color });
    });
    // labels: first, middle, last
    const labelY = y + chartH + 12;
    [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i) => {
      pen.center(tr.buckets[i].label, M + i * step + step / 2, labelY, 7, regular, BRAND.muted);
    });
    pen.text(sm(maxUp), M, y - 2, 6.8, regular, BRAND.faint);
    y = labelY + 16;
    const notes: string[] = [];
    if (tr.best) notes.push(`Best ${tr.unit}: ${tr.best.label}, ${sm(tr.best.net)}`);
    if (tr.worst) notes.push(`Weakest ${tr.unit}: ${tr.worst.label}, ${sm(tr.worst.net)}`);
    if (notes.length) {
      pen.text(notes.join('     ·     '), M, y, 8.5, medium, BRAND.ink);
      y += 18;
    }
  }

  // ---- averages
  const a = r.averages;
  const avgs: [string, string][] = [
    ['Profit per trip', a.profitPerTrip === null ? '—' : sm(Math.round(a.profitPerTrip))],
    ['Profit per km', a.profitPerKm === null ? '—' : `${sm(Math.round(a.profitPerKm * 10) / 10)}`],
    ['Net per day', a.netPerDay === null ? '—' : sm(Math.round(a.netPerDay))],
    ['Days with trips', `${a.activeDays} of ${a.days}`],
  ];
  need(60);
  y += 6;
  pen.rect(M, y, CW, 50, { color: BRAND.tint });
  const avgW = CW / avgs.length;
  avgs.forEach(([l, v], i) => {
    const ax = M + i * avgW + 14;
    caps(l, ax, y + 19);
    pen.text(v, ax, y + 38, 12, semibold, BRAND.ink);
    if (i > 0) pen.vline(M + i * avgW, y + 10, y + 40, BRAND.rule, 0.6);
  });
  y += 50;

  // ================================================================ page 2: breakdowns
  newPage();
  heading('Where the money went');
  const shareList = (title: string, list: Share[], total: number, x: number, w: number, color: RGB, top: number) => {
    let yy = top;
    pen.text(title, x, yy, 9.5, semibold, BRAND.ink);
    pen.right(money(total), x + w, yy, 9.5, semibold, BRAND.ink);
    yy += 16;
    if (list.length === 0) {
      pen.text('None in this period.', x, yy, 8.5, regular, BRAND.muted);
      return yy + 14;
    }
    for (const s of list.slice(0, 10)) {
      pen.text(pen.fit(s.label, w - 110, 8.5, regular), x, yy, 8.5, regular, BRAND.ink);
      pen.right(`${money(s.amount)}`, x + w - 34, yy, 8.5, medium, BRAND.ink);
      pen.right(pct(s.share), x + w, yy, 8, regular, BRAND.muted);
      pen.rect(x, yy + 4, w, 3, { color: BRAND.tint });
      pen.rect(x, yy + 4, Math.max(1.5, w * s.share), 3, { color });
      yy += 20;
    }
    if (list.length > 10) {
      const rest = list.slice(10);
      pen.text(`${rest.length} more`, x, yy, 8, regular, BRAND.muted);
      pen.right(money(rest.reduce((s, x) => s + x.amount, 0)), x + w - 34, yy, 8, regular, BRAND.muted);
      yy += 16;
    }
    return yy;
  };
  const colW = (CW - 28) / 2;
  const endA = shareList('Trip expenses', r.tripCostByType, t.tripCost, M, colW, BRAND.goldLine, y);
  const endB = shareList('Company expenses', r.expenseByCategory, t.companyExpenses, M + colW + 28, colW, BRAND.navy, y);
  y = Math.max(endA, endB) + 14;

  if (r.byVehicle.length > 0) {
    heading('By vehicle', undefined, r.byVehicle.length + (r.byVehicle.length > 1 ? 1 : 0));
    table(
      [
        { label: 'Vehicle', w: 88 },
        { label: 'Trips', w: 38, align: 'right' },
        { label: 'Km', w: 50, align: 'right' },
        { label: 'Fares', w: 62, align: 'right' },
        { label: 'Trip exp.', w: 62, align: 'right' },
        { label: 'Trip profit', w: 66, align: 'right' },
        { label: 'Company exp.', w: 70, align: 'right' },
        { label: 'Net', w: CW - 436, align: 'right' },
      ],
      [
        ...r.byVehicle.map((v) => ({
          cells: [v.vehicle, num(v.trips), num(v.km), money(v.fares), money(v.tripCost), sm(v.tripProfit), money(v.companyExpenses), sm(v.net)],
          colors: [undefined, undefined, undefined, undefined, undefined, v.tripProfit < 0 ? BRAND.loss : undefined, undefined, v.net < 0 ? BRAND.loss : undefined],
        })),
        ...(r.byVehicle.length > 1
          ? [{ strong: true, cells: ['Total', num(t.tripCount), num(t.km), money(t.fares), money(t.tripCost), sm(t.tripProfit), money(t.companyExpenses), sm(t.net)] }]
          : []),
      ],
    );
    y += 14;
  }

  if (r.dues.length > 0) {
    heading('Money to collect', `${money(t.due)} from ${r.dues.length} ${r.dues.length === 1 ? 'trip' : 'trips'}`, r.dues.length, 28);
    table(
      [
        { label: 'Trip date', w: 70 },
        { label: 'Customer · route', w: CW - 70 - 70 - 70 - 70 },
        { label: 'Fare', w: 70, align: 'right' },
        { label: 'Received', w: 70, align: 'right' },
        { label: 'To collect', w: 70, align: 'right' },
      ],
      r.dues.map(({ trip, due }) => ({
        cells: [short(trip.date), trip.customerName.trim() || 'No name', money(trip.fare), money(tripReceived(trip)), money(due)],
        sub: `${trip.from} to ${trip.to}${trip.customerPhone ? ` · ${trip.customerPhone}` : ''}`,
      })),
    );
    y += 14;
  }

  if (r.openTripList.length > 0) {
    heading('Bookings and trips in progress', 'Not in the totals until finished', r.openTripList.length, 28);
    table(
      [
        { label: 'Starts', w: 70 },
        { label: 'Customer · route', w: CW - 70 - 74 - 74 - 74 },
        { label: 'Fare', w: 74, align: 'right' },
        { label: 'Advance', w: 74, align: 'right' },
        { label: 'Balance', w: 74, align: 'right' },
      ],
      r.openTripList.map((trip) => ({
        cells: [short(trip.date), trip.customerName.trim() || 'No name', money(trip.fare), money(tripReceived(trip)), money(tripDue(trip))],
        sub: `${trip.from} to ${trip.to}`,
      })),
    );
    y += 14;
  }

  if (r.capital.length > 0) {
    heading('Partner capital', undefined, r.capital.length + 1);
    table(
      [
        { label: 'Partner', w: CW - 150 - 150 },
        { label: 'Added in this period', w: 150, align: 'right' },
        { label: 'Total to date', w: 150, align: 'right' },
      ],
      [
        ...r.capital.map((c) => ({ cells: [c.partner, money(c.inPeriod), money(c.total)] })),
        {
          strong: true,
          cells: ['Total', money(r.capital.reduce((s, c) => s + c.inPeriod, 0)), money(r.capital.reduce((s, c) => s + c.total, 0))],
        },
      ],
    );
    y += 14;
  }

  // ================================================================ lists
  if (r.trips.length > 0) {
    newPage();
    heading('Finished trips', `${r.trips.length} ${r.trips.length === 1 ? 'trip' : 'trips'}`, Math.min(r.trips.length + 1, 8), 24);
    table(
      [
        { label: 'Date', w: 54 },
        { label: 'Trip', w: CW - 54 - 70 - 40 - 56 - 56 - 56 - 50 },
        { label: 'Vehicle', w: 70 },
        { label: 'Km', w: 40, align: 'right' },
        { label: 'Fare', w: 56, align: 'right' },
        { label: 'Expenses', w: 56, align: 'right' },
        { label: 'Profit', w: 56, align: 'right' },
        { label: 'Due', w: 50, align: 'right' },
      ],
      [
        ...r.trips.map((trip) => {
          const p = tripProfit(trip);
          const d = tripDue(trip);
          return {
            cells: [
              span(trip.date, trip.endDate),
              `${trip.from} to ${trip.to}`,
              trip.vehicle ? formatPlate(trip.vehicle) : '—',
              trip.km ? num(trip.km) : '—',
              money(trip.fare),
              money(tripExpense(trip)),
              sm(p),
              d > 0 ? money(d) : '—',
            ],
            sub: trip.customerName.trim() || undefined,
            colors: [undefined, undefined, undefined, undefined, undefined, undefined, p < 0 ? BRAND.loss : undefined, undefined],
          };
        }),
        { strong: true, cells: ['Total', '', '', num(t.km), money(t.fares), money(t.tripCost), sm(t.tripProfit), t.due ? money(t.due) : '—'] },
      ],
      { size: 7.6 },
    );
  }

  if (r.expenses.length > 0) {
    if (r.trips.length > 0) {
      y += 18;
      need(120);
    } else newPage();
    heading('Company expenses', `${r.expenses.length} ${r.expenses.length === 1 ? 'entry' : 'entries'}`, Math.min(r.expenses.length + 1, 8));
    table(
      [
        { label: 'Date', w: 54 },
        { label: 'Type', w: 84 },
        { label: 'Description', w: CW - 54 - 84 - 76 - 74 },
        { label: 'Vehicle', w: 76 },
        { label: 'Amount', w: 74, align: 'right' },
      ],
      [
        ...r.expenses.map((e) => ({ cells: [short(e.date), e.category, e.description, vehicleOf(e.vehicleId), money(e.amount)] })),
        { strong: true, cells: ['Total', '', '', '', money(t.companyExpenses)] },
      ],
      { size: 7.6 },
    );
  }

  // ================================================================ footers (now that the page count is known)
  pages.forEach((page, i) => {
    const p = new Pen(page, fonts);
    p.hline(M, W - M, H - 40, BRAND.rule, 0.6);
    p.text(`${COMPANY} · Business report · ${r.title}`, M, H - 26, 7.2, regular, BRAND.muted);
    p.right(`Page ${i + 1} of ${pages.length}`, W - M, H - 26, 7.2, regular, BRAND.muted);
    p.rect(0, H - 6, W, 6, { color: BRAND.navy });
  });

  return doc.save();

  function vehicleOf(id: string | null) {
    return id ? (r.vehicleNames[id] ?? '—') : '—';
  }
}

function rgbOf(r: number, g: number, b: number): RGB {
  return rgb(r / 255, g / 255, b / 255);
}
