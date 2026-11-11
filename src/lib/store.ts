/**
 * Data layer. Screens only use useData(), useSync() and `actions`.
 *
 * Demo mode (Supabase not configured): everything lives in this device's localStorage.
 *
 * Cloud mode (Supabase configured): the data lives in Supabase and is shared by all
 * partners. Every change
 *   1. shows on screen at once,
 *   2. is queued on the device (so nothing is lost without signal), and
 *   3. is uploaded in order as soon as there is a connection.
 * Other partners' changes arrive live. The last downloaded copy is kept on the device
 * so the app opens fast and can be read offline; it is removed on sign-out.
 */
import { useSyncExternalStore } from 'react';
import type { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppData, CapitalEntry, Partner, PartnerExpense, Settings, Trip, TripCost, TripCostType, TripPayment } from './types';
import { addDays, todayISO } from './format';

const KEY = 'dropship:data:v1'; // demo-mode key; kept so saved data survives the rename

export const APP_NAME = 'Covenant';
const OLD_NAMES = ['Daily Dropship'];

export const isCloud = supabase !== null;
/**
 * A published build without Supabase settings. Demo mode (any email signs in) is only
 * allowed in local development, so such a build shows a "not set up" screen instead.
 */
export const isMisconfigured = !isCloud && !import.meta.env.DEV;

/** UUID v4. Uses getRandomValues so it also works on plain-http pages (e.g. testing over Wi-Fi). */
function uid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && 'randomUUID' in c && typeof c.randomUUID === 'function' && globalThis.isSecureContext) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}
function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- demo data

const defaultPartners = (): Partner[] => [
  { id: 'p1', name: 'Partner 1' },
  { id: 'p2', name: 'Partner 2' },
  { id: 'p3', name: 'Partner 3' },
];

function emptyData(partners: Partner[] = defaultPartners()): AppData {
  return {
    partners,
    trips: [],
    capital: [],
    expenses: [],
    settings: { businessName: APP_NAME, defaultVehicle: '' },
    isSample: false,
  };
}

