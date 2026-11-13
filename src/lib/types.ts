export interface Partner {
  id: string;
  name: string;
  /** Display order (cloud mode). */
  position?: number;
}

/** Kinds of trip expense, entered per day of the trip. */
export const TRIP_COST_TYPES = ['Fuel', 'Toll', 'Parking', 'Driver bata', 'Food', 'Stay', 'Other'] as const;
export type TripCostType = (typeof TRIP_COST_TYPES)[number];

export interface TripCost {
  date: string; // YYYY-MM-DD, the day of the trip it belongs to
  type: TripCostType;
  amount: number;
}

export interface TripPayment {
  date: string; // YYYY-MM-DD
  /** 'advance' = paid before the trip; 'balance' = paid after (can be several part-payments). */
  kind: 'advance' | 'balance';
  amount: number;
}

export interface Trip {
  id: string;
  /** Start date (YYYY-MM-DD). Totals count a trip under this date. */
  date: string;
  /** Last day of the trip. Same as `date` for a one-day trip; null while the end isn't known. */
  endDate: string | null;
  vehicle: string;
  from: string;
  to: string;
  startKm: number | null;
  endKm: number | null;
  km: number;
  customerName: string;
  customerPhone: string;
  /** Agreed total for the trip, including any advance. */
  fare: number;
  payments: TripPayment[];
  costs: TripCost[];
  notes: string;
  createdAt: string;
}

export interface CapitalEntry {
  id: string;
  partnerId: string;
  date: string;
  amount: number;
  note: string;
}

/** A company cost outside trips (service, repairs, insurance, salary…). */
export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  /** The vehicle it was for, if any. */
  vehicleId: string | null;
  /** The reminder it completed (e.g. "Oil change"), if any. */
  itemId: string | null;
  /** Odometer when it was done (service). */
  odometerKm: number | null;
}

export interface Vehicle {
  id: string;
  /** Registration number, e.g. "KL 39 Y 0770". */
  number: string;
  /** Model or nickname. */
  name: string;
  /** Last odometer reading typed in by hand (trips also update the reading). */
  odometerKm: number | null;
  odometerDate: string | null;
  position: number;
}

/**
 * Something a vehicle needs regularly.
 * - service: every N km and/or every N months, counted from when it was last done.
 * - paper: a certificate valid until a date (insurance, pollution test, tax, permit, fitness).
 */
export interface VehicleItem {
  id: string;
  vehicleId: string;
  kind: 'service' | 'paper';
  name: string;
  everyKm: number | null;
  everyMonths: number | null;
  lastKm: number | null;
  lastDate: string | null;
  dueDate: string | null;
  remindKm: number;
  remindDays: number;
  position: number;
}

export interface Settings {
  businessName: string;
  defaultVehicle: string;
}

export interface AppData {
  partners: Partner[];
  trips: Trip[];
  capital: CapitalEntry[];
  expenses: Expense[];
  vehicles: Vehicle[];
  vehicleItems: VehicleItem[];
  settings: Settings;
  isSample: boolean;
}

/** Company expense categories, most used first. ('Maintenance' is kept for older entries.) */
export const EXPENSE_CATEGORIES = [
  'Service',
  'Repair',
  'Tyres',
  'Fuel',
  'Insurance',
  'Pollution test',
  'Tax / permit',
  'Driver salary',
  'Loan / EMI',
  'Cleaning',
  'Other',
] as const;
