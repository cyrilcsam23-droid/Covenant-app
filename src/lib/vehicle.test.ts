import { describe, expect, it } from 'vitest';
import { formatPlate, itemStatus, needsAttention, plateKey, scheduleLabel, vehicleOdometer } from './vehicle';
import { addMonths } from './format';
import { expenseFromRow, expenseToRow, itemFromRow, itemToRow, vehicleFromRow, vehicleToRow } from './store';
import type { AppData, Expense, Trip, Vehicle, VehicleItem } from './types';

const TODAY = '2026-11-13';
const car: Vehicle = { id: 'v1', number: 'KL 39 Y 0770', name: 'Etios', odometerKm: 50000, odometerDate: '2026-11-01', position: 1 };

const item = (o: Partial<VehicleItem>): VehicleItem => ({
  id: 'i-' + Math.random().toString(36).slice(2),
  vehicleId: 'v1',
  kind: 'service',
  name: 'Oil change',
  everyKm: 5000,
  everyMonths: 6,
  lastKm: 46000,
  lastDate: '2026-08-01',
  dueDate: null,
  remindKm: 500,
  remindDays: 15,
  position: 0,
  ...o,
});

const trip = (o: Partial<Trip>): Trip => ({
  id: 't-' + Math.random().toString(36).slice(2),
  date: TODAY,
  endDate: TODAY,
  vehicle: 'KL39Y0770',
  from: 'A',
  to: 'B',
  startKm: null,
  endKm: null,
  km: 0,
  customerName: '',
  customerPhone: '',
  fare: 0,
  payments: [],
  costs: [],
  notes: '',
  createdAt: '',
  ...o,
});

const data = (o: Partial<AppData>): AppData => ({
  partners: [],
  trips: [],
  capital: [],
  expenses: [],
  vehicles: [car],
  vehicleItems: [],
  settings: { businessName: 'Covenant', defaultVehicle: car.number },
  isSample: false,
  ...o,
});

describe('number plates', () => {
  it('match with or without spaces and case', () => {
    expect(plateKey('kl 39 y 0770')).toBe(plateKey('KL39Y0770'));
  });
  it('are shown in the usual layout', () => {
    expect(formatPlate('kl39y0770')).toBe('KL 39 Y 0770');
    expect(formatPlate('KL07AB1234')).toBe('KL 07 AB 1234');
    expect(formatPlate(' odd plate ')).toBe('ODD PLATE');
  });
});

describe('odometer', () => {
  it('uses the typed reading when nothing is higher', () => {
    expect(vehicleOdometer(data({}), car)).toMatchObject({ km: 50000, source: 'typed' });
  });
  it('picks up a higher end km from a trip on this vehicle, whatever the spacing', () => {
    const d = data({ trips: [trip({ date: '2026-11-12', endDate: '2026-11-12', startKm: 50100, endKm: 50400 })] });
    expect(vehicleOdometer(d, car)).toMatchObject({ km: 50400, source: 'trip', date: '2026-11-12' });
  });
  it('ignores trips in other vehicles', () => {
    const d = data({ trips: [trip({ vehicle: 'KL 07 AB 1234', endKm: 90000 })] });
    expect(vehicleOdometer(d, car).km).toBe(50000);
  });
  it('picks up a reading from a service expense', () => {
    const e: Expense = { id: 'e', date: '2026-11-10', amount: 1, category: 'Service', description: 'x', vehicleId: 'v1', itemId: null, odometerKm: 51000 };
    expect(vehicleOdometer(data({ expenses: [e] }), car)).toMatchObject({ km: 51000, source: 'service' });
  });
});

describe('service reminders', () => {
  it('are fine when far away', () => {
    const s = itemStatus(item({ lastKm: 49000, lastDate: '2026-10-01' }), 50000, TODAY);
    expect(s).toMatchObject({ state: 'ok', nextKm: 54000, kmLeft: 4000, nextDate: '2027-04-01' });
  });
  it('are due soon inside the km warning', () => {
    const s = itemStatus(item({ lastKm: 45400, lastDate: '2026-10-01' }), 50000, TODAY);
    expect(s).toMatchObject({ state: 'soon', kmLeft: 400 });
  });
  it('are overdue once the km is passed', () => {
    const s = itemStatus(item({ lastKm: 44000, lastDate: '2026-10-01' }), 50000, TODAY);
    expect(s).toMatchObject({ state: 'overdue', kmLeft: -1000 });
  });
  it('are overdue by date even if the km is fine (whichever comes first)', () => {
    const s = itemStatus(item({ lastKm: 49900, lastDate: '2026-04-01' }), 50000, TODAY);
    expect(s.state).toBe('overdue');
    expect(s.nextDate).toBe('2026-10-01');
  });
  it('are due soon inside the days warning', () => {
    const s = itemStatus(item({ everyKm: null, lastKm: null, lastDate: '2026-05-20' }), 50000, TODAY);
    expect(s).toMatchObject({ state: 'soon', nextDate: '2026-11-20', daysLeft: 7 });
  });
  it('ask to be set up when never done', () => {
    expect(itemStatus(item({ lastKm: null, lastDate: null }), 50000, TODAY).state).toBe('unset');
  });
});

