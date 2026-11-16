import { useId, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayISO } from '../lib/format';
import { isCurrent, periodOfKind, periodTitle, shiftPeriod, type Period, type PeriodKind } from '../lib/period';
import { IconButton, Segmented } from './ui';

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'range', label: 'Range' },
  { value: 'all', label: 'All' },
];

const UNIT: Record<string, string> = { day: 'day', month: 'month', year: 'year' };
const BACK_TO: Record<string, string> = { day: 'Today', month: 'This month', year: 'This year' };

/**
 * Choose what the totals cover: one day, a month, a year, any from–to range, or everything.
 * Day, Month and Year step with the arrows; tap the date to jump with the phone's own picker.
 * Lives on the charcoal header.
 */
export function PeriodPicker({ value, onChange, name }: { value: Period; onChange: (p: Period) => void; name: string }) {
  const today = todayISO();
  return (
    <div>
      <Segmented dark name={name} value={value.kind} onChange={(k) => onChange(periodOfKind(k, value, today))} options={KINDS} />
      {value.kind === 'range' ? (
        <RangeFields value={value} onChange={onChange} />
      ) : value.kind === 'all' ? null : (
        <Stepper value={value} onChange={onChange} today={today} />
      )}
    </div>
  );
}

function Stepper({ value, onChange, today }: { value: Extract<Period, { kind: 'day' | 'month' | 'year' }>; onChange: (p: Period) => void; today: string }) {
  const input = useRef<HTMLInputElement>(null);
  const unit = UNIT[value.kind];
  const canPick = value.kind !== 'year';
  const openPicker = () => {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="mt-2 flex items-center gap-1 rounded-xl bg-shell-2 p-1">
      <IconButton label={`Previous ${unit}`} onClick={() => onChange(shiftPeriod(value, -1))} className="text-white">
        <ChevronLeft size={20} />
      </IconButton>
      <div className="relative flex min-w-0 flex-1 justify-center">
        {canPick ? (
          <button
            type="button"
            onClick={openPicker}
            className="flex h-10 min-w-0 items-center gap-1 rounded-lg px-2 text-[0.95rem] font-semibold text-white hover:bg-white/10"
            aria-label={`${periodTitle(value, today)}. Choose a ${unit}`}
          >
            <span className="truncate">{periodTitle(value, today)}</span>
            <ChevronDown size={16} className="shrink-0 text-shell-muted" aria-hidden />
          </button>
        ) : (
          <span className="text-[0.95rem] font-semibold text-white">{periodTitle(value, today)}</span>
        )}
        {canPick && (
          <input
            ref={input}
            type={value.kind === 'day' ? 'date' : 'month'}
            value={value.kind === 'day' ? value.date : value.kind === 'month' ? value.month : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onChange(value.kind === 'day' ? { kind: 'day', date: v } : { kind: 'month', month: v.slice(0, 7) });
            }}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
            style={{ colorScheme: 'dark' }}
          />
        )}
      </div>
      {!isCurrent(value, today) && (
        <button
          type="button"
          onClick={() => onChange(periodOfKind(value.kind, { kind: 'all' }, today))}
          className="h-8 shrink-0 rounded-full border border-shell-line px-3 text-[0.8rem] font-semibold text-white hover:border-shell-muted"
        >
          {BACK_TO[value.kind]}
        </button>
      )}
      <IconButton label={`Next ${unit}`} onClick={() => onChange(shiftPeriod(value, 1))} className="text-white">
        <ChevronRight size={20} />
      </IconButton>
    </div>
  );
}

function RangeFields({ value, onChange }: { value: Extract<Period, { kind: 'range' }>; onChange: (p: Period) => void }) {
  const id = useId();
  const set = (which: 'from' | 'to', v: string) => {
    if (!v) return;
    const next = { ...value, [which]: v };
    onChange(next.from <= next.to ? next : { kind: 'range', from: next.to, to: next.from });
  };
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {(['from', 'to'] as const).map((which) => (
        <div key={which}>
          <label htmlFor={`${id}-${which}`} className="mb-1 block px-1 text-[0.75rem] font-medium text-shell-muted">
            {which === 'from' ? 'From' : 'To'}
          </label>
          <input
            id={`${id}-${which}`}
            type="date"
            className="field-input field-input-dark num !h-11 !px-2.5 text-[1.05rem] font-semibold"
            style={{ colorScheme: 'dark' }}
            value={value[which]}
            max="2100-12-31"
            onChange={(e) => set(which, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