function daysAgo(n: number) {
  const d = new Date(todayISO() + 'T00:00:00');
  d.setDate(d.getDate() - n);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/**
 * Brings a trip saved by an older version of the app (fuel / toll / parking / other /
 * received fields) into the current shape, and fills any missing fields.
 */
export function normalizeTrip(raw: unknown): Trip {
  const t = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const numOr0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const date = str(t.date) || todayISO();
  const legacy = !Array.isArray(t.costs) && ('fuel' in t || 'received' in t);
  let costs: TripCost[] = Array.isArray(t.costs) ? (t.costs as TripCost[]) : [];
  let payments: TripPayment[] = Array.isArray(t.payments) ? (t.payments as TripPayment[]) : [];
  let fare = numOr0(t.fare);
  if (legacy) {
    const old: [TripCostType, unknown][] = [['Fuel', t.fuel], ['Toll', t.toll], ['Parking', t.parking], ['Other', t.other]];
    costs = old.filter(([, a]) => numOr0(a) > 0).map(([type, a]) => ({ date, type, amount: numOr0(a) }));
    const received = numOr0(t.received);
    fare = received;
    payments = received > 0 ? [{ date, kind: 'balance', amount: received }] : [];
  }
  return {
    id: str(t.id) || uid(),
    date,
    endDate: t.endDate === null ? null : str(t.endDate) || (legacy ? date : date),
    vehicle: str(t.vehicle),
    from: str(t.from),
    to: str(t.to),
    startKm: t.startKm === null || t.startKm === undefined ? null : numOr0(t.startKm),
    endKm: t.endKm === null || t.endKm === undefined ? null : numOr0(t.endKm),
    km: numOr0(t.km),
    customerName: str(t.customerName),
    customerPhone: str(t.customerPhone),
    fare,
    payments: payments.filter((p) => p && numOr0(p.amount) > 0).map((p) => ({ date: str(p.date) || date, kind: p.kind === 'advance' ? 'advance' : 'balance', amount: numOr0(p.amount) })),
    costs: costs.filter((c) => c && numOr0(c.amount) > 0).map((c) => ({ date: str(c.date) || date, type: c.type, amount: numOr0(c.amount) })),
    notes: str(t.notes),
    createdAt: str(t.createdAt) || new Date().toISOString(),
  };
}

const normalizeData = (d: AppData): AppData => ({ ...d, trips: (d.trips ?? []).map(normalizeTrip) });

/** Clearly-labelled sample data so the screens have something to show (demo mode only). */
function sampleData(): AppData {
  const base = emptyData();
  const v = 'KL 07 AB 1234';
  let odo = 48210;
  let n = 0;
  const trip = (
    ago: number,
    from: string,
    to: string,
    km: number,
    o: { days?: number | null; fare: number; customer?: [string, string]; advance?: [number, number]; paid?: number; costs?: [number, TripCostType, number][]; notes?: string },
  ): Trip => {
    const date = daysAgo(ago);
    const started = ago >= 0;
    const endDate = o.days === null ? null : daysAgo(ago - (o.days ?? 1) + 1);
    const startKm = started ? odo : null;
    if (started) odo += km + 6;
    const payments: TripPayment[] = [];
    if (o.advance) payments.push({ date: daysAgo(o.advance[1]), kind: 'advance', amount: o.advance[0] });
    if (o.paid) payments.push({ date: endDate ?? date, kind: 'balance', amount: o.paid });
    return {
      id: uid(),
      date,
      endDate,
      vehicle: v,
      from,
      to,
      startKm,
      endKm: started && o.days !== null ? (startKm ?? 0) + km : null,
      km: started ? km : 0,
      customerName: o.customer?.[0] ?? '',
      customerPhone: o.customer?.[1] ?? '',
      fare: o.fare,
      payments,
      costs: (o.costs ?? []).map(([dayIndex, type, amount]) => ({ date: addDays(date, dayIndex), type, amount })),
      notes: o.notes ?? '',
      createdAt: new Date(Date.now() - ago * 86400000 - ++n * 3600000).toISOString(),
    };
  };
  base.trips = [
    trip(18, 'Ernakulam', 'Kollam', 140, { fare: 3600, paid: 3600, costs: [[0, 'Fuel', 1800], [0, 'Toll', 135], [0, 'Parking', 40]] }),
    trip(15, 'Aluva', 'Kochi Airport', 18, { fare: 800, paid: 800, costs: [[0, 'Fuel', 260], [0, 'Parking', 120]] }),
    trip(12, 'Kochi', 'Vagamon', 102, { fare: 3100, paid: 3100, costs: [[0, 'Fuel', 1350], [0, 'Parking', 40]] }),
    trip(10, 'Ernakulam', 'Munnar', 410, {
      days: 3,
      fare: 14500,
      customer: ['Rajesh Menon', '+91 98470 12345'],
      advance: [4000, 16],
      paid: 6500,
      costs: [[0, 'Fuel', 2400], [0, 'Toll', 135], [0, 'Driver bata', 600], [1, 'Stay', 1200], [1, 'Food', 450], [1, 'Driver bata', 600], [2, 'Fuel', 2100], [2, 'Driver bata', 600]],
      notes: 'Sample: family tour, Munnar and Thekkady',
    }),
    trip(7, 'Kochi Airport', 'Kozhikode', 190, { fare: 3900, paid: 3900, costs: [[0, 'Fuel', 2500], [0, 'Toll', 270], [0, 'Parking', 50]], notes: 'Rain, slow traffic' }),
    trip(5, 'Thekkady', 'Ernakulam', 158, { fare: 2000, paid: 2000, costs: [[0, 'Fuel', 2050], [0, 'Parking', 100]], notes: 'Return empty, part fare' }),
    trip(4, 'Ernakulam', 'Thekkady', 160, { fare: 5200, customer: ['Anitha', '+91 94460 55120'], advance: [1500, 6], paid: 1700, costs: [[0, 'Fuel', 2100], [0, 'Parking', 100], [0, 'Other', 200]] }),
    trip(3, 'Kochi', 'Kumarakom', 55, { fare: 1500, paid: 1500, costs: [[0, 'Fuel', 700]] }),
    trip(2, 'Aluva', 'Alappuzha', 64, { fare: 1900, paid: 1900, costs: [[0, 'Fuel', 820], [0, 'Parking', 30]] }),
    trip(1, 'Kochi', 'Kanyakumari', 300, {
      days: null,
      fare: 0,
      customer: ['Suresh Kumar', '+91 90370 44781'],
      advance: [5000, 3],
      costs: [[0, 'Fuel', 2600], [0, 'Toll', 270], [0, 'Driver bata', 600], [1, 'Stay', 1400], [1, 'Food', 380]],
      notes: 'Sample: end date not known yet',
    }),
    trip(0, 'Kochi Airport', 'Munnar', 112, { fare: 4200, paid: 4200, costs: [[0, 'Fuel', 1450], [0, 'Parking', 60]] }),
    trip(0, 'Ernakulam', 'Thrissur', 78, { fare: 2600, paid: 2600, costs: [[0, 'Fuel', 980], [0, 'Toll', 135], [0, 'Parking', 40]] }),
    trip(-3, 'Kochi', 'Wayanad', 0, { days: 2, fare: 9000, customer: ['Fathima', '+91 81290 33456'], advance: [2000, 1], notes: 'Sample: upcoming booking' }),
    trip(-6, 'Kochi Airport', 'Varkala', 0, { fare: 3400, customer: ['Arjun', '+91 70250 11893'], advance: [1000, 0] }),
  ];
  base.capital = [
    { id: uid(), partnerId: 'p1', date: daysAgo(40), amount: 120000, note: 'Sample: initial capital' },
    { id: uid(), partnerId: 'p2', date: daysAgo(40), amount: 100000, note: 'Sample: initial capital' },
    { id: uid(), partnerId: 'p3', date: daysAgo(40), amount: 80000, note: 'Sample: initial capital' },
    { id: uid(), partnerId: 'p3', date: daysAgo(10), amount: 20000, note: 'Sample: added capital' },
  ];
  base.expenses = [
    { id: uid(), partnerId: 'p1', date: daysAgo(6), amount: 4800, category: 'Maintenance', description: 'Sample: oil change and filter' },
    { id: uid(), partnerId: 'p2', date: daysAgo(14), amount: 7600, category: 'Tyres', description: 'Sample: two front tyres' },
    { id: uid(), partnerId: 'p3', date: daysAgo(2), amount: 1200, category: 'Repair', description: 'Sample: wiper and bulb' },
  ];
  base.settings.defaultVehicle = v;
  base.isSample = true;
  return base;
}

function loadLocal(): AppData {
  let firstVisit = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>;
      const e = emptyData();
      const settings = { ...e.settings, ...parsed.settings };
      // Devices that saved the old placeholder name pick up the new one.
      if (OLD_NAMES.includes(settings.businessName)) settings.businessName = APP_NAME;
      return normalizeData({ ...e, ...parsed, settings });
    }
    firstVisit = true;
  } catch {
    /* storage blocked or corrupt: fall through to sample data */
  }
  const sample = sampleData();
  // On a first visit, save the sample right away so its ids stay stable across reloads.
  // Never overwrite stored data that failed to parse.
  if (firstVisit) writeJSON(KEY, sample);
  return sample;
}

