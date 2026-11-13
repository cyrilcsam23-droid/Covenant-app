/** Vehicle dashboard logic: current odometer, reminder status, what needs attention. */
import type { AppData, Vehicle, VehicleItem } from './types';
import { addMonths, daysBetween, todayISO } from './format';

/** Registration numbers compared without spaces or case: "KL 39 Y 0770" = "kl39y0770". */
export const plateKey = (n: string) => n.replace(/\s+/g, '').toUpperCase();

/** "KL39Y0770" → "KL 39 Y 0770" (Indian plate layout); anything else is returned trimmed. */
export function formatPlate(n: string) {
  const m = plateKey(n).match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : n.trim().toUpperCase();
}

export interface Reading {
  km: number;
  date: string | null;
  source: 'typed' | 'trip' | 'service' | 'none';
}

/** Highest known odometer reading: typed in, from a trip's end km, or from a service. */
export function vehicleOdometer(data: AppData, v: Vehicle): Reading {
  let best: Reading = { km: v.odometerKm ?? 0, date: v.odometerDate, source: v.odometerKm != null ? 'typed' : 'none' };
  const key = plateKey(v.number);
  for (const t of data.trips) {
    if (plateKey(t.vehicle) !== key) continue;
    const km = t.endKm ?? t.startKm;
    if (km != null && km > best.km) best = { km, date: t.endDate ?? t.date, source: 'trip' };
  }
  for (const e of data.expenses) {
    if (e.vehicleId === v.id && e.odometerKm != null && e.odometerKm > best.km) best = { km: e.odometerKm, date: e.date, source: 'service' };
  }
  return best;
}

export type ItemState = 'overdue' | 'soon' | 'ok' | 'unset';

export interface ItemStatus {
  state: ItemState;
  /** Odometer at which it's next due (service, by km). */
  nextKm: number | null;
  kmLeft: number | null;
  /** Date it's next due / expires. */
  nextDate: string | null;
  daysLeft: number | null;
}

export function itemStatus(item: VehicleItem, odometerKm: number, today = todayISO()): ItemStatus {
  let nextKm: number | null = null;
  let nextDate: string | null = null;
  if (item.kind === 'paper') {
    nextDate = item.dueDate ?? (item.lastDate && item.everyMonths ? addMonths(item.lastDate, item.everyMonths) : null);
  } else {
    if (item.everyKm && item.lastKm != null) nextKm = item.lastKm + item.everyKm;
    if (item.everyMonths && item.lastDate) nextDate = addMonths(item.lastDate, item.everyMonths);
  }
  const kmLeft = nextKm === null ? null : nextKm - odometerKm;
  const daysLeft = nextDate === null ? null : daysBetween(today, nextDate);
  let state: ItemState = 'unset';
  if (kmLeft !== null || daysLeft !== null) {
    if ((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft < 0)) state = 'overdue';
    else if ((kmLeft !== null && kmLeft <= item.remindKm) || (daysLeft !== null && daysLeft <= item.remindDays)) state = 'soon';
    else state = 'ok';
  }
  return { state, nextKm, kmLeft, nextDate, daysLeft };
}

const RANK: Record<ItemState, number> = { overdue: 0, soon: 1, unset: 2, ok: 3 };

/** Reminders that are overdue or due soon, most urgent first (across all vehicles). */
export function needsAttention(data: AppData, today = todayISO()) {
  const out: { vehicle: Vehicle; item: VehicleItem; status: ItemStatus }[] = [];
  for (const v of data.vehicles) {
    const odo = vehicleOdometer(data, v).km;
    for (const item of data.vehicleItems.filter((i) => i.vehicleId === v.id)) {
      const status = itemStatus(item, odo, today);
      if (status.state === 'overdue' || status.state === 'soon') out.push({ vehicle: v, item, status });
    }
  }
  return out.sort(
    (a, b) =>
      RANK[a.status.state] - RANK[b.status.state] ||
      (a.status.daysLeft ?? 99999) - (b.status.daysLeft ?? 99999) ||
      (a.status.kmLeft ?? 9999999) - (b.status.kmLeft ?? 9999999),
  );
}

/** Items of a vehicle with their status, most urgent first. */
export function vehicleItems(data: AppData, v: Vehicle, today = todayISO()) {
  const odo = vehicleOdometer(data, v).km;
  return data.vehicleItems
    .filter((i) => i.vehicleId === v.id)
    .map((item) => ({ item, status: itemStatus(item, odo, today) }))
    .sort((a, b) => RANK[a.status.state] - RANK[b.status.state] || a.item.position - b.item.position);
}

export interface ItemTemplate {
  kind: 'service' | 'paper';
  name: string;
  everyKm: number | null;
  everyMonths: number | null;
  remindKm: number;
  remindDays: number;
  /** Expense category used when it's done or renewed. */
  category: string;
}

/** Common things to track for a taxi in India. Every value can be changed per vehicle. */
export const ITEM_TEMPLATES: ItemTemplate[] = [
  { kind: 'paper', name: 'Insurance', everyKm: null, everyMonths: 12, remindKm: 0, remindDays: 30, category: 'Insurance' },
  { kind: 'paper', name: 'Pollution test (PUC)', everyKm: null, everyMonths: 6, remindKm: 0, remindDays: 15, category: 'Pollution test' },
  { kind: 'paper', name: 'Road tax', everyKm: null, everyMonths: 3, remindKm: 0, remindDays: 15, category: 'Tax / permit' },
  { kind: 'paper', name: 'Permit', everyKm: null, everyMonths: 60, remindKm: 0, remindDays: 30, category: 'Tax / permit' },
  { kind: 'paper', name: 'Fitness certificate', everyKm: null, everyMonths: 12, remindKm: 0, remindDays: 30, category: 'Tax / permit' },
  { kind: 'service', name: 'General service', everyKm: 10000, everyMonths: 6, remindKm: 1000, remindDays: 15, category: 'Service' },
  { kind: 'service', name: 'Oil change', everyKm: 5000, everyMonths: 6, remindKm: 500, remindDays: 15, category: 'Service' },
  { kind: 'service', name: 'Tyre rotation', everyKm: 10000, everyMonths: null, remindKm: 1000, remindDays: 0, category: 'Tyres' },
  { kind: 'service', name: 'Wheel alignment', everyKm: 10000, everyMonths: null, remindKm: 1000, remindDays: 0, category: 'Tyres' },
  { kind: 'service', name: 'Air filter', everyKm: 15000, everyMonths: null, remindKm: 1000, remindDays: 0, category: 'Service' },
];

/** Expense category to suggest when an item is done or renewed. */
export function categoryFor(item: VehicleItem): string {
  const t = ITEM_TEMPLATES.find((x) => x.name === item.name);
  if (t) return t.category;
  return item.kind === 'paper' ? 'Tax / permit' : 'Service';
}

/** "Every 10,000 km or 6 months", "Renew every 12 months". */
export function scheduleLabel(item: VehicleItem) {
  const fmt = new Intl.NumberFormat('en-IN');
  const parts: string[] = [];
  if (item.everyKm) parts.push(`${fmt.format(item.everyKm)} km`);
  if (item.everyMonths) parts.push(item.everyMonths === 12 ? '1 year' : item.everyMonths % 12 === 0 ? `${item.everyMonths / 12} years` : `${item.everyMonths} months`);
  if (parts.length === 0) return '';
  return item.kind === 'paper' ? `Renew every ${parts.join(' or ')}` : `Every ${parts.join(' or ')}`;
}
