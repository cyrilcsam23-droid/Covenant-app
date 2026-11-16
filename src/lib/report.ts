import type { AppData, Expense, Trip, TripCostType } from './types';
import { TRIP_COST_TYPES } from './types';
import { tripDue, tripExpense, tripProfit, tripStatus } from './calc';
import { addDays, daysBetween, fmtMonth, monthOf, parseISO, shiftMonth, todayISO } from './format';
import { inPeriod, lastDayOf, periodTitle, type Period } from './period';
import { formatPlate, plateKey } from './vehicle';

/**
 * Everything the period report shows, worked out once and used by both the PDF and the Excel file.
 *
 * Same rules as the rest of the app: a trip counts when it is finished, under its start date;
 * profit is on the full agreed fare; company expenses count by their date. Payments are also
 * totalled by the date they were received, for anyone checking the cash in hand.
 */

export interface Share {
  label: string;
  amount: number;
  /** 0–1 of the group total. */
  share: number;
}

export interface Bucket {
  key: string; // YYYY-MM-DD or YYYY-MM
  label: string;
  fares: number;
  tripCost: number;
  companyExpenses: number;
  tripProfit: number;
  net: number;
  trips: number;
}

export interface VehicleLine {
  vehicle: string; // formatted plate, or "No vehicle"
  trips: number;
  km: number;
  fares: number;
  tripCost: number;
  tripProfit: number;
  companyExpenses: number;
  net: number;
}

export interface DueLine {
  trip: Trip;
  due: number;
}

export interface ReportData {
  period: Period;
  title: string; // "November 2026", "1 Nov – 14 Nov 2026"…
  from: string;
  to: string;
  generated: string;
  totals: {
    tripCount: number;
    km: number;
    fares: number;
    tripCost: number;
    tripProfit: number;
    companyExpenses: number;
    net: number;
    /** Still owed on the finished trips of the period. */
    due: number;
    /** Money in, by the date it was received (any trip). */
    paymentsReceived: number;
    /** Trips starting in the period that aren't finished yet. */
    openTrips: number;
    openFares: number;
  };
  averages: {
    profitPerTrip: number | null;
    profitPerKm: number | null;
    netPerDay: number | null;
    activeDays: number;
    days: number;
  };
  tripCostByType: Share[];
  expenseByCategory: Share[];
  byVehicle: VehicleLine[];
  trend: { unit: 'day' | 'month'; buckets: Bucket[]; best: Bucket | null; worst: Bucket | null } | null;
  dues: DueLine[];
  capital: { partner: string; inPeriod: number; total: number }[];
  /** Finished trips counted in the totals, oldest first. */
  trips: Trip[];
  /** Bookings and trips still running, starting in the period. */
  openTripList: Trip[];
  expenses: Expense[];
  /** Vehicle id → formatted plate, for the expense lists. */
  vehicleNames: Record<string, string>;
}

const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + (f(x) || 0), 0);

function shares(entries: [string, number][]): Share[] {
  const total = sum(entries, (e) => e[1]);
  return entries
    .filter(([, a]) => a > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, amount, share: total > 0 ? amount / total : 0 }));
}

/** First and last day the period covers. "All" runs from the first entry to today (or the last entry). */
export function periodBounds(p: Period, data: Pick<AppData, 'trips' | 'expenses'>, today = todayISO()): { from: string; to: string } {
  switch (p.kind) {
    case 'day':
      return { from: p.date, to: p.date };
    case 'month':
      return { from: `${p.month}-01`, to: lastDayOf(p.month) };
    case 'year':
      return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
    case 'range':
      return { from: p.from, to: p.to };
    case 'all': {
      const dates = [...data.trips.map((t) => t.date), ...data.expenses.map((e) => e.date)].sort();
      const first = dates[0] ?? today;
      const last = dates.at(-1) ?? today;
      return { from: first, to: last > today ? last : today };
    }
  }
}