// ---------------------------------------------------------------- changes

/** One change to the data. Applied on screen at once; in cloud mode also queued for upload. */
type Change =
  | { type: 'trip.save'; trip: Trip; isNew: boolean }
  | { type: 'trip.delete'; id: string }
  | { type: 'capital.save'; entry: CapitalEntry; isNew: boolean }
  | { type: 'capital.delete'; id: string }
  | { type: 'expense.save'; entry: PartnerExpense; isNew: boolean }
  | { type: 'expense.delete'; id: string }
  | { type: 'partner.save'; partner: Partner; isNew: boolean }
  | { type: 'settings'; patch: Partial<Settings> };

const upsertById = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

function apply(s: AppData, c: Change): AppData {
  switch (c.type) {
    case 'trip.save':
      return c.isNew || s.trips.some((t) => t.id === c.trip.id) ? { ...s, trips: upsertById(s.trips, c.trip) } : s;
    case 'trip.delete':
      return { ...s, trips: s.trips.filter((t) => t.id !== c.id) };
    case 'capital.save':
      return c.isNew || s.capital.some((x) => x.id === c.entry.id) ? { ...s, capital: upsertById(s.capital, c.entry) } : s;
    case 'capital.delete':
      return { ...s, capital: s.capital.filter((x) => x.id !== c.id) };
    case 'expense.save':
      return c.isNew || s.expenses.some((x) => x.id === c.entry.id) ? { ...s, expenses: upsertById(s.expenses, c.entry) } : s;
    case 'expense.delete':
      return { ...s, expenses: s.expenses.filter((x) => x.id !== c.id) };
    case 'partner.save':
      return { ...s, partners: upsertById(s.partners, c.partner) };
    case 'settings':
      return { ...s, settings: { ...s.settings, ...c.patch } };
  }
}

