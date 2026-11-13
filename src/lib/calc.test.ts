import { describe, expect, it } from 'vitest';
import {
  dues,
  groupByDay,
  ongoingTrips,
  summarize,
  toCSV,
  tripAdvance,
  tripDays,
  tripDue,
  tripExpense,
  tripProfit,
  tripReceived,
  tripStatus,
  tripsOnDay,
  upcomingTrips,
} from './calc';
import { addDays, daysBetween, fmtRange } from './format';
import { normalizeTrip, tripFromRow, tripToRow } from './store';
import { tripCalendarFile } from './calendarFile';
import type { AppData, Trip } from './types';

const TODAY = '2026-11-12';

const trip = (o: Partial<Trip>): Trip => ({
  id: Math.random().toString(36).slice(2),
  date: TODAY,
  endDate: TODAY,
  vehicle: 'KL 07 AB 1234',
  from: 'Kochi',
  to: 'Munnar',
  startKm: null,
  endKm: null,
  km: 100,
  customerName: '',
  customerPhone: '',
  fare: 0,
  payments: [],
  costs: [],
  notes: '',
  createdAt: '2026-11-01T00:00:00Z',
  ...o,
});

const data = (trips: Trip[], companyCosts: { date: string; amount: number }[] = []): AppData => ({
  partners: [],
  trips,
  capital: [],
  expenses: companyCosts.map((e, i) => ({ id: String(i), date: e.date, amount: e.amount, category: 'Repair', description: 'x', vehicleId: null, itemId: null, odometerKm: null })),
  vehicles: [],
  vehicleItems: [],
  settings: { businessName: 'Covenant', defaultVehicle: '' },
  isSample: false,
});

describe('one trip', () => {
  const t = trip({
    fare: 12000,
    payments: [
      { date: '2026-11-01', kind: 'advance', amount: 3000 },
      { date: '2026-11-14', kind: 'balance', amount: 5000 },
    ],
    costs: [
      { date: '2026-11-12', type: 'Fuel', amount: 1450 },
      { date: '2026-11-13', type: 'Stay', amount: 1200 },
      { date: '2026-11-13', type: 'Driver bata', amount: 500 },
    ],
  });
  it('adds up expenses, payments and the advance', () => {
    expect(tripExpense(t)).toBe(3150);
    expect(tripReceived(t)).toBe(8000);
    expect(tripAdvance(t)).toBe(3000);
  });
  it('counts profit on the full fare and shows what is still due', () => {
    expect(tripProfit(t)).toBe(8850);
    expect(tripDue(t)).toBe(4000);
  });
  it('never shows a negative due when overpaid', () => {
    expect(tripDue(trip({ fare: 1000, payments: [{ date: TODAY, kind: 'balance', amount: 1500 }] }))).toBe(0);
  });
  it('shows a loss when costs are more than the fare', () => {
    expect(tripProfit(trip({ fare: 1000, costs: [{ date: TODAY, type: 'Fuel', amount: 1300 }] }))).toBe(-300);
  });
});

describe('trip status', () => {
  it('is upcoming before the start date', () => {
    expect(tripStatus(trip({ date: '2026-11-15', endDate: '2026-11-15' }), TODAY)).toBe('upcoming');
    expect(tripStatus(trip({ date: '2026-11-15', endDate: null }), TODAY)).toBe('upcoming');
  });
  it('is done for a one-day trip logged today', () => {
    expect(tripStatus(trip({ date: TODAY, endDate: TODAY }), TODAY)).toBe('done');
  });
  it('is on trip while a multi-day trip is running', () => {
    expect(tripStatus(trip({ date: '2026-11-11', endDate: '2026-11-13' }), TODAY)).toBe('ongoing');
  });
  it('is on trip while the end date is not known', () => {
    expect(tripStatus(trip({ date: '2026-11-01', endDate: null }), TODAY)).toBe('ongoing');
  });
  it('is done after the last day', () => {
    expect(tripStatus(trip({ date: '2026-11-08', endDate: '2026-11-10' }), TODAY)).toBe('done');
  });
});