const fullDate = (iso: string) => parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Mon, 16 Nov 2026", "November 2026", "Year 2026", "1 Nov – 14 Nov 2026", "All time · 20 Oct 2026 – 16 Nov 2026". */
export function reportTitle(p: Period, from: string, to: string, today = todayISO()): string {
  switch (p.kind) {
    case 'day':
      return parseISO(p.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    case 'month':
      return fmtMonth(p.month);
    case 'year':
      return `Year ${p.year}`;
    case 'range':
      return periodTitle(p, today);
    case 'all':
      return `All time · ${fullDate(from)} – ${fullDate(to)}`;
  }
}

const dayLabel = (iso: string) => parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const monthLabel = (ym: string) => parseISO(`${ym}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

export function buildReportData(data: AppData, period: Period, today = todayISO()): ReportData {
  const { from, to } = periodBounds(period, data, today);
  const inP = (d: string) => inPeriod(d, period);

  const started = data.trips.filter((t) => inP(t.date));
  const trips = started.filter((t) => tripStatus(t, today) === 'done').sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const openTripList = started.filter((t) => tripStatus(t, today) !== 'done').sort((a, b) => a.date.localeCompare(b.date));
  const expenses = data.expenses.filter((e) => inP(e.date)).sort((a, b) => a.date.localeCompare(b.date));

  const fares = sum(trips, (t) => t.fare);
  const tripCost = sum(trips, tripExpense);
  const tripProfitTotal = fares - tripCost;
  const companyExpenses = sum(expenses, (e) => e.amount);
  const km = sum(trips, (t) => t.km);
  const net = tripProfitTotal - companyExpenses;
  const paymentsReceived = sum(data.trips.flatMap((t) => t.payments).filter((p) => inP(p.date)), (p) => p.amount);

  // ---- where the money went
  const byType = new Map<TripCostType, number>();
  for (const t of trips) for (const c of t.costs) byType.set(c.type, (byType.get(c.type) ?? 0) + c.amount);
  const tripCostByType = shares(TRIP_COST_TYPES.map((k) => [k, byType.get(k) ?? 0]));
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const expenseByCategory = shares([...byCat.entries()]);

  // ---- by vehicle (trips by their plate; company expenses by their linked vehicle)
  const lines = new Map<string, VehicleLine>();
  const line = (key: string, label: string) => {
    let l = lines.get(key);
    if (!l) lines.set(key, (l = { vehicle: label, trips: 0, km: 0, fares: 0, tripCost: 0, tripProfit: 0, companyExpenses: 0, net: 0 }));
    return l;
  };
  for (const t of trips) {
    const key = plateKey(t.vehicle);
    const l = line(key || '—', key ? formatPlate(t.vehicle) : 'No vehicle');
    l.trips += 1;
    l.km += t.km || 0;
    l.fares += t.fare || 0;
    l.tripCost += tripExpense(t);
    l.tripProfit += tripProfit(t);
  }
  for (const e of expenses) {
    const v = e.vehicleId ? data.vehicles.find((x) => x.id === e.vehicleId) : undefined;
    const key = v ? plateKey(v.number) : '';
    line(key || '—', key ? formatPlate(v!.number) : 'No vehicle').companyExpenses += e.amount;
  }
  const byVehicle = [...lines.values()]
    .map((l) => ({ ...l, net: l.tripProfit - l.companyExpenses }))
    .sort((a, b) => (a.vehicle === 'No vehicle' ? 1 : b.vehicle === 'No vehicle' ? -1 : b.fares - a.fares));

  // ---- trend: by day up to ~2 months, by month beyond that; none for a single day
  const span = daysBetween(from, to) + 1;
  let trend: ReportData['trend'] = null;
  if (span > 1) {
    const unit: 'day' | 'month' = span <= 62 ? 'day' : 'month';
    const keys: string[] = [];
    if (unit === 'day') for (let d = from; d <= to && keys.length < 62; d = addDays(d, 1)) keys.push(d);
    else for (let m = monthOf(from); m <= monthOf(to) && keys.length < 240; m = shiftMonth(m, 1)) keys.push(m);
    const keyOf = (d: string) => (unit === 'day' ? d : monthOf(d));
    const map = new Map<string, Bucket>(
      keys.map((k) => [k, { key: k, label: unit === 'day' ? dayLabel(k) : monthLabel(k), fares: 0, tripCost: 0, companyExpenses: 0, tripProfit: 0, net: 0, trips: 0 }]),
    );
    for (const t of trips) {
      const b = map.get(keyOf(t.date));
      if (!b) continue;
      b.trips += 1;
      b.fares += t.fare || 0;
      b.tripCost += tripExpense(t);
    }
    for (const e of expenses) {
      const b = map.get(keyOf(e.date));
      if (b) b.companyExpenses += e.amount;
    }
    const buckets = [...map.values()].map((b) => ({ ...b, tripProfit: b.fares - b.tripCost, net: b.fares - b.tripCost - b.companyExpenses }));
    const active = buckets.filter((b) => b.trips > 0 || b.companyExpenses > 0);
    const best = active.length ? active.reduce((a, b) => (b.net > a.net ? b : a)) : null;
    const worst = active.length > 1 ? active.reduce((a, b) => (b.net < a.net ? b : a)) : null;
    trend = { unit, buckets, best, worst: worst && best && worst.key !== best.key ? worst : null };
  }

  const activeDays = new Set(trips.map((t) => t.date)).size;
  // Days of the period that have happened so far (a running month counts up to today).
  const lastDay = to < today ? to : today < from ? from : today;
  const days = daysBetween(from, lastDay) + 1;

  const dues = trips.map((trip) => ({ trip, due: tripDue(trip) })).filter((d) => d.due > 0);

  const capital = data.partners.map((p) => {
    const mine = data.capital.filter((c) => c.partnerId === p.id);
    return { partner: p.name, inPeriod: sum(mine.filter((c) => inP(c.date)), (c) => c.amount), total: sum(mine, (c) => c.amount) };
  });

  return {
    period,
    title: reportTitle(period, from, to, today),
    from,
    to,
    generated: today,
    totals: {
      tripCount: trips.length,
      km,
      fares,
      tripCost,
      tripProfit: tripProfitTotal,
      companyExpenses,
      net,
      due: sum(dues, (d) => d.due),
      paymentsReceived,
      openTrips: openTripList.length,
      openFares: sum(openTripList, (t) => t.fare),
    },
    averages: {
      profitPerTrip: trips.length ? tripProfitTotal / trips.length : null,
      profitPerKm: km > 0 ? tripProfitTotal / km : null,
      netPerDay: span > 1 ? net / days : null,
      activeDays,
      days,
    },
    tripCostByType,
    expenseByCategory,
    byVehicle,
    trend,
    dues,
    capital,
    trips,
    openTripList,
    expenses,
    vehicleNames: Object.fromEntries(data.vehicles.map((v) => [v.id, formatPlate(v.number)])),
  };
}

