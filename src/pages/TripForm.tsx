import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDownUp } from 'lucide-react';
import { actions, useData } from '../lib/store';
import { tripExpense } from '../lib/calc';
import { money, monthOf, toNum, todayISO } from '../lib/format';
import { ResultPlate } from '../components/Plate';
import { Button, ConfirmButton, Field, FormBar, MoneyField, TextField, Empty } from '../components/ui';

const s = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? '' : String(n));

export default function TripForm() {
  const { id } = useParams();
  const data = useData();
  const navigate = useNavigate();
  const live = id ? data.trips.find((t) => t.id === id) : undefined;
  // Keep showing the form while it animates out after a delete.
  const snapshot = useRef(live);
  const existing = live ?? snapshot.current;

  const places = useMemo(
    () => [...new Set(data.trips.flatMap((t) => [t.from, t.to]).filter(Boolean))].sort(),
    [data.trips],
  );
  const vehicles = useMemo(() => [...new Set(data.trips.map((t) => t.vehicle).filter(Boolean))], [data.trips]);

  const [f, setF] = useState(() => ({
    date: existing?.date ?? todayISO(),
    vehicle: existing?.vehicle ?? data.settings.defaultVehicle,
    from: existing?.from ?? '',
    to: existing?.to ?? '',
    startKm: s(existing?.startKm),
    endKm: s(existing?.endKm),
    km: s(existing?.km),
    received: s(existing?.received),
    fuel: s(existing?.fuel),
    toll: s(existing?.toll),
    parking: s(existing?.parking),
    other: s(existing?.other),
    notes: existing?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const odoBoth = f.startKm !== '' && f.endKm !== '';
  const km = odoBoth ? Math.max(0, toNum(f.endKm) - toNum(f.startKm)) : toNum(f.km);
  const expense = tripExpense({ fuel: toNum(f.fuel), toll: toNum(f.toll), parking: toNum(f.parking), other: toNum(f.other) });
  const profit = toNum(f.received) - expense;

  if (id && !existing) {
    return (
      <>
        <FormBar title="Trip not found" backTo="/trips" />
        <div className="mx-auto max-w-xl p-4">
          <Empty title="This trip no longer exists">It may have been deleted.</Empty>
        </div>
      </>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.date) err.date = 'Pick the trip date.';
    if (!f.from.trim()) err.from = 'Where did the trip start?';
    if (!f.to.trim()) err.to = 'Where did the trip end?';
    if (odoBoth && toNum(f.endKm) < toNum(f.startKm)) err.endKm = 'End reading is lower than the start reading.';
    setErrors(err);
    if (Object.keys(err).length) return;

    const input = {
      date: f.date,
      vehicle: f.vehicle.trim(),
      from: f.from.trim(),
      to: f.to.trim(),
      startKm: f.startKm === '' ? null : toNum(f.startKm),
      endKm: f.endKm === '' ? null : toNum(f.endKm),
      km,
      received: toNum(f.received),
      fuel: toNum(f.fuel),
      toll: toNum(f.toll),
      parking: toNum(f.parking),
      other: toNum(f.other),
      notes: f.notes.trim(),
    };
    const savedId = actions.saveTrip(input, existing?.id);
    navigate(`/trips?m=${monthOf(f.date)}`, { state: { savedId } });
  };

  return (
    <>
      <FormBar title={existing ? 'Edit trip' : 'Log trip'} backTo={existing ? `/trips?m=${monthOf(existing.date)}` : '/'} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-xl px-4 pb-44">
        <datalist id="places">
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="vehicles">
          {vehicles.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>

        <h2 className="mb-3 mt-6 text-[1.05rem] font-semibold">Trip</h2>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} error={errors.date} max="2100-12-31" />
          <TextField
            label="Vehicle"
            list="vehicles"
            value={f.vehicle}
            onChange={(e) => set('vehicle')(e.target.value)}
            placeholder="KL 07 AB 1234"
            autoCapitalize="characters"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1 space-y-3">
            <TextField label="From" list="places" value={f.from} onChange={(e) => set('from')(e.target.value)} placeholder="Pickup place" error={errors.from} autoComplete="off" />
            <TextField label="To" list="places" value={f.to} onChange={(e) => set('to')(e.target.value)} placeholder="Drop place" error={errors.to} autoComplete="off" />
          </div>
          <button
            type="button"
            onClick={() => setF((p) => ({ ...p, from: p.to, to: p.from }))}
            aria-label="Swap From and To"
            title="Swap From and To"
            className="mt-7 grid w-11 shrink-0 place-items-center self-stretch rounded-xl border border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            <ArrowDownUp size={18} />
          </button>
        </div>

        <h2 className="mb-3 mt-8 text-[1.05rem] font-semibold">Distance</h2>
        <div className="grid grid-cols-3 gap-3">
          <OdoField label="Start km" value={f.startKm} onChange={set('startKm')} />
          <OdoField label="End km" value={f.endKm} onChange={set('endKm')} error={errors.endKm ? ' ' : undefined} />
          <Field label="Distance">
            <input
              className="field-input num !text-[1.2rem] font-semibold"
              inputMode="decimal"
              placeholder="0"
              aria-label="Distance in km"
              readOnly={odoBoth}
              value={odoBoth ? String(km) : f.km}
              onChange={(e) => set('km')(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </Field>
        </div>
        <p className={`mt-1.5 text-sm ${errors.endKm ? 'font-medium text-loss' : 'text-ink-3'}`} role={errors.endKm ? 'alert' : undefined}>
          {errors.endKm ?? (odoBoth ? 'Worked out from the odometer readings.' : 'Enter odometer readings, or just the distance.')}
        </p>

        <h2 className="mb-3 mt-8 text-[1.05rem] font-semibold">Money</h2>
        <MoneyField label="Amount received" value={f.received} onChange={set('received')} large />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <MoneyField label="Fuel" value={f.fuel} onChange={set('fuel')} />
          <MoneyField label="Toll" value={f.toll} onChange={set('toll')} />
          <MoneyField label="Parking" value={f.parking} onChange={set('parking')} />
          <MoneyField label="Other" value={f.other} onChange={set('other')} hint="Driver bata, food…" />
        </div>

        <div className="mt-3">
          <Field label="Notes" htmlFor="notes">
            <textarea id="notes" className="field-input" value={f.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        {existing && (
          <div className="mt-8">
            <ConfirmButton
              onConfirm={() => {
                actions.deleteTrip(existing.id);
                navigate(`/trips?m=${monthOf(existing.date)}`, { replace: true });
              }}
            >
              Delete trip
            </ConfirmButton>
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] text-ink-3">
                Expenses <span className="num text-[0.95rem] font-semibold text-ink-2">{money(expense)}</span>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-semibold">{profit < 0 ? 'Loss' : 'Profit'}</span>
                <ResultPlate value={profit} size="md" />
              </div>
            </div>
            <Button type="submit" className="h-14 px-7 text-[1.05rem]">
              {existing ? 'Save' : 'Save trip'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function OdoField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field label={label}>
      <input
        className="field-input num !text-[1.2rem] font-medium"
        inputMode="decimal"
        placeholder="—"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      />
    </Field>
  );
}
