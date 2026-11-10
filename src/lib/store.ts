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
import type { AppData, CapitalEntry, Partner, PartnerExpense, Settings, Trip } from './types';
import { todayISO } from './format';

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

type SampleRow = [number, string, string, number, number, number, number, number, number, string?];

/** Clearly-labelled sample data so the screens have something to show (demo mode only). */
function sampleData(): AppData {
  const base = emptyData();
  const v = 'KL 07 AB 1234';
  // daysAgo, from, to, km, fuel, toll, parking, other, received, notes
  const rows: SampleRow[] = [
    [0, 'Kochi Airport', 'Munnar', 112, 1450, 0, 60, 0, 4200],
    [0, 'Munnar', 'Kochi Airport', 110, 0, 0, 0, 150, 3800, 'Driver food'],
    [1, 'Ernakulam', 'Thrissur', 78, 980, 135, 40, 0, 2600],
    [2, 'Aluva', 'Alappuzha', 64, 820, 0, 30, 0, 1900],
    [3, 'Kochi', 'Kumarakom', 55, 700, 0, 0, 0, 1500],
    [4, 'Ernakulam', 'Thekkady', 160, 2100, 0, 100, 200, 5200],
    [5, 'Thekkady', 'Ernakulam', 158, 2050, 0, 0, 0, 2000, 'Return empty, part fare'],
    [7, 'Kochi Airport', 'Kozhikode', 190, 2500, 270, 50, 0, 3900, 'Rain, slow traffic'],
    [9, 'Ernakulam', 'Guruvayur', 82, 1050, 135, 60, 0, 2800],
    [12, 'Kochi', 'Vagamon', 102, 1350, 0, 40, 0, 3100],
    [15, 'Aluva', 'Kochi Airport', 18, 260, 0, 120, 0, 800],
    [18, 'Ernakulam', 'Kollam', 140, 1800, 135, 40, 0, 3600],
  ];
  let odo = 48210;
  base.trips = rows
    .slice()
    .reverse()
    .map(([ago, from, to, km, fuel, toll, parking, other, received, notes], i) => {
      const startKm = odo;
      odo += km + 6;
      return {
        id: uid(),
        date: daysAgo(ago),
        vehicle: v,
        from,
        to,
        startKm,
        endKm: startKm + km,
        km,
        fuel,
        toll,
        parking,
        other,
        received,
        notes: notes ?? '',
        createdAt: new Date(Date.now() - ago * 86400000 - (rows.length - i) * 3600000).toISOString(),
      };
    });
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
      return { ...e, ...parsed, settings };
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

const tripFromRow = (r: Row): Trip => ({
  id: s(r.id),
  date: s(r.trip_date),
  vehicle: s(r.vehicle),
  from: s(r.from_place),
  to: s(r.to_place),
  startKm: nOrNull(r.start_km),
  endKm: nOrNull(r.end_km),
  km: n(r.km),
  fuel: n(r.fuel),
  toll: n(r.toll),
  parking: n(r.parking),
  other: n(r.other_expense),
  received: n(r.received),
  notes: s(r.notes),
  createdAt: s(r.created_at),
});
const tripToRow = (t: Trip) => ({
  id: t.id,
  trip_date: t.date,
  vehicle: t.vehicle,
  from_place: t.from,
  to_place: t.to,
  start_km: t.startKm,
  end_km: t.endKm,
  km: t.km,
  fuel: t.fuel,
  toll: t.toll,
  parking: t.parking,
  other_expense: t.other,
  received: t.received,
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
  outbox = readJSON<Change[]>(outboxKey(id), []);
  const cached = readJSON<AppData | null>(cacheKey(id), null);
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
