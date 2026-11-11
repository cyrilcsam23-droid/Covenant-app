import { TRIP_COST_TYPES, type AppData, type Trip, type TripCostType } from './types';
import { addDays, todayISO } from './format';

// ---------------------------------------------------------------- one trip

const sum = (list: { amount: number }[]) => list.reduce((s, x) => s + (x.amount || 0), 0);

export const tripExpense = (t: Pick<Trip, 'costs'>) => sum(t.costs);
export const tripReceived = (t: Pick<Trip, 'payments'>) => sum(t.payments);
export const tripAdvance = (t: Pick<Trip, 'payments'>) => sum(t.payments.filter((p) => p.kind === 'advance'));
/** Profit on the full agreed fare (money still owed counts; it shows separately as "due"). */
export const tripProfit = (t: Pick<Trip, 'fare' | 'costs'>) => (t.fare || 0) - tripExpense(t);
/** Money still to collect. Never negative. */
export const tripDue = (t: Pick<Trip, 'fare' | 'payments'>) => Math.max(0, (t.fare || 0) - tripReceived(t));

export type TripStatus = 'upcoming' | 'ongoing' | 'done';

/** upcoming = hasn't started; ongoing = started, not finished (or end not known); done = finished. */
export function tripStatus(t: Pick<Trip, 'date' | 'endDate'>, today = todayISO()): TripStatus {
  if (t.date > today) return 'upcoming';
  if (t.endDate === null || t.endDate > today) return 'ongoing';
  return 'done';
}

/** Days of the trip, in order: start → end; with no end yet, start → the last day that has expenses or today. */
export function tripDays(t: Pick<Trip, 'date' | 'endDate' | 'costs'>, today = todayISO()): string[] {
  let last = t.endDate;
  if (last === null) {
    last = t.date;
    for (const c of t.costs) if (c.date > last) last = c.date;
    if (today > last && today <= addDays(t.date, 120)) last = today;
  }
  const days: string[] = [];
  for (let d = t.date; d <= last && days.length <= 121; d = addDays(d, 1)) days.push(d);
  return days;
}

export function costsByType(t: Pick<Trip, 'costs'>): Partial<Record<TripCostType, number>> {
  const out: Partial<Record<TripCostType, number>> = {};
  for (const c of t.costs) out[c.type] = (out[c.type] ?? 0) + c.amount;
  return out;
}

// ---------------------------------------------------------------- periods

export type Period = { kind: 'all' } | { kind: 'month'; month: string } | { kind: 'day'; date: string };

export function inPeriod(date: string, p: Period) {
  if (p.kind === 'all') return true;
  if (p.kind === 'month') return date.startsWith(p.month);
  return date === p.date;
}

/**
 * Totals for a period. Only finished trips count (an upcoming or still-running trip's fare
 * isn't earned yet); they count under their start date.
 */
export function summarize(data: AppData, period: Period, today = todayISO()) {
  const trips = data.trips.filter((t) => inPeriod(t.date, period));
  const done = trips.filter((t) => tripStatus(t, today) === 'done');
  const expenses = data.expenses.filter((e) => inPeriod(e.date, period));

  const fares = done.reduce((s, t) => s + (t.fare || 0), 0);
  const tripCost = done.reduce((s, t) => s + tripExpense(t), 0);
  const received = done.reduce((s, t) => s + tripReceived(t), 0);
  const due = done.reduce((s, t) => s + tripDue(t), 0);
  const km = done.reduce((s, t) => s + (t.km || 0), 0);
  const partnerPaid = expenses.reduce((s, e) => s + e.amount, 0);
  const tripProfitTotal = fares - tripCost;

  return {
    /** All trips starting in the period (any status), for listing. */
    trips,
    /** Finished trips, the ones counted in the totals. */
    done,
    tripCount: done.length,
    km,
    fares,
    received,
    due,
    tripCost,
    tripProfit: tripProfitTotal,
    partnerPaid,
    net: tripProfitTotal - partnerPaid,
  };
}

