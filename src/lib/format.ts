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

/** ISO date `n` days after `iso` (negative goes back). */
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO date `n` months after `iso`, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Whole days from `a` to `b` (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

/** "12 Nov", or "12–15 Nov", "30 Nov – 2 Dec", "From 12 Nov" when the end isn't known. */
export function fmtRange(start: string, end: string | null): string {
  const short = (iso: string) => parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (end === null) return `From ${short(start)}`;
  if (end === start) return short(start);
  const a = parseISO(start);
  const b = parseISO(end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()}–${short(end)}`;
  return `${short(start)} – ${short(end)}`;
}

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
