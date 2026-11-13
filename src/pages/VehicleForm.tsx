import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { actions, useData } from '../lib/store';
import { num, toNum, todayISO } from '../lib/format';
import { ITEM_TEMPLATES, formatPlate, plateKey, vehicleOdometer } from '../lib/vehicle';
import { Button, ConfirmButton, Empty, FormBar, TextField } from '../components/ui';

const DEFAULT_PICKS = new Set(['Insurance', 'Pollution test (PUC)', 'Road tax', 'Permit', 'Fitness certificate', 'General service', 'Oil change']);

/** Add or edit a vehicle. A new vehicle picks which papers and services to track. */
export default function VehicleForm() {
  const { id } = useParams();
  const data = useData();
  const navigate = useNavigate();
  const snap = useRef(id ? data.vehicles.find((v) => v.id === id) : undefined);
  const existing = (id ? data.vehicles.find((v) => v.id === id) : undefined) ?? snap.current;
  const reading = existing ? vehicleOdometer(data, existing) : null;

  const [number, setNumber] = useState(existing ? formatPlate(existing.number) : '');
  const [name, setName] = useState(existing?.name ?? '');
  const [odometer, setOdometer] = useState('');
  const [picks, setPicks] = useState<Set<string>>(() => new Set(DEFAULT_PICKS));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const odoRef = useRef<HTMLDivElement>(null);
  const backTo = existing ? `/vehicles?v=${existing.id}` : '/vehicles';

  useEffect(() => {
    if (window.location.hash === '#odometer') odoRef.current?.querySelector('input')?.focus();
  }, []);

  if (id && !existing) {
    return (
      <>
        <FormBar title="Vehicle not found" backTo="/vehicles" />
        <div className="mx-auto max-w-xl p-4">
          <Empty title="This vehicle no longer exists">It may have been deleted.</Empty>
        </div>
      </>
    );
  }

  const isDefault = !!existing && plateKey(existing.number) === plateKey(data.settings.defaultVehicle);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const key = plateKey(number);
    if (!key) err.number = 'Enter the registration number.';
    else if (key.length > 20) err.number = 'That number is too long.';
    else if (data.vehicles.some((v) => v.id !== existing?.id && plateKey(v.number) === key)) err.number = 'This vehicle is already added.';
    if (odometer && toNum(odometer) < 0) err.odometer = 'The reading can’t be negative.';
    if (odometer && reading && reading.source !== 'none' && toNum(odometer) < reading.km)
      err.odometer = `That’s lower than the last known reading (${num(reading.km)} km).`;
    setErrors(err);
    if (Object.keys(err).length) return;

    const typed = odometer.trim() !== '';
    const input = {
      number: formatPlate(number),
      name: name.trim(),
      odometerKm: typed ? toNum(odometer) : (existing?.odometerKm ?? null),
      odometerDate: typed ? todayISO() : (existing?.odometerDate ?? null),
    };
    // Keep the trips' default in step if this vehicle's number was edited.
    if (existing && isDefault && plateKey(existing.number) !== key) actions.setDefaultVehicle(input.number);
    const vid = actions.saveVehicle(input, existing?.id, existing ? [] : [...picks]);
    navigate(`/vehicles?v=${vid}`);
  };

  const toggle = (n: string) =>
    setPicks((p) => {
      const next = new Set(p);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <>
      <FormBar title={existing ? 'Edit vehicle' : 'Add vehicle'} backTo={backTo} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-6">
        <TextField
          label="Registration number"
          value={number}
          onChange={(e) => setNumber(e.target.value.toUpperCase())}
          onBlur={() => number && setNumber(formatPlate(number))}
          placeholder="KL 39 Y 0770"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={20}
          error={errors.number}
        />
        <TextField label="Model" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional, e.g. Toyota Etios" maxLength={60} />

        <div ref={odoRef}>
          <TextField
            label="Odometer reading now"
            inputMode="decimal"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder={reading && reading.source !== 'none' ? `${num(reading.km)}` : 'e.g. 48900'}
            error={errors.odometer}
            hint={
              reading && reading.source !== 'none'
                ? `Last known: ${num(reading.km)} km. Trips with an end km update this by themselves.`
                : 'Used for service reminders by km. Trips with an end km keep it up to date.'
            }
          />
        </div>

        {!existing && (
          <fieldset>
            <legend className="mb-1 text-[1.05rem] font-semibold">What to track</legend>
            <p className="mb-3 text-sm text-ink-3">You can change the dates, km and intervals of each one afterwards.</p>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {ITEM_TEMPLATES.map((t) => {
                const on = picks.has(t.name);
                const every = [t.everyKm && `${num(t.everyKm)} km`, t.everyMonths && (t.everyMonths % 12 === 0 ? `${t.everyMonths / 12} yr` : `${t.everyMonths} months`)]
                  .filter(Boolean)
                  .join(' or ');
                return (
                  <button
                    key={t.name}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(t.name)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
                  >
                    <span
                      aria-hidden
                      className={`grid size-6 shrink-0 place-items-center rounded-md border ${on ? 'border-ink bg-shell text-white' : 'border-[#c9c9c1] bg-surface'}`}
                    >
                      {on && <Check size={15} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{t.name}</span>
                      <span className="block text-[0.8rem] text-ink-3">{t.kind === 'paper' ? `Paper · renew every ${every}` : `Service · every ${every}`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <Button type="submit" className="h-14 w-full text-[1.05rem]">
          {existing ? 'Save changes' : 'Add vehicle'}
        </Button>

        {existing && !isDefault && (
          <Button type="button" variant="outline" className="w-full" onClick={() => actions.setDefaultVehicle(existing.number)}>
            Use for new trips by default
          </Button>
        )}
        {existing && isDefault && <p className="text-center text-sm text-ink-3">New trips use this vehicle by default.</p>}

        {existing && (
          <ConfirmButton
            armedLabel="Tap again: removes its reminders too"
            onConfirm={() => {
              actions.deleteVehicle(existing.id);
              navigate('/vehicles', { replace: true });
            }}
          >
            Delete vehicle
          </ConfirmButton>
        )}
      </form>
    </>
  );
}
