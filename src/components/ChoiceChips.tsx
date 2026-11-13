import type { ReactNode } from 'react';

/**
 * Pick one of a few options with a tap: pills (or an even grid), the chosen one charcoal
 * (or plate yellow on a dark header). Used for partner, expense type, vehicle and reminder choices.
 */
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  grid = false,
  dark = false,
  label,
}: {
  value: T | '';
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  /** Equal-width buttons in rows of three, instead of wrapping pills. */
  grid?: boolean;
  /** On the charcoal header. */
  dark?: boolean;
  label?: string;
}) {
  const on = dark ? 'border-plate bg-plate text-plate-ink' : 'border-ink bg-shell text-white';
  const off = dark ? 'border-shell-line bg-shell-2 text-shell-muted hover:text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3';
  return (
    <div role="group" aria-label={label} className={grid ? 'grid grid-cols-3 gap-2' : 'flex flex-wrap gap-2'}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`${grid ? 'h-12 truncate rounded-xl px-2' : 'h-10 rounded-full px-4'} border text-sm font-semibold transition-colors ${active ? on : off}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
