/**
 * Data layer. Today it keeps everything in this device's localStorage.
 * When Supabase is connected, replace the bodies of the `actions` below with
 * Supabase queries (see supabase/schema.sql); the screens only call these.
 */
import { useSyncExternalStore } from 'react';
import type { AppData, CapitalEntry, Partner, PartnerExpense, Settings, Trip } from './types';
import { todayISO } from './format';

const KEY = 'dropship:data:v1'; // internal key; kept so saved data survives the rename

export const APP_NAME = 'Covenant';
const OLD_NAMES = ['Daily Dropship'];

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const defaultPartners = (): Partner[] => [
  { id: 'p1', name: 'Partner 1' },
  { id: 'p2', name: 'Partner 2' },
  { id: 'p3', name: 'Partner 3' },
];

function emptyData(): AppData {
  return {
    partners: defaultPartners(),
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

/** Clearly-labelled sample data so the screens have something to show. */
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

function load(): AppData {
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
  // On a first visit, save the sample right away so its ids stay stable
  // across reloads (otherwise a link to a sample trip breaks after a refresh).
  // Never overwrite stored data that failed to parse.
  if (firstVisit) {
    try {
      localStorage.setItem(KEY, JSON.stringify(sample));
    } catch {
      /* storage full or blocked: sample lives in memory only */
    }
  }
  return sample;
}

let state: AppData = load();
const listeners = new Set<() => void>();

function commit(next: AppData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useData(): AppData {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export type TripInput = Omit<Trip, 'id' | 'createdAt'>;

export const actions = {
  /** Creates or updates a trip and returns its id. */
  saveTrip(input: TripInput, id?: string): string {
    if (id) {
      commit({ ...state, trips: state.trips.map((t) => (t.id === id ? { ...t, ...input } : t)) });
      return id;
    }
    const trip: Trip = { ...input, id: uid(), createdAt: new Date().toISOString() };
    commit({
      ...state,
      trips: [...state.trips, trip],
      settings: input.vehicle ? { ...state.settings, defaultVehicle: input.vehicle } : state.settings,
    });
    return trip.id;
  },
  deleteTrip(id: string) {
    commit({ ...state, trips: state.trips.filter((t) => t.id !== id) });
  },
  saveCapital(input: Omit<CapitalEntry, 'id'>, id?: string) {
    commit({
      ...state,
      capital: id
        ? state.capital.map((c) => (c.id === id ? { ...c, ...input } : c))
        : [...state.capital, { ...input, id: uid() }],
    });
  },
  deleteCapital(id: string) {
    commit({ ...state, capital: state.capital.filter((c) => c.id !== id) });
  },
  saveExpense(input: Omit<PartnerExpense, 'id'>, id?: string) {
    commit({
      ...state,
      expenses: id
        ? state.expenses.map((e) => (e.id === id ? { ...e, ...input } : e))
        : [...state.expenses, { ...input, id: uid() }],
    });
  },
  deleteExpense(id: string) {
    commit({ ...state, expenses: state.expenses.filter((e) => e.id !== id) });
  },
  renamePartner(id: string, name: string) {
    commit({ ...state, partners: state.partners.map((p) => (p.id === id ? { ...p, name } : p)) });
  },
  addPartner(name: string) {
    commit({ ...state, partners: [...state.partners, { id: uid(), name }] });
  },
  updateSettings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } });
  },
  /** Remove sample data and start clean (keeps partner names and settings). */
  startFresh() {
    const e = emptyData();
    commit({ ...e, partners: state.partners, settings: { ...state.settings }, isSample: false });
  },
  loadSample() {
    commit(sampleData());
  },
};
