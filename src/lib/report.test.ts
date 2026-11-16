import { describe, expect, it } from 'vitest';
import { buildReportData, periodBounds, reportTitle } from './report';
import type { AppData, Trip } from './types';

const TODAY = '2026-11-16';

const trip = (over: Partial<Trip>): Trip => ({
  id: Math.random().toString(36).slice(2),
  date: '2026-11-02',
  endDate: '2026-11-02',
  vehicle: 'KL39Y0770',
  from: 'Mulanthuruthy',
  to: 'Vyttila',
  startKm: null,
  endKm: null,
  km: 100,
  customerName: '',
  customerPhone: '',
  fare: 5000,
  payments: [{ date: '2026-11-02', kind: 'balance', amount: 5000 }],
  costs: [],
  notes: '',
  createdAt: '2026-11-02T10:00:00Z',
  ...over,
});

const data: AppData = {
  partners: [
    { id: 'p1', name: 'Anil' },
    { id: 'p2', name: 'Biju' },
  ],
  trips: [
    trip({ fare: 7500, km: 150, payments: [{ date: '2026-11-02', kind: 'balance', amount: 7500 }], costs: [{ date: '2026-11-02', type: 'Fuel', amount: 2000 }, { date: '2026-11-02', type: 'Driver bata', amount: 1500 }] }),
    trip({
      date: '2026-11-05',
      endDate: '2026-11-07',
      vehicle: 'KL 07 AB 1234',
      fare: 20000,
      km: 400,
      costs: [{ date: '2026-11-05', type: 'Fuel', amount: 4000 }],
      payments: [{ date: '2026-11-01', kind: 'advance', amount: 2000 }],
      customerName: 'Rajesh',
    }),
    trip({ date: '2026-10-20', endDate: '2026-10-20', fare: 3000, km: 50, payments: [{ date: '2026-10-20', kind: 'balance', amount: 3000 }] }), // October
    trip({ date: '2026-11-20', endDate: '2026-11-21', fare: 9000, payments: [{ date: '2026-11-10', kind: 'advance', amount: 1000 }] }), // upcoming
  ],
  capital: [
    { id: 'c1', partnerId: 'p1', date: '2026-10-01', amount: 100000, note: '' },
    { id: 'c2', partnerId: 'p1', date: '2026-11-03', amount: 20000, note: '' },
    { id: 'c3', partnerId: 'p2', date: '2026-10-01', amount: 50000, note: '' },
  ],
  expenses: [
    { id: 'e1', date: '2026-11-09', amount: 4430, category: 'Loan / EMI', description: 'EMI', vehicleId: 'v1', itemId: null, odometerKm: null },
    { id: 'e2', date: '2026-11-10', amount: 1000, category: 'Fuel', description: 'Diesel', vehicleId: null, itemId: null, odometerKm: null },
    { id: 'e3', date: '2026-10-28', amount: 600, category: 'Other', description: 'Plate', vehicleId: 'v1', itemId: null, odometerKm: null },
  ],
  vehicles: [{ id: 'v1', number: 'KL39Y0770', name: '', odometerKm: null, odometerDate: null, position: 0 }] as AppData['vehicles'],
  vehicleItems: [],
  settings: { businessName: 'Covenant', defaultVehicle: '', receiptAddress: '', receiptPhone: '', receiptEmail: '', receiptGstin: '' },
  isSample: false,
};

