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

export interface PartnerExpense {
  id: string;
  partnerId: string;
  date: string;
  amount: number;
  category: string;
  description: string;
}

export interface Settings {
  businessName: string;
  defaultVehicle: string;
}

export interface AppData {
  partners: Partner[];
  trips: Trip[];
  capital: CapitalEntry[];
  expenses: PartnerExpense[];
  settings: Settings;
  isSample: boolean;
}

export const EXPENSE_CATEGORIES = [
  'Maintenance',
  'Repair',
  'Tyres',
  'Insurance',
  'Tax / permit',
  'Other',
] as const;