const LABEL: Record<Change['type'], string> = {
  'trip.save': 'Trip',
  'trip.delete': 'Trip delete',
  'capital.save': 'Capital entry',
  'capital.delete': 'Capital delete',
  'expense.save': 'Expense',
  'expense.delete': 'Expense delete',
  'partner.save': 'Partner name',
  settings: 'Setting',
};

// ---------------------------------------------------------------- store + sync status

export interface Sync {
  mode: 'local' | 'cloud';
  /** signed-out → loading → ready; or not-approved / failed. Always 'ready' in local mode. */
  phase: 'signed-out' | 'loading' | 'ready' | 'not-approved' | 'failed';
  /** Changes saved on this device and not yet uploaded. */
  pending: number;
  /** The last attempt to reach Supabase failed because of the connection. */
  offline: boolean;
  /** A change Supabase refused, or a load error, to show the user. */
  message: string | null;
  /** This login may manage other logins (cloud mode). Only hides/shows UI; the server enforces it. */
  isAdmin: boolean;
}

let state: AppData = isCloud ? emptyData([]) : loadLocal();
let sync: Sync = isCloud
  ? { mode: 'cloud', phase: 'signed-out', pending: 0, offline: false, message: null, isAdmin: false }
  : { mode: 'local', phase: 'ready', pending: 0, offline: false, message: null, isAdmin: false };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
