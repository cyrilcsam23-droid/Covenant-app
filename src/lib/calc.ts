import type { AppData, Trip } from './types';

export const tripExpense = (t: Pick<Trip, 'fuel' | 'toll' | 'parking' | 'other'>) =>
  (t.fuel || 0) + (t.toll || 0) + (t.parking || 0) + (t.other || 0);

export const tripProfit = (t: Trip) => (t.received || 0) - tripExpense(t);

export type Period = { kind: 'all' } | { kind: 'month'; month: string } | { kind: 'day'; date: string };

export function inPeriod(date: string, p: Period) {
  if (p.kind === 'all') return true;
  if (p.kind === 'month') return date.startsWith(p.month);
  return date === p.date;
}

export function summarize(data: AppData, period: Period) {
  const trips = data.trips.filter((t) => inPeriod(t.date, period));
  const expenses = data.expenses.filter((e) => inPeriod(e.date, period));

  const received = trips.reduce((s, t) => s + t.received, 0);
  const fuel = trips.reduce((s, t) => s + t.fuel, 0);
  const toll = trips.reduce((s, t) => s + t.toll, 0);
  const parking = trips.reduce((s, t) => s + t.parking, 0);
  const other = trips.reduce((s, t) => s + t.other, 0);
  const tripCost = fuel + toll + parking + other;
  const km = trips.reduce((s, t) => s + t.km, 0);
  const partnerPaid = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    trips,
    tripCount: trips.length,
    km,
    received,
    fuel,
    toll,
    parking,
    other,
    tripCost,
    tripProfit: received - tripCost,
    partnerPaid,
    net: received - tripCost - partnerPaid,
  };
}

/** Per-partner totals across all time (capital is cumulative). */
export function partnerTotals(data: AppData) {
  return data.partners.map((p) => {
    const capital = data.capital.filter((c) => c.partnerId === p.id).reduce((s, c) => s + c.amount, 0);
    const paid = data.expenses.filter((e) => e.partnerId === p.id).reduce((s, e) => s + e.amount, 0);
    return { partner: p, capital, paid, total: capital + paid };
  });
}

/** Trips grouped by date, newest first, with day totals. */
export function groupByDay(trips: Trip[]) {
  const map = new Map<string, Trip[]>();
  [...trips]
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .forEach((t) => {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    });
  return [...map.entries()].map(([date, list]) => ({
    date,
    trips: list,
    km: list.reduce((s, t) => s + t.km, 0),
    profit: list.reduce((s, t) => s + tripProfit(t), 0),
  }));
}

/** Daily profit for each day of a month (for the trend strip). */
export function dailyProfit(data: AppData, month: string) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const out: { date: string; profit: number; trips: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const list = data.trips.filter((t) => t.date === date);
    out.push({ date, profit: list.reduce((s, t) => s + tripProfit(t), 0), trips: list.length });
  }
  return out;
}

export function toCSV(trips: Trip[]) {
  const head = ['Date', 'Vehicle', 'From', 'To', 'Start KM', 'End KM', 'KM', 'Fuel', 'Toll', 'Parking', 'Other', 'Total expense', 'Received', 'Profit', 'Notes'];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...trips]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [t.date, t.vehicle, t.from, t.to, t.startKm ?? '', t.endKm ?? '', t.km, t.fuel, t.toll, t.parking, t.other, tripExpense(t), t.received, tripProfit(t), t.notes]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
