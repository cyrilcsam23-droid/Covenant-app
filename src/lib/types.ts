export interface Partner {
  id: string;
  name: string;
}

export interface Trip {
  id: string;
  date: string; // YYYY-MM-DD
  vehicle: string;
  from: string;
  to: string;
  startKm: number | null;
  endKm: number | null;
  km: number;
  fuel: number;
  toll: number;
  parking: number;
  other: number;
  received: number;
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