function setSync(patch: Partial<Sync>) {
  sync = { ...sync, ...patch };
  emit();
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export function useSync(): Sync {
  return useSyncExternalStore(subscribe, () => sync, () => sync);
}

function dispatch(c: Change) {
  state = apply(state, c);
  if (!isCloud) {
    writeJSON(KEY, state);
    emit();
    return;
  }
  outbox.push(c);
  saveOutbox();
  setSync({ pending: outbox.length });
  void flush();
}

// ---------------------------------------------------------------- cloud: row mapping

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const nOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const s = (v: unknown) => (typeof v === 'string' ? v : '');

export const tripFromRow = (r: Row): Trip =>
  normalizeTrip({
    id: s(r.id),
    date: s(r.trip_date),
    endDate: r.end_date === null ? null : s(r.end_date),
    vehicle: s(r.vehicle),
    from: s(r.from_place),
    to: s(r.to_place),
    startKm: nOrNull(r.start_km),
    endKm: nOrNull(r.end_km),
    km: n(r.km),
    customerName: s(r.customer_name),
    customerPhone: s(r.customer_phone),
    fare: n(r.fare),
    payments: Array.isArray(r.payments) ? r.payments : [],
    costs: Array.isArray(r.costs) ? r.costs : [],
    notes: s(r.notes),
    createdAt: s(r.created_at),
  });
export const tripToRow = (t: Trip) => ({
  id: t.id,
  trip_date: t.date,
  end_date: t.endDate,
  vehicle: t.vehicle,
  from_place: t.from,
  to_place: t.to,
  start_km: t.startKm,
  end_km: t.endKm,
  km: t.km,
  customer_name: t.customerName,
  customer_phone: t.customerPhone,
  fare: t.fare,
  payments: t.payments.map((p) => ({ date: p.date, kind: p.kind, amount: p.amount })),
  costs: t.costs.map((c) => ({ date: c.date, type: c.type, amount: c.amount })),
  notes: t.notes,
});
const capitalFromRow = (r: Row): CapitalEntry => ({
  id: s(r.id),
  partnerId: s(r.partner_id),
  date: s(r.entry_date),
  amount: n(r.amount),
  note: s(r.note),
});
const capitalToRow = (c: CapitalEntry) => ({ id: c.id, partner_id: c.partnerId, entry_date: c.date, amount: c.amount, note: c.note });
const expenseFromRow = (r: Row): PartnerExpense => ({
  id: s(r.id),
  partnerId: s(r.partner_id),
  date: s(r.expense_date),
  amount: n(r.amount),
  category: s(r.category),
  description: s(r.description),
});
const expenseToRow = (e: PartnerExpense) => ({
  id: e.id,
  partner_id: e.partnerId,
  expense_date: e.date,
  amount: e.amount,
  category: e.category,
  description: e.description,
});
const settingsToRow = (p: Partial<Settings>) => ({
  ...(p.businessName !== undefined ? { business_name: p.businessName } : {}),
  ...(p.defaultVehicle !== undefined ? { default_vehicle: p.defaultVehicle } : {}),
});

// ---------------------------------------------------------------- cloud: upload queue

type SendResult = 'ok' | 'retry' | { error: string };

function describe(err: PostgrestError): string {
  switch (err.code) {
    case '23514':
      return 'a value is outside what the app allows';
    case '23503':
      return 'that partner no longer exists';
    case '42501':
      return 'this login is not allowed to change data';
    default:
      return err.message || 'the server refused it';
  }
}

function result(r: { error: PostgrestError | null; status: number }, insert = false): SendResult {
  if (!r.error) return 'ok';
  if (insert && r.error.code === '23505') return 'ok'; // already uploaded (the reply was lost)
  if (r.status === 0 || r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500) return 'retry';
  return { error: describe(r.error) };
}

async function send(c: Change): Promise<SendResult> {
  const db = supabase!;
  try {
    switch (c.type) {
      case 'trip.save':
        return c.isNew
          ? result(await db.from('trips').insert(tripToRow(c.trip)), true)
          : result(await db.from('trips').update(tripToRow(c.trip)).eq('id', c.trip.id));
      case 'trip.delete':
        return result(await db.from('trips').delete().eq('id', c.id));
      case 'capital.save':
        return c.isNew
          ? result(await db.from('capital_entries').insert(capitalToRow(c.entry)), true)
          : result(await db.from('capital_entries').update(capitalToRow(c.entry)).eq('id', c.entry.id));
      case 'capital.delete':
        return result(await db.from('capital_entries').delete().eq('id', c.id));
      case 'expense.save':
        return c.isNew
          ? result(await db.from('partner_expenses').insert(expenseToRow(c.entry)), true)
          : result(await db.from('partner_expenses').update(expenseToRow(c.entry)).eq('id', c.entry.id));
      case 'expense.delete':
        return result(await db.from('partner_expenses').delete().eq('id', c.id));
      case 'partner.save': {
        const row = { id: c.partner.id, name: c.partner.name, position: c.partner.position ?? 0 };
        return c.isNew
          ? result(await db.from('partners').insert(row), true)
          : result(await db.from('partners').update({ name: row.name }).eq('id', row.id));
      }
      case 'settings':
        return result(await db.from('app_settings').update(settingsToRow(c.patch)).eq('id', 1));
    }
  } catch {
    return 'retry'; // network failure thrown instead of returned
  }
}

let userId: string | null = null;
let wantedUser: string | null = null;
let outbox: Change[] = [];
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 5000;
let channel: RealtimeChannel | null = null;

const outboxKey = (id: string) => `covenant:outbox:${id}`;
const cacheKey = (id: string) => `covenant:cache:${id}`;
const saveOutbox = () => userId && writeJSON(outboxKey(userId), outbox);

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void flush(), retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60000);
}

async function flush() {
  if (!supabase || !userId || flushing || outbox.length === 0) return;
  flushing = true;
  const id = userId;
  try {
    while (outbox.length > 0 && userId === id) {
      const c = outbox[0];
      const r = await send(c);
      if (userId !== id) return;
      if (r === 'retry') {
        setSync({ offline: true });
        scheduleRetry();
        return;
      }
      if (r !== 'ok') setSync({ message: `${LABEL[c.type]} not saved: ${r.error}.` });
      outbox.shift();
      saveOutbox();
      setSync({ pending: outbox.length, offline: false });
    }
    retryDelay = 5000;
  } finally {
    flushing = false;
    scheduleRefresh();
  }
}