describe('report totals', () => {
  const r = buildReportData(data, { kind: 'month', month: '2026-11' }, TODAY);

  it('counts finished trips and company expenses of the period only', () => {
    expect(r.totals.tripCount).toBe(2);
    expect(r.totals.fares).toBe(27500);
    expect(r.totals.tripCost).toBe(7500);
    expect(r.totals.tripProfit).toBe(20000);
    expect(r.totals.companyExpenses).toBe(5430);
    expect(r.totals.net).toBe(14570);
    expect(r.totals.km).toBe(550);
  });

  it('keeps money owed, cash received and open bookings apart', () => {
    expect(r.totals.due).toBe(18000); // 20,000 fare − 2,000 advance
    expect(r.dues).toHaveLength(1);
    // received in November by payment date: 7,500 + 2,000 advance (1 Nov) + 1,000 advance for the booking
    expect(r.totals.paymentsReceived).toBe(10500);
    expect(r.totals.openTrips).toBe(1);
    expect(r.totals.openFares).toBe(9000);
  });

  it('splits where the money went, largest first', () => {
    expect(r.tripCostByType.map((s) => [s.label, s.amount])).toEqual([
      ['Fuel', 6000],
      ['Driver bata', 1500],
    ]);
    expect(r.tripCostByType[0].share).toBeCloseTo(0.8);
    expect(r.expenseByCategory[0]).toMatchObject({ label: 'Loan / EMI', amount: 4430 });
  });

  it('adds up each vehicle, with unlinked expenses last', () => {
    const own = r.byVehicle.find((v) => v.vehicle === 'KL 39 Y 0770')!;
    expect(own).toMatchObject({ trips: 1, fares: 7500, tripProfit: 4000, companyExpenses: 4430, net: -430 });
    expect(r.byVehicle.at(-1)).toMatchObject({ vehicle: 'No vehicle', companyExpenses: 1000 });
    expect(r.byVehicle.reduce((s, v) => s + v.net, 0)).toBe(r.totals.net);
  });

  it('shows a day-by-day trend for a month with best and worst days', () => {
    expect(r.trend?.unit).toBe('day');
    expect(r.trend?.buckets).toHaveLength(30);
    expect(r.trend?.best?.key).toBe('2026-11-05');
    expect(r.trend?.worst?.key).toBe('2026-11-09');
    expect(r.trend!.buckets.reduce((s, b) => s + b.net, 0)).toBe(r.totals.net);
  });

  it('works out averages and partner capital', () => {
    expect(r.averages.profitPerTrip).toBe(10000);
    expect(r.averages.profitPerKm).toBeCloseTo(20000 / 550);
    expect(r.averages.days).toBe(16); // 1–16 Nov so far
    expect(r.capital).toEqual([
      { partner: 'Anil', inPeriod: 20000, total: 120000 },
      { partner: 'Biju', inPeriod: 0, total: 50000 },
    ]);
  });
});

describe('periods', () => {
  it('uses months for long spans and nothing for one day', () => {
    expect(buildReportData(data, { kind: 'year', year: '2026' }, TODAY).trend?.unit).toBe('month');
    expect(buildReportData(data, { kind: 'year', year: '2026' }, TODAY).trend?.buckets).toHaveLength(12);
    expect(buildReportData(data, { kind: 'day', date: '2026-11-02' }, TODAY).trend).toBeNull();
  });

  it('runs All from the first entry', () => {
    expect(periodBounds({ kind: 'all' }, data, TODAY)).toEqual({ from: '2026-10-20', to: '2026-11-20' });
    const all = buildReportData(data, { kind: 'all' }, TODAY);
    expect(all.totals.tripCount).toBe(3);
    expect(all.totals.companyExpenses).toBe(6030);
  });

  it('titles each kind', () => {
    expect(reportTitle({ kind: 'month', month: '2026-11' }, '2026-11-01', '2026-11-30', TODAY)).toBe('November 2026');
    expect(reportTitle({ kind: 'year', year: '2026' }, '2026-01-01', '2026-12-31', TODAY)).toBe('Year 2026');
    expect(reportTitle({ kind: 'all' }, '2026-10-20', '2026-11-16', TODAY)).toBe('All time · 20 Oct 2026 – 16 Nov 2026');
  });

  it('is empty, not broken, for a quiet period', () => {
    const r = buildReportData(data, { kind: 'month', month: '2025-01' }, TODAY);
    expect(r.totals.tripCount).toBe(0);
    expect(r.averages.profitPerTrip).toBeNull();
    expect(r.trend?.best).toBeNull();
  });
});