describe('papers', () => {
  const insurance = (dueDate: string | null) => item({ kind: 'paper', name: 'Insurance', everyKm: null, everyMonths: 12, lastKm: null, lastDate: null, dueDate, remindDays: 30 });
  it('are valid well before expiry', () => {
    expect(itemStatus(insurance('2027-06-30'), 50000, TODAY).state).toBe('ok');
  });
  it('warn inside the days warning', () => {
    expect(itemStatus(insurance('2026-12-01'), 50000, TODAY)).toMatchObject({ state: 'soon', daysLeft: 18 });
  });
  it('are still valid on the expiry day, overdue the day after', () => {
    expect(itemStatus(insurance(TODAY), 50000, TODAY).state).toBe('soon');
    expect(itemStatus(insurance('2026-11-12'), 50000, TODAY).state).toBe('overdue');
  });
  it('ask for the date when it is not known', () => {
    expect(itemStatus(insurance(null), 50000, TODAY).state).toBe('unset');
  });
});

describe('needs attention', () => {
  it('lists overdue before due soon, and leaves out fine ones', () => {
    const fine = item({ name: 'Fine', lastKm: 49900, lastDate: '2026-11-01' });
    const soon = item({ name: 'Soon', lastKm: 45400, lastDate: '2026-11-01' });
    const late = item({ name: 'Late', lastKm: 40000, lastDate: '2026-11-01' });
    const list = needsAttention(data({ vehicleItems: [fine, soon, late] }), TODAY);
    expect(list.map((x) => x.item.name)).toEqual(['Late', 'Soon']);
  });
});

describe('labels and dates', () => {
  it('describe the schedule', () => {
    expect(scheduleLabel(item({ everyKm: 10000, everyMonths: 6 }))).toBe('Every 10,000 km or 6 months');
    expect(scheduleLabel(item({ kind: 'paper', everyKm: null, everyMonths: 12 }))).toBe('Renew every 1 year');
    expect(scheduleLabel(item({ kind: 'paper', everyKm: null, everyMonths: 60 }))).toBe('Renew every 5 years');
  });
  it('add months, clamping to the end of a shorter month', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2026-11-13', 12)).toBe('2027-11-13');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('saving to the online database', () => {
  it('vehicles, reminders and expenses read back what they wrote', () => {
    expect(vehicleFromRow(vehicleToRow(car))).toEqual(car);
    const i = item({ kind: 'paper', dueDate: '2027-03-31' });
    expect(itemFromRow(itemToRow(i))).toEqual(i);
    const e: Expense = { id: 'e1', date: TODAY, amount: 1800, category: 'Service', description: 'Oil change', vehicleId: 'v1', itemId: i.id, odometerKm: 50100 };
    expect(expenseFromRow(expenseToRow(e))).toEqual(e);
  });
  it('send exactly the database columns', () => {
    expect(Object.keys(vehicleToRow(car)).sort()).toEqual(['id', 'name', 'number', 'odometer_date', 'odometer_km', 'position']);
    expect(Object.keys(itemToRow(item({}))).sort()).toEqual(
      ['due_date', 'every_km', 'every_months', 'id', 'kind', 'last_date', 'last_km', 'name', 'position', 'remind_days', 'remind_km', 'vehicle_id'].sort(),
    );
    const e: Expense = { id: 'e', date: TODAY, amount: 1, category: 'Other', description: 'x', vehicleId: null, itemId: null, odometerKm: null };
    expect(Object.keys(expenseToRow(e)).sort()).toEqual(['amount', 'category', 'description', 'expense_date', 'id', 'item_id', 'odometer_km', 'vehicle_id']);
  });
});