// ---------------------------------------------------------------- cloud: download

const PAGE = 1000; // Supabase returns at most 1000 rows per request

async function fetchAll(table: string, order: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error, status } = await supabase!.from(table).select('*').order(order).range(from, from + PAGE - 1);
    if (error) throw Object.assign(new Error(error.message), { status });
    rows.push(...(data as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRefresh(delay = 400) {
  if (!userId) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void refresh(), delay);
}

let refreshing = false;
async function refresh() {
  if (!supabase || !userId) return;
  if (refreshing || flushing) return scheduleRefresh(800);
  refreshing = true;
  const id = userId;
  try {
    const [partners, trips, capital, expenses, settingsRes] = await Promise.all([
      fetchAll('partners', 'position'),
      fetchAll('trips', 'created_at'),
      fetchAll('capital_entries', 'created_at'),
      fetchAll('partner_expenses', 'created_at'),
      supabase.from('app_settings').select('business_name, default_vehicle').eq('id', 1).maybeSingle(),
    ]);
    if (settingsRes.error) throw Object.assign(new Error(settingsRes.error.message), { status: settingsRes.status });
    if (userId !== id) return;
    const row = settingsRes.data as Row | null;
    const fresh: AppData = {
      partners: partners.map((r) => ({ id: s(r.id), name: s(r.name), position: n(r.position) })),
      trips: trips.map(tripFromRow),
      capital: capital.map(capitalFromRow),
      expenses: expenses.map(expenseFromRow),
      settings: { businessName: s(row?.business_name) || APP_NAME, defaultVehicle: s(row?.default_vehicle) },
      isSample: false,
    };
    writeJSON(cacheKey(id), fresh);
    state = outbox.reduce(apply, fresh); // keep changes that are still waiting to upload
    sync = { ...sync, phase: 'ready', offline: false };
    emit();
  } catch (e) {
    if (userId !== id) return;
    const status = (e as { status?: number }).status ?? 0;
    const network = status === 0 || status >= 500 || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (sync.phase === 'ready') setSync({ offline: network, message: network ? null : `Couldn’t load the latest data: ${(e as Error).message}` });
    else setSync({ phase: 'failed', offline: network, message: network ? 'No internet connection.' : (e as Error).message });
  } finally {
    refreshing = false;
  }
}

// ---------------------------------------------------------------- cloud: session

async function start(id: string) {
  const db = supabase!;
  userId = id;
  // Saved by an older version of the app? Bring trips into the current shape first.
  outbox = readJSON<Change[]>(outboxKey(id), []).map((c) => (c.type === 'trip.save' ? { ...c, trip: normalizeTrip(c.trip) } : c));
  const storedCache = readJSON<AppData | null>(cacheKey(id), null);
  const cached = storedCache ? normalizeData(storedCache) : null;
  state = outbox.reduce(apply, cached ?? emptyData([]));
  sync = { mode: 'cloud', phase: cached ? 'ready' : 'loading', pending: outbox.length, offline: false, message: null, isAdmin: false };
  emit();

  // Only approved partner logins get data (see app_members in supabase/schema.sql).
  const { data, error, status } = await db.from('app_members').select('user_id, role').eq('user_id', id).maybeSingle();
  if (userId !== id) return;
  if (error) {
    const network = status === 0 || status >= 500;
    if (!cached) setSync({ phase: 'failed', offline: network, message: network ? 'No internet connection.' : error.message });
    else setSync({ offline: network });
  } else if (!data) {
    removeKey(cacheKey(id));
    state = emptyData([]);
    setSync({ phase: 'not-approved' });
    return;
  } else {
    setSync({ isAdmin: (data as { role?: string }).role === 'admin' });
  }

  channel = db
    .channel('covenant-data')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => scheduleRefresh())
    .subscribe();
  await refresh();
  void flush();
}

