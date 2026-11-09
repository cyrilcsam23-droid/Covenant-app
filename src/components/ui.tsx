import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, type HTMLMotionProps } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motionTokens, springs } from '../lib/motion';
import { fmtMonth, shiftMonth } from '../lib/format';

type Variant = 'primary' | 'dark' | 'ghost' | 'danger' | 'outline';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-plate text-plate-ink font-semibold shadow-[inset_0_0_0_1.5px_rgb(17_17_17/0.85),0_1px_2px_rgb(0_0_0/0.25)] hover:bg-[#f7cd33]',
  dark: 'bg-shell text-white font-semibold hover:bg-shell-2',
  outline: 'bg-surface text-ink font-medium border border-line hover:border-ink-3',
  ghost: 'text-ink-2 font-medium hover:bg-black/5',
  danger: 'bg-surface text-loss font-semibold border border-loss/40 hover:bg-loss-soft',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: { variant?: Variant } & HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileTap={{ scale: motionTokens.scale.press }}
      transition={springs.snappy}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[0.95rem] transition-colors disabled:opacity-50 ${variantClass[variant]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 place-items-center rounded-full transition-colors hover:bg-white/10 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className = '',
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-loss" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className = '',
  ...input
}: { label: string; hint?: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <input id={id} className="field-input" aria-invalid={error ? true : undefined} {...input} />
    </Field>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  error,
  className = '',
  large = false,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  error?: string;
  className?: string;
  large?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <div className="relative">
        <span
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 ${large ? 'text-xl' : ''}`}
          aria-hidden
        >
          ₹
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          autoFocus={autoFocus}
          className={`field-input num pl-8 ${large ? '!h-14 !text-[1.6rem] font-semibold' : '!text-[1.2rem] font-medium'}`}
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        />
      </div>
    </Field>
  );
}

/** Segmented control with a sliding indicator. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  dark = false,
  name,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  dark?: boolean;
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`relative grid rounded-xl p-1 ${dark ? 'bg-shell-2' : 'bg-[#e4e4de]'}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative h-10 rounded-lg text-sm font-semibold transition-colors ${
              active ? (dark ? 'text-plate-ink' : 'text-ink') : dark ? 'text-shell-muted hover:text-white' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${name}`}
                transition={springs.snappy}
                className={`absolute inset-0 rounded-lg ${dark ? 'bg-plate' : 'bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.15)]'}`}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Two-step delete: first tap arms it, second tap confirms. */
export function ConfirmButton({ onConfirm, children, armedLabel = 'Tap again to delete' }: { onConfirm: () => void; children: ReactNode; armedLabel?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      type="button"
      variant="danger"
      className={`w-full ${armed ? '!bg-loss !text-white' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? armedLabel : children}
    </Button>
  );
}

/** Top bar for full-screen forms. */
export function FormBar({ title, backTo }: { title: string; backTo: string }) {
  return (
    <div className="on-shell sticky top-0 z-20 flex h-14 items-center gap-2 bg-shell px-2 text-white pt-[env(safe-area-inset-top)] box-content">
      <Link to={backTo} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-white/10">
        <X size={22} />
      </Link>
      <h1 className="text-[1.05rem] font-semibold">{title}</h1>
    </div>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-shell-2 p-1">
      <IconButton label="Previous month" onClick={() => onChange(shiftMonth(month, -1))} className="text-white">
        <ChevronLeft size={20} />
      </IconButton>
      <span className="text-[0.95rem] font-semibold text-white">{fmtMonth(month)}</span>
      <IconButton label="Next month" onClick={() => onChange(shiftMonth(month, 1))} className="text-white">
        <ChevronRight size={20} />
      </IconButton>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between gap-3">
      <h2 className="text-[1.05rem] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#c9c9c1] px-5 py-8 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1.5 text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function downloadFile(name: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
