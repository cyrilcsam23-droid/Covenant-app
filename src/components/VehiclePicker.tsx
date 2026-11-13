import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useData } from '../lib/store';
import { formatPlate, plateKey } from '../lib/vehicle';
import { Field } from './ui';

/**
 * Choose one of the saved vehicles (stores its number). A number that isn't saved any more
 * (an older trip) stays selectable so editing that trip doesn't silently change it.
 */
export function VehiclePicker({
  label,
  value,
  onChange,
  hint,
  error,
  allowNone = false,
}: {
  label: string;
  value: string;
  onChange: (number: string) => void;
  hint?: string;
  error?: string;
  allowNone?: boolean;
}) {
  const data = useData();
  const id = useId();
  const vehicles = [...data.vehicles].sort((a, b) => a.position - b.position);
  const current = vehicles.find((v) => plateKey(v.number) === plateKey(value));
  const orphan = value.trim() && !current ? value.trim() : '';

  if (vehicles.length === 0 && !orphan) {
    return (
      <Field label={label}>
        <p className="rounded-xl border border-dashed border-[#c9c9c1] px-4 py-3 text-sm text-ink-3">
          No vehicles saved yet.{' '}
          <Link to="/vehicles/new" className="font-semibold text-ink-2 underline underline-offset-2">
            Add a vehicle
          </Link>{' '}
          and it will be picked here.
        </p>
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          className="field-input num appearance-none pr-10 !text-[1.15rem] font-semibold tracking-[0.04em]"
          value={current ? current.number : orphan}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
        >
          {(allowNone || (!current && !orphan)) && <option value="">{allowNone ? 'No vehicle' : 'Choose a vehicle'}</option>}
          {vehicles.map((v) => (
            <option key={v.id} value={v.number}>
              {formatPlate(v.number)}
              {v.name ? `  ·  ${v.name}` : ''}
            </option>
          ))}
          {orphan && <option value={orphan}>{formatPlate(orphan)} (not saved)</option>}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
      </div>
    </Field>
  );
}