describe('days of a trip', () => {
  it('lists every day from start to end', () => {
    expect(tripDays(trip({ date: '2026-11-30', endDate: '2026-12-02' }), TODAY)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });
  it('runs up to today when the end is not known', () => {
    expect(tripDays(trip({ date: '2026-11-10', endDate: null }), TODAY)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
  });
  it('includes a later day that already has expenses', () => {
    const t = trip({ date: '2026-11-15', endDate: null, costs: [{ date: '2026-11-17', type: 'Fuel', amount: 5 }] });
    expect(tripDays(t, TODAY)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
  });
  it('is a single day for a one-day trip', () => {
    expect(tripDays(trip({}), TODAY)).toEqual([TODAY]);
  });
});

describe('totals', () => {
  const finished = trip({ date: '2026-11-05', endDate: '2026-11-06', fare: 5000, km: 200, costs: [{ date: '2026-11-05', type: 'Fuel', amount: 1500 }], payments: [{ date: '2026-11-06', kind: 'balance', amount: 3000 }] });
  const running = trip({ date: '2026-11-11', endDate: null, fare: 0, costs: [{ date: '2026-11-11', type: 'Fuel', amount: 2000 }], payments: [{ date: '2026-11-09', kind: 'advance', amount: 2000 }] });
  const upcoming = trip({ date: '2026-11-20', endDate: '2026-11-21', fare: 9000, payments: [{ date: '2026-11-10', kind: 'advance', amount: 2000 }] });
  const lastMonth = trip({ date: '2026-10-28', endDate: '2026-10-28', fare: 2000, payments: [{ date: '2026-10-28', kind: 'balance', amount: 2000 }] });
  const d = data([finished, running, upcoming, lastMonth], [{ date: '2026-11-07', amount: 500 }]);

  it('counts only finished trips in a month', () => {
    const s = summarize(d, { kind: 'month', month: '2026-11' }, TODAY);
    expect(s.tripCount).toBe(1);
    expect(s.fares).toBe(5000);
    expect(s.tripCost).toBe(1500);
    expect(s.tripProfit).toBe(3500);
    expect(s.received).toBe(3000);
    expect(s.due).toBe(2000);
    expect(s.km).toBe(200);
    expect(s.net).toBe(3000);
    expect(s.trips).toHaveLength(3); // listed, even if not counted
  });
  it('counts all finished trips for all time', () => {
    const s = summarize(d, { kind: 'all' }, TODAY);
    expect(s.tripCount).toBe(2);
    expect(s.tripProfit).toBe(5500);
  });
  it('lists upcoming, on-trip and dues correctly', () => {
    expect(upcomingTrips(d, TODAY).map((t) => t.id)).toEqual([upcoming.id]);
    expect(ongoingTrips(d, TODAY).map((t) => t.id)).toEqual([running.id]);
    const owed = dues(d, TODAY);
    expect(owed.trips.map((t) => t.id)).toEqual([finished.id]);
    expect(owed.total).toBe(2000);
  });
  it('does not count a running trip with only an advance as a due', () => {
    expect(dues(data([running]), TODAY).trips).toHaveLength(0);
  });
  it('groups by start date, totalling finished trips only', () => {
    const g = groupByDay([finished, running], TODAY);
    expect(g.map((x) => x.date)).toEqual(['2026-11-11', '2026-11-05']);
    expect(g[0].profit).toBe(0);
    expect(g[1].profit).toBe(3500);
  });
});

describe('calendar', () => {
  const multi = trip({ date: '2026-11-11', endDate: '2026-11-13' });
  const open = trip({ date: '2026-11-10', endDate: null });
  const future = trip({ date: '2026-11-20', endDate: null });
  const d = data([multi, open, future]);
  it('shows a trip on every day it covers', () => {
    expect(tripsOnDay(d, '2026-11-13', TODAY).map((t) => t.id)).toEqual([multi.id]);
    expect(tripsOnDay(d, '2026-11-14', TODAY)).toHaveLength(0);
  });
  it('shows a running trip with no end up to today', () => {
    expect(tripsOnDay(d, '2026-11-12', TODAY).map((t) => t.id)).toContain(open.id);
    expect(tripsOnDay(d, '2026-11-13', TODAY).map((t) => t.id)).not.toContain(open.id);
  });
  it('shows an upcoming trip with no end on its start day', () => {
    expect(tripsOnDay(d, '2026-11-20', TODAY).map((t) => t.id)).toEqual([future.id]);
  });
});

describe('older saved trips', () => {
  it('converts the first-version shape without losing money', () => {
    const t = normalizeTrip({ id: 'x', date: '2026-11-01', from: 'A', to: 'B', km: 50, fuel: 1000, toll: 100, parking: 0, other: 50, received: 3000, notes: '', createdAt: 'z' });
    expect(t.fare).toBe(3000);
    expect(tripReceived(t)).toBe(3000);
    expect(tripExpense(t)).toBe(1150);
    expect(tripProfit(t)).toBe(1850);
    expect(t.endDate).toBe('2026-11-01');
    expect(t.costs.map((c) => c.type)).toEqual(['Fuel', 'Toll', 'Other']);
  });
  it('keeps an unknown end date as unknown', () => {
    expect(normalizeTrip({ date: '2026-11-01', endDate: null, costs: [], payments: [] }).endDate).toBeNull();
  });
});

describe('spreadsheet export', () => {
  it('protects against formula injection but keeps negative numbers as numbers', () => {
    const csv = toCSV([trip({ notes: '=HYPERLINK("x")', fare: 100, costs: [{ date: TODAY, type: 'Fuel', amount: 400 }] })], TODAY);
    const row = csv.split('\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain(',-300,');
  });
});

describe('saving to the online database', () => {
  // Writable columns of public.trips (generated totals and audit columns are set by the database).
  const DB_COLUMNS = [
    'id', 'trip_date', 'end_date', 'vehicle', 'from_place', 'to_place', 'start_km', 'end_km', 'km',
    'customer_name', 'customer_phone', 'fare', 'payments', 'costs', 'notes',
  ];
  const t = trip({
    id: 'id-1',
    endDate: null,
    customerName: 'Rajesh',
    customerPhone: '+91 98470 12345',
    fare: 12000,
    payments: [{ date: '2026-11-01', kind: 'advance', amount: 3000 }],
    costs: [{ date: TODAY, type: 'Fuel', amount: 1450 }],
  });
  it('sends exactly the database columns', () => {
    expect(Object.keys(tripToRow(t)).sort()).toEqual([...DB_COLUMNS].sort());
  });
  it('reads back what it wrote', () => {
    const back = tripFromRow({ ...tripToRow(t), created_at: t.createdAt });
    expect(back).toEqual(t);
  });
});

describe('phone calendar file', () => {
  const booking = trip({
    id: 'abc',
    date: '2026-11-14',
    endDate: '2026-11-15',
    from: 'Kochi',
    to: 'Wayanad',
    customerName: 'Fathima, Ali; & co',
    customerPhone: '+91 81290 33456',
    fare: 9000,
    payments: [{ date: '2026-11-10', kind: 'advance', amount: 2000 }],
  });
  const ics = tripCalendarFile(booking, 'Covenant');
  it('is a valid all-day event covering every day of the trip', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261114');
    expect(ics).toContain('DTEND;VALUE=DATE:20261116'); // end is exclusive
    expect(ics).toContain('UID:abc@covenant-trips');
  });
  it('reminds the evening before and the morning of', () => {
    expect(ics).toContain('TRIGGER:-PT6H');
    expect(ics).toContain('TRIGGER:PT7H');
  });
  it('escapes commas and semicolons in names', () => {
    expect(ics).toContain('Fathima\\, Ali\\; & co');
  });
  it('uses CRLF and folds long lines', () => {
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });
  it('treats an unknown end as a one-day event', () => {
    expect(tripCalendarFile(trip({ date: '2026-11-20', endDate: null }), 'Covenant')).toContain('DTEND;VALUE=DATE:20261121');
  });
});

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-30', '2026-12-02')).toBe(2);
  });
  it('formats date ranges', () => {
    expect(fmtRange('2026-11-12', '2026-11-12')).toBe('12 Nov');
    expect(fmtRange('2026-11-12', '2026-11-15')).toBe('12–15 Nov');
    expect(fmtRange('2026-11-30', '2026-12-02')).toBe('30 Nov – 2 Dec');
    expect(fmtRange('2026-11-12', null)).toBe('From 12 Nov');
  });
});