function stop(previous: string | null) {
  clearTimeout(retryTimer);
  clearTimeout(refreshTimer);
  if (channel) void supabase?.removeChannel(channel);
  channel = null;
  // Remove the downloaded copy from this device. Changes not yet uploaded stay queued
  // for this login and upload the next time it signs in here.
  if (previous) removeKey(cacheKey(previous));
  userId = null;
  outbox = [];
  state = emptyData([]);
  sync = { mode: 'cloud', phase: 'signed-out', pending: 0, offline: false, message: null, isAdmin: false };
  emit();
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    if (id === wantedUser) return;
    const previous = wantedUser;
    wantedUser = id;
    // Run outside the auth callback (Supabase advises against awaiting inside it).
    setTimeout(() => {
      if (wantedUser !== id) return;
      stop(previous);
      if (id) void start(id);
    }, 0);
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      retryDelay = 5000;
      void flush();
      scheduleRefresh(0);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void flush();
        scheduleRefresh(0);
      }
    });
  }
}

// ---------------------------------------------------------------- actions

export type TripInput = Omit<Trip, 'id' | 'createdAt'>;

export const actions = {
  /** Creates or updates a trip and returns its id. */
  saveTrip(input: TripInput, id?: string): string {
    const existing = id ? state.trips.find((t) => t.id === id) : undefined;
    const trip: Trip = existing
      ? { ...existing, ...input }
      : { ...input, id: id ?? uid(), createdAt: new Date().toISOString() };
    dispatch({ type: 'trip.save', trip, isNew: !id });
    if (!id && input.vehicle && input.vehicle !== state.settings.defaultVehicle) {
      dispatch({ type: 'settings', patch: { defaultVehicle: input.vehicle } });
    }
    return trip.id;
  },
  deleteTrip(id: string) {
    dispatch({ type: 'trip.delete', id });
  },
  /** Records money received after the trip (e.g. "Mark as paid" on a due). */
  recordPayment(tripId: string, amount: number, date = todayISO()) {
    const t = state.trips.find((x) => x.id === tripId);
    if (!t || !(amount > 0)) return;
    dispatch({ type: 'trip.save', trip: { ...t, payments: [...t.payments, { date, kind: 'balance', amount }] }, isNew: false });
  },
  /** Ends a trip whose end date wasn't known. */
  finishTrip(tripId: string, endDate = todayISO()) {
    const t = state.trips.find((x) => x.id === tripId);
    if (!t) return;
    dispatch({ type: 'trip.save', trip: { ...t, endDate: endDate < t.date ? t.date : endDate }, isNew: false });
  },
  saveCapital(input: Omit<CapitalEntry, 'id'>, id?: string) {
    dispatch({ type: 'capital.save', entry: { ...input, id: id ?? uid() }, isNew: !id });
  },
  deleteCapital(id: string) {
    dispatch({ type: 'capital.delete', id });
  },
  saveExpense(input: Omit<PartnerExpense, 'id'>, id?: string) {
    dispatch({ type: 'expense.save', entry: { ...input, id: id ?? uid() }, isNew: !id });
  },
  deleteExpense(id: string) {
    dispatch({ type: 'expense.delete', id });
  },
  renamePartner(id: string, name: string) {
    const p = state.partners.find((x) => x.id === id);
    if (p) dispatch({ type: 'partner.save', partner: { ...p, name }, isNew: false });
  },
  addPartner(name: string) {
    const position = state.partners.reduce((m, p) => Math.max(m, p.position ?? 0), 0) + 1;
    dispatch({ type: 'partner.save', partner: { id: uid(), name, position }, isNew: true });
  },
  updateSettings(patch: Partial<Settings>) {
    dispatch({ type: 'settings', patch });
  },
  /** Demo mode only: remove sample data and start clean (keeps partner names and settings). */
  startFresh() {
    if (isCloud) return;
    state = { ...emptyData(state.partners), settings: { ...state.settings } };
    writeJSON(KEY, state);
    emit();
  },
  /** Demo mode only. */
  loadSample() {
    if (isCloud) return;
    state = sampleData();
    writeJSON(KEY, state);
    emit();
  },
  /** Cloud mode: start over for this login (e.g. after "No internet connection"). */
  retry() {
    const id = userId;
    if (!id) return;
    clearTimeout(retryTimer);
    clearTimeout(refreshTimer);
    if (channel) void supabase?.removeChannel(channel);
    channel = null;
    retryDelay = 5000;
    void start(id);
  },
  dismissMessage() {
    setSync({ message: null });
  },
};
