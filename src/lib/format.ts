const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export const money = (n: number) => inr.format(Math.round(n || 0));
export const num = (n: number) => plain.format(n || 0);

/** Signed money, e.g. "+₹1,200" / "−₹300" */
export const signedMoney = (n: number) =>
  (n > 0 ? '+' : n < 0 ? '−' : '') + inr.format(Math.abs(Math.round(n || 0)));

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function parseISO(iso: string) {
  return new Date(iso + 'T00:00:00');
}

export const fmtDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const fmtDay = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtMonth = (ym: string) =>
  parseISO(ym + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const monthOf = (iso: string) => iso.slice(0, 7);

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse a user-typed number ("1,200", "", "12.5") into a number. */
export function toNum(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[,\s₹]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
