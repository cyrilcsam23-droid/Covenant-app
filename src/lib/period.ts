import { addDays, fmtDay, fmtMonth, monthOf, parseISO, shiftMonth, todayISO } from './format';

/** A stretch of time that totals are filtered to. Dates are YYYY-MM-DD, months YYYY-MM, years YYYY. */
export type Period =
  | { kind: 'all' }
  | { kind: 'day'; date: string }
  | { kind: 'month'; month: string }
  | { kind: 'year'; year: string }
  | { kind: 'range'; from: string; to: string };

export type PeriodKind = Period['kind'];

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR = /^(19|20|21)\d{2}$/;

export function inPeriod(date: string, p: Period) {
  switch (p.kind) {
    case 'all':
      return true;
    case 'day':
      return date === p.date;
    case 'month':
      return date.startsWith(p.month);
    case 'year':
      return date.startsWith(p.year);
    case 'range':
      return date >= p.from && date <= p.to;
  }
}

/** The period of `kind` that contains `around` (today by default), so switching kinds keeps your place. */
export function periodOfKind(kind: PeriodKind, current: Period, today = todayISO()): Period {
  const anchor = anchorOf(current, today);
  switch (kind) {
    case 'all':
      return { kind: 'all' };
    case 'day':
      return { kind: 'day', date: anchor };
    case 'month':
      return { kind: 'month', month: monthOf(anchor) };
    case 'year':
      return { kind: 'year', year: anchor.slice(0, 4) };
    case 'range':
      if (current.kind === 'range') return current;
      if (current.kind === 'month') return { kind: 'range', from: `${current.month}-01`, to: lastDayOf(current.month) };
      if (current.kind === 'year') return { kind: 'range', from: `${current.year}-01-01`, to: `${current.year}-12-31` };
      return { kind: 'range', from: `${monthOf(anchor)}-01`, to: anchor };
  }
}

/** A day inside the period, used to keep your place when switching between Day, Month and Year. */
function anchorOf(p: Period, today: string): string {
  switch (p.kind) {
    case 'day':
      return p.date;
    case 'month':
      return monthOf(today) === p.month ? today : `${p.month}-01`;
    case 'year':
      return today.startsWith(p.year) ? today : `${p.year}-01-01`;
    case 'range':
      return p.to;
    default:
      return today;
  }
}

export const lastDayOf = (month: string) => addDays(`${shiftMonth(month, 1)}-01`, -1);

/** Step one day, month or year back (−1) or forward (+1). Ranges and All don't step. */
export function shiftPeriod(p: Period, delta: number): Period {
  if (p.kind === 'day') return { kind: 'day', date: addDays(p.date, delta) };
  if (p.kind === 'month') return { kind: 'month', month: shiftMonth(p.month, delta) };
  if (p.kind === 'year') return { kind: 'year', year: String(Number(p.year) + delta) };
  return p;
}

/** True when the period is the current day, month or year. */
export function isCurrent(p: Period, today = todayISO()) {
  if (p.kind === 'day') return p.date === today;
  if (p.kind === 'month') return p.month === monthOf(today);
  if (p.kind === 'year') return p.year === today.slice(0, 4);
  return false;
}

const short = (iso: string, withYear: boolean) =>
  parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

/** "Today", "Sat, 14 Nov", "November 2026", "2026", "1 Nov – 14 Nov 2026", "All time". */
export function periodTitle(p: Period, today = todayISO()): string {
  switch (p.kind) {
    case 'all':
      return 'All time';
    case 'day':
      if (p.date === today) return 'Today';
      if (p.date === addDays(today, -1)) return 'Yesterday';
      return p.date.startsWith(today.slice(0, 4)) ? fmtDay(p.date) : short(p.date, true);
    case 'month':
      return fmtMonth(p.month);
    case 'year':
      return p.year;
    case 'range': {
      if (p.from === p.to) return short(p.from, true);
      const sameYear = p.from.slice(0, 4) === p.to.slice(0, 4);
      return `${short(p.from, !sameYear)} – ${short(p.to, true)}`;
    }
  }
}

/** Phrase that follows a word: "Profit today", "Net in November 2026", "Net from 1 Nov – 14 Nov 2026". */
export function periodPhrase(p: Period, today = todayISO()): string {
  switch (p.kind) {
    case 'all':
      return 'all time';
    case 'day':
      if (p.date === today) return 'today';
      if (p.date === addDays(today, -1)) return 'yesterday';
      return `on ${periodTitle(p, today)}`;
    case 'month':
    case 'year':
      return `in ${periodTitle(p, today)}`;
    case 'range':
      return p.from === p.to ? `on ${periodTitle(p, today)}` : `from ${periodTitle(p, today)}`;
  }
}

/** For file names: "2026-11-14", "2026-11", "2026", "2026-11-01_to_2026-11-14", "all". */
export function periodSlug(p: Period): string {
  switch (p.kind) {
    case 'all':
      return 'all';
    case 'day':
      return p.date;
    case 'month':
      return p.month;
    case 'year':
      return p.year;
    case 'range':
      return `${p.from}_to_${p.to}`;
  }
}

/** Stored in the address as ?p=… so the choice survives opening an entry and coming back. */
export function periodToParam(p: Period): string {
  return p.kind === 'all' ? 'all' : p.kind === 'range' ? `${p.from}..${p.to}` : periodSlug(p);
}

export function periodFromParam(v: string | null | undefined, fallback: Period): Period {
  if (!v) return fallback;
  if (v === 'all') return { kind: 'all' };
  if (DATE.test(v)) return { kind: 'day', date: v };
  if (MONTH.test(v)) return { kind: 'month', month: v };
  if (YEAR.test(v)) return { kind: 'year', year: v };
  const [a, b] = v.split('..');
  if (a && b && DATE.test(a) && DATE.test(b)) return a <= b ? { kind: 'range', from: a, to: b } : { kind: 'range', from: b, to: a };
  return fallback;
}
