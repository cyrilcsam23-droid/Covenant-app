import { describe, expect, it } from 'vitest';
import {
  inPeriod,
  isCurrent,
  lastDayOf,
  periodFromParam,
  periodOfKind,
  periodPhrase,
  periodSlug,
  periodTitle,
  periodToParam,
  shiftPeriod,
  type Period,
} from './period';

const TODAY = '2026-11-14';

describe('inPeriod', () => {
  it('matches days, months, years and ranges', () => {
    expect(inPeriod('2026-11-14', { kind: 'day', date: '2026-11-14' })).toBe(true);
    expect(inPeriod('2026-11-13', { kind: 'day', date: '2026-11-14' })).toBe(false);
    expect(inPeriod('2026-11-30', { kind: 'month', month: '2026-11' })).toBe(true);
    expect(inPeriod('2026-12-01', { kind: 'month', month: '2026-11' })).toBe(false);
    expect(inPeriod('2026-01-01', { kind: 'year', year: '2026' })).toBe(true);
    expect(inPeriod('2025-12-31', { kind: 'year', year: '2026' })).toBe(false);
    expect(inPeriod('2026-11-01', { kind: 'all' })).toBe(true);
  });

  it('includes both ends of a range', () => {
    const r: Period = { kind: 'range', from: '2026-10-28', to: '2026-11-03' };
    expect(inPeriod('2026-10-28', r)).toBe(true);
    expect(inPeriod('2026-11-03', r)).toBe(true);
    expect(inPeriod('2026-10-27', r)).toBe(false);
    expect(inPeriod('2026-11-04', r)).toBe(false);
  });
});

describe('stepping and switching', () => {
  it('steps across month and year ends', () => {
    expect(shiftPeriod({ kind: 'day', date: '2026-11-30' }, 1)).toEqual({ kind: 'day', date: '2026-12-01' });
    expect(shiftPeriod({ kind: 'month', month: '2026-01' }, -1)).toEqual({ kind: 'month', month: '2025-12' });
    expect(shiftPeriod({ kind: 'year', year: '2026' }, 1)).toEqual({ kind: 'year', year: '2027' });
  });

  it('keeps your place when switching kind', () => {
    expect(periodOfKind('month', { kind: 'day', date: '2026-10-20' }, TODAY)).toEqual({ kind: 'month', month: '2026-10' });
    expect(periodOfKind('day', { kind: 'month', month: '2026-10' }, TODAY)).toEqual({ kind: 'day', date: '2026-10-01' });
    expect(periodOfKind('day', { kind: 'month', month: '2026-11' }, TODAY)).toEqual({ kind: 'day', date: TODAY });
    expect(periodOfKind('range', { kind: 'month', month: '2026-02' }, TODAY)).toEqual({ kind: 'range', from: '2026-02-01', to: '2026-02-28' });
    expect(periodOfKind('range', { kind: 'day', date: TODAY }, TODAY)).toEqual({ kind: 'range', from: '2026-11-01', to: TODAY });
    expect(periodOfKind('year', { kind: 'all' }, TODAY)).toEqual({ kind: 'year', year: '2026' });
  });

  it('knows the last day of a month', () => {
    expect(lastDayOf('2028-02')).toBe('2028-02-29');
    expect(lastDayOf('2026-12')).toBe('2026-12-31');
  });

  it('knows the current period', () => {
    expect(isCurrent({ kind: 'day', date: TODAY }, TODAY)).toBe(true);
    expect(isCurrent({ kind: 'month', month: '2026-10' }, TODAY)).toBe(false);
    expect(isCurrent({ kind: 'year', year: '2026' }, TODAY)).toBe(true);
  });
});

describe('labels', () => {
  it('reads naturally', () => {
    expect(periodTitle({ kind: 'day', date: TODAY }, TODAY)).toBe('Today');
    expect(periodPhrase({ kind: 'day', date: '2026-11-13' }, TODAY)).toBe('yesterday');
    expect(periodPhrase({ kind: 'month', month: '2026-11' }, TODAY)).toBe('in November 2026');
    expect(periodPhrase({ kind: 'year', year: '2026' }, TODAY)).toBe('in 2026');
    expect(periodPhrase({ kind: 'all' }, TODAY)).toBe('all time');
    expect(periodPhrase({ kind: 'range', from: '2026-11-01', to: '2026-11-14' }, TODAY)).toBe('from 1 Nov – 14 Nov 2026');
  });

  it('makes safe file names', () => {
    expect(periodSlug({ kind: 'range', from: '2026-11-01', to: '2026-11-14' })).toBe('2026-11-01_to_2026-11-14');
    expect(periodSlug({ kind: 'all' })).toBe('all');
  });
});

describe('address parameter', () => {
  const fallback: Period = { kind: 'month', month: '2026-11' };
  const cases: Period[] = [
    { kind: 'all' },
    { kind: 'day', date: TODAY },
    { kind: 'month', month: '2026-10' },
    { kind: 'year', year: '2025' },
    { kind: 'range', from: '2026-10-20', to: '2026-11-14' },
  ];
  it('round-trips every kind', () => {
    for (const p of cases) expect(periodFromParam(periodToParam(p), fallback)).toEqual(p);
  });
  it('falls back on missing or junk values, and orders a reversed range', () => {
    expect(periodFromParam(null, fallback)).toBe(fallback);
    expect(periodFromParam('<script>', fallback)).toBe(fallback);
    expect(periodFromParam('2026-13', fallback)).toBe(fallback);
    expect(periodFromParam('2026-02-40', fallback)).toBe(fallback);
    expect(periodFromParam('2026-11-14..2026-11-01', fallback)).toEqual({ kind: 'range', from: '2026-11-01', to: '2026-11-14' });
  });
});