// ---------------------------------------------------------------- lists

const byStart = (a: Trip, b: Trip) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date));

export const upcomingTrips = (data: AppData, today = todayISO()) =>
  data.trips.filter((t) => tripStatus(t, today) === 'upcoming').sort(byStart);

export const ongoingTrips = (data: AppData, today = todayISO()) =>
  data.trips.filter((t) => tripStatus(t, today) === 'ongoing').sort(byStart);

/** Finished trips that still have money to collect, oldest first. */
export function dues(data: AppData, today = todayISO()) {
  const trips = data.trips.filter((t) => tripStatus(t, today) === 'done' && tripDue(t) > 0).sort(byStart);
  return { trips, total: trips.reduce((s, t) => s + tripDue(t), 0) };
}

/** Trips on the road on a given day (for the calendar). */
export function tripsOnDay(data: AppData, day: string, today = todayISO()) {
  return data.trips
    .filter((t) => {
      if (day < t.date) return false;
      const end = t.endDate ?? (tripStatus(t, today) === 'upcoming' ? t.date : tripDays(t, today).at(-1)!);
      return day <= end;
    })
    .sort(byStart);
}

/** Per-partner totals across all time (capital is cumulative). */
export function partnerTotals(data: AppData) {
  return data.partners.map((p) => {
    const capital = data.capital.filter((c) => c.partnerId === p.id).reduce((s, c) => s + c.amount, 0);
    const paid = data.expenses.filter((e) => e.partnerId === p.id).reduce((s, e) => s + e.amount, 0);
    return { partner: p, capital, paid, total: capital + paid };
  });
}

/** Trips grouped by start date, newest first. Day totals count finished trips only. */
export function groupByDay(trips: Trip[], today = todayISO()) {
  const map = new Map<string, Trip[]>();
  [...trips]
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .forEach((t) => {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    });
  return [...map.entries()].map(([date, list]) => {
    const done = list.filter((t) => tripStatus(t, today) === 'done');
    return {
      date,
      trips: list,
      km: done.reduce((s, t) => s + (t.km || 0), 0),
      profit: done.reduce((s, t) => s + tripProfit(t), 0),
      counted: done.length,
    };
  });
}

/** Daily profit for each day of a month (finished trips, by start date). */
export function dailyProfit(data: AppData, month: string, today = todayISO()) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const out: { date: string; profit: number; trips: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const list = data.trips.filter((t) => t.date === date && tripStatus(t, today) === 'done');
    out.push({ date, profit: list.reduce((s, t) => s + tripProfit(t), 0), trips: list.length });
  }
  return out;
}

const STATUS_LABEL: Record<TripStatus, string> = { upcoming: 'Upcoming', ongoing: 'On trip', done: 'Completed' };

export function toCSV(trips: Trip[], today = todayISO()) {
  const head = [
    'Start date', 'End date', 'Status', 'Customer', 'Phone', 'Vehicle', 'From', 'To', 'Start KM', 'End KM', 'KM',
    'Fare', 'Advance', 'Received', 'Due', ...TRIP_COST_TYPES, 'Total expense', 'Profit', 'Notes',
  ];
  const esc = (v: unknown) => {
    let s = String(v ?? '');
    // Stop spreadsheet formula injection from typed text (numbers like −300 stay numbers).
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...trips].sort(byStart).map((t) => {
    const byType = costsByType(t);
    return [
      t.date, t.endDate ?? '', STATUS_LABEL[tripStatus(t, today)], t.customerName, t.customerPhone, t.vehicle, t.from, t.to,
      t.startKm ?? '', t.endKm ?? '', t.km, t.fare, tripAdvance(t), tripReceived(t), tripDue(t),
      ...TRIP_COST_TYPES.map((k) => byType[k] ?? 0), tripExpense(t), tripProfit(t), t.notes,
    ];
  });
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
