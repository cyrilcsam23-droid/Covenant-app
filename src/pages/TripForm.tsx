import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDownUp, CalendarPlus, ChevronDown, Phone, Plus, X } from 'lucide-react';
import { actions, useData } from '../lib/store';
import { tripStatus } from '../lib/calc';
import { addTripToPhoneCalendar } from '../lib/calendarFile';
import { TRIP_COST_TYPES, type Trip, type TripCostType, type TripPayment } from '../lib/types';
import { addDays, daysBetween, fmtDay, money, monthOf, toNum, todayISO } from '../lib/format';
import { ResultPlate } from '../components/Plate';
import { Button, ConfirmButton, Empty, Field, FormBar, MoneyField, Segmented, TextField } from '../components/ui';

const MAIN_TYPES: TripCostType[] = ['Fuel', 'Toll', 'Parking'];
const EXTRA_TYPES: TripCostType[] = TRIP_COST_TYPES.filter((t) => !MAIN_TYPES.includes(t));
const MAX_DAYS = 121;

type DayCosts = Partial<Record<TripCostType, string>>;
type PayRow = { key: number; amount: string; date: string };

const str = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? '' : String(n));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const PHONE = /^[0-9+() -]{0,20}$/;

/** Existing expenses → one entry per day of the trip (index 0 = start date). */
function costsToDays(t?: Trip): DayCosts[] {
  if (!t || t.costs.length === 0) return [{}];
  const days: DayCosts[] = [];
  for (const c of t.costs) {
    const i = clamp(daysBetween(t.date, c.date), 0, MAX_DAYS - 1);
    while (days.length <= i) days.push({});
    days[i][c.type] = String(toNum(days[i][c.type]) + c.amount);
  }
  return days;
}

const dayTotal = (d: DayCosts | undefined) => Object.values(d ?? {}).reduce((s, v) => s + toNum(v), 0);
const hasCosts = (d: DayCosts | undefined) => dayTotal(d) > 0;

let rowKey = 0;

export default function TripForm() {
  const { id } = useParams();
  const data = useData();
  const navigate = useNavigate();
  const today = todayISO();
  const live = id ? data.trips.find((t) => t.id === id) : undefined;
  // Keep showing the form while it animates out after a delete.
  const snapshot = useRef(live);
  const existing = live ?? snapshot.current;

  const places = useMemo(() => [...new Set(data.trips.flatMap((t) => [t.from, t.to]).filter(Boolean))].sort(), [data.trips]);
  const vehicles = useMemo(() => [...new Set(data.trips.map((t) => t.vehicle).filter(Boolean))], [data.trips]);

  const [f, setF] = useState(() => {
    const advances = existing?.payments.filter((p) => p.kind === 'advance') ?? [];
    return {
      multi: existing ? existing.endDate !== existing.date : false,
      date: existing?.date ?? today,
      endDate: existing?.endDate && existing.endDate !== existing.date ? existing.endDate : '',
      endUnknown: existing ? existing.endDate === null : false,
      vehicle: existing?.vehicle ?? data.settings.defaultVehicle,
      from: existing?.from ?? '',
      to: existing?.to ?? '',
      startKm: str(existing?.startKm),
      endKm: str(existing?.endKm),
      km: str(existing?.km),
      customerName: existing?.customerName ?? '',
      customerPhone: existing?.customerPhone ?? '',
      fare: str(existing?.fare),
      advance: str(advances.reduce((s, p) => s + p.amount, 0)),
      advanceDate: advances.map((p) => p.date).sort()[0] ?? today,
      notes: existing?.notes ?? '',
    };
  });
  const [payments, setPayments] = useState<PayRow[]>(() =>
    (existing?.payments ?? []).filter((p) => p.kind === 'balance').map((p) => ({ key: ++rowKey, amount: String(p.amount), date: p.date })),
  );
  const [days, setDays] = useState<DayCosts[]>(() => costsToDays(existing));
  const [minDays, setMinDays] = useState(() => (existing && existing.endDate === null ? costsToDays(existing).length : 1));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [shownExtras, setShownExtras] = useState<Record<number, TripCostType[]>>({});
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // ---- derived
  const endDate: string | null = !f.multi ? f.date : f.endUnknown ? null : f.endDate || null;
  const started = f.date <= today;
  let dayCount = 1;
  if (f.multi) {
    if (!f.endUnknown) dayCount = f.endDate && f.endDate >= f.date ? clamp(daysBetween(f.date, f.endDate) + 1, 1, MAX_DAYS) : 1;
    else dayCount = clamp(Math.max(minDays, started ? daysBetween(f.date, today) + 1 : 1), 1, MAX_DAYS);
  }
  const lastDayWithCosts = days.reduce((m, d, i) => (hasCosts(d) ? i : m), -1);
  const strandedDay = lastDayWithCosts >= dayCount ? lastDayWithCosts : -1; // expenses after the end date
  const status = tripStatus({ date: f.date, endDate: f.multi && f.endUnknown ? null : endDate ?? f.date }, today);
  // Open the day that's most likely being filled in: today while on the trip, the first
  // day of a booking, the last day of a finished trip.
  const activeDay =
    openDay ?? (status === 'ongoing' ? clamp(daysBetween(f.date, today), 0, dayCount - 1) : status === 'upcoming' ? 0 : dayCount - 1);

  const odoBoth = f.startKm !== '' && f.endKm !== '';
  const km = odoBoth ? Math.max(0, toNum(f.endKm) - toNum(f.startKm)) : toNum(f.km);
  const expense = days.slice(0, dayCount).reduce((s, d) => s + dayTotal(d), 0);
  const fare = toNum(f.fare);
  const received = toNum(f.advance) + payments.reduce((s, p) => s + toNum(p.amount), 0);
  const due = Math.max(0, fare - received);
  const profit = fare - expense;

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

  // ---- actions
  const setDayCost = (i: number, type: TripCostType, v: string) =>
    setDays((prev) => {
      const next = prev.slice();
      while (next.length <= i) next.push({});
      next[i] = { ...next[i], [type]: v };
      return next;
    });

  const chooseKind = (kind: 'one' | 'multi') => {
    if (kind === 'one' && f.multi) {
      // Fold every day's expenses into the single day, so nothing is lost.
      const merged: DayCosts = {};
      for (const d of days) for (const [k, v] of Object.entries(d)) merged[k as TripCostType] = str(toNum(merged[k as TripCostType]) + toNum(v));
      setDays([merged]);
      setOpenDay(null);
    }
    setF((p) => ({ ...p, multi: kind === 'multi', endDate: kind === 'multi' ? p.endDate : '' }));
  };

  const finishToday = () => {
    setF((p) => ({ ...p, endUnknown: false, endDate: today < p.date ? p.date : today }));
  };

  const markFullyPaid = () => {
    if (due <= 0) return;
    setPayments((p) => [...p.filter((r) => toNum(r.amount) > 0), { key: ++rowKey, amount: String(due), date: endDate && endDate <= today ? endDate : today }]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.date) err.date = 'Pick the start date.';
    if (f.multi && !f.endUnknown) {
      if (!f.endDate) err.endDate = 'Pick the last day, or switch on “End date not known yet”.';
      else if (f.endDate < f.date) err.endDate = 'The last day is before the start date.';
      else if (daysBetween(f.date, f.endDate) >= MAX_DAYS) err.endDate = 'A trip can be at most 120 days.';
    }
    if (!f.from.trim()) err.from = 'Where does the trip start?';
    if (!f.to.trim()) err.to = 'Where does it go?';
    if (!PHONE.test(f.customerPhone.trim())) err.customerPhone = 'Use digits only, like +91 98470 12345.';
    if (odoBoth && toNum(f.endKm) < toNum(f.startKm)) err.endKm = 'End reading is lower than the start reading.';
    if (strandedDay >= 0) err.costs = `Day ${strandedDay + 1} has expenses but is after the last day. Clear them or change the dates.`;
    if (received > fare && (fare > 0 || status === 'done'))
      err.fare = `Payments add up to ${money(received)}, more than the fare. Check the fare or the amounts.`;
    setErrors(err);
    if (Object.keys(err).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: 'center' }));
      return;
    }

    const paymentList: TripPayment[] = [];
    if (toNum(f.advance) > 0) paymentList.push({ date: f.advanceDate || today, kind: 'advance', amount: toNum(f.advance) });
    for (const p of payments) if (toNum(p.amount) > 0) paymentList.push({ date: p.date || today, kind: 'balance', amount: toNum(p.amount) });

    const costList = days.slice(0, dayCount).flatMap((d, i) =>
      TRIP_COST_TYPES.filter((type) => toNum(d[type]) > 0).map((type) => ({ date: addDays(f.date, i), type, amount: toNum(d[type]) })),
    );

    const input = {
      date: f.date,
      endDate,
      vehicle: f.vehicle.trim().toUpperCase(),
      from: f.from.trim(),
      to: f.to.trim(),
      startKm: f.startKm === '' ? null : toNum(f.startKm),
      endKm: f.endKm === '' ? null : toNum(f.endKm),
      km,
      customerName: f.customerName.trim(),
      customerPhone: f.customerPhone.trim(),
      fare,
      payments: paymentList,
      costs: costList,
      notes: f.notes.trim(),
    };
    const savedId = actions.saveTrip(input, existing?.id);
    if (!existing && status === 'upcoming' && addToCalendar) {
      addTripToPhoneCalendar({ ...input, id: savedId, createdAt: new Date().toISOString() }, data.settings.businessName);
    }
    navigate(status === 'done' ? `/trips?m=${monthOf(f.date)}` : '/trips?view=upcoming', { state: { savedId } });
  };

  const backTo = existing ? (tripStatus(existing) === 'done' ? `/trips?m=${monthOf(existing.date)}` : '/trips?view=upcoming') : '/';
  const phoneHref = f.customerPhone.trim() && PHONE.test(f.customerPhone.trim()) ? `tel:${f.customerPhone.replace(/[^\d+]/g, '')}` : null;

  return (
    <>
      <FormBar title={existing ? 'Edit trip' : 'Log trip'} backTo={backTo} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-xl px-4 pb-48">
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

        {/* ---------------------------------------------------------- when */}
        <Section title="When">
          <Segmented
            name="trip-length"
            value={f.multi ? 'multi' : 'one'}
            onChange={chooseKind}
            options={[
              { value: 'one', label: 'One day' },
              { value: 'multi', label: 'Several days' },
            ]}
          />
          {f.multi ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="First day" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} error={errors.date} max="2100-12-31" />
                <TextField
                  label="Last day"
                  type="date"
                  value={f.endUnknown ? '' : f.endDate}
                  min={f.date}
                  disabled={f.endUnknown}
                  onChange={(e) => set('endDate')(e.target.value)}
                  error={errors.endDate}
                  className={f.endUnknown ? 'opacity-60' : ''}
                />
              </div>
              <Switch checked={f.endUnknown} onChange={(v) => setF((p) => ({ ...p, endUnknown: v, endDate: v ? '' : p.endDate }))}>
                End date not known yet
              </Switch>
              {f.endUnknown && started && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">On trip</span>, day {dayCount}. Finish it when the trip ends.
                  </p>
                  <Button type="button" variant="dark" className="!h-10 shrink-0 !px-3 text-sm" onClick={finishToday}>
                    Finish trip today
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <TextField label="Date" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} error={errors.date} max="2100-12-31" />
            </div>
          )}
          {status === 'upcoming' && (
            <p className="mt-2 text-sm text-ink-3">This is a booking. It shows under Upcoming until the day it starts.</p>
          )}
        </Section>

        {/* ---------------------------------------------------------- customer */}
        <Section
          title="Customer"
          action={
            phoneHref && (
              <a href={phoneHref} className="flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
                <Phone size={15} /> Call
              </a>
            )
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Name" value={f.customerName} onChange={(e) => set('customerName')(e.target.value)} placeholder="Optional" maxLength={80} autoComplete="off" />
            <TextField
              label="Phone"
              type="tel"
              inputMode="tel"
              value={f.customerPhone}
              onChange={(e) => set('customerPhone')(e.target.value)}
              placeholder="Optional"
              maxLength={20}
              autoComplete="off"
              error={errors.customerPhone}
            />
          </div>
        </Section>

        {/* ---------------------------------------------------------- route */}
        <Section title="Route">
          <TextField
            label="Vehicle"
            list="vehicles"
            value={f.vehicle}
            onChange={(e) => set('vehicle')(e.target.value)}
            placeholder="KL 07 AB 1234"
            autoCapitalize="characters"
            maxLength={30}
          />
          <div className="mt-3 flex gap-2">
            <div className="min-w-0 flex-1 space-y-3">
              <TextField label="From" list="places" value={f.from} onChange={(e) => set('from')(e.target.value)} placeholder="Pickup place" error={errors.from} autoComplete="off" maxLength={120} />
              <TextField label="To" list="places" value={f.to} onChange={(e) => set('to')(e.target.value)} placeholder="Destination" error={errors.to} autoComplete="off" maxLength={120} />
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
          <div className="mt-3 grid grid-cols-3 gap-3">
            <OdoField label="Start km" value={f.startKm} onChange={set('startKm')} />
            <OdoField label="End km" value={f.endKm} onChange={set('endKm')} invalid={!!errors.endKm} />
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
            {errors.endKm ?? (odoBoth ? 'Worked out from the odometer readings.' : 'Odometer readings, or just the distance.')}
          </p>
        </Section>

        {/* ---------------------------------------------------------- money in */}
        <Section title="Payment">
          <MoneyField
            label="Agreed fare"
            value={f.fare}
            onChange={set('fare')}
            large
            error={errors.fare}
            hint={status === 'done' ? 'The full amount for the trip, including any advance.' : 'The full amount, if agreed. You can fill it in when the trip ends.'}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MoneyField label="Advance" value={f.advance} onChange={set('advance')} />
            <TextField label="Advance paid on" type="date" value={f.advanceDate} onChange={(e) => set('advanceDate')(e.target.value)} max="2100-12-31" />
          </div>

          {payments.map((p, i) => (
            <div key={p.key} className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <MoneyField
                label={i === 0 ? 'Received after' : 'Also received'}
                value={p.amount}
                onChange={(v) => setPayments((rows) => rows.map((r) => (r.key === p.key ? { ...r, amount: v } : r)))}
              />
              <TextField label="On" type="date" value={p.date} onChange={(e) => setPayments((rows) => rows.map((r) => (r.key === p.key ? { ...r, date: e.target.value } : r)))} max="2100-12-31" />
              <button
                type="button"
                onClick={() => setPayments((rows) => rows.filter((r) => r.key !== p.key))}
                aria-label="Remove this payment"
                className="mb-0.5 grid size-11 place-items-center rounded-xl text-ink-3 hover:bg-black/5 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
          ))}

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip onClick={() => setPayments((rows) => [...rows, { key: ++rowKey, amount: '', date: today }])}>
              <Plus size={15} strokeWidth={2.4} /> Add a payment
            </Chip>
            {fare > 0 && due > 0 && (
              <Chip onClick={markFullyPaid}>
                Fully paid · <span className="num text-[0.95rem]">{money(due)}</span>
              </Chip>
            )}
          </div>

          {fare > 0 && (
            <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm text-ink-2 ring-1 ring-inset ring-line">
              Received <span className="num text-[1rem] font-semibold text-ink">{money(received)}</span> of{' '}
              <span className="num text-[1rem] font-semibold text-ink">{money(fare)}</span>
              {due > 0 ? (
                <>
                  {' · '}
                  <span className="font-semibold text-ink">
                    <span className="num text-[1rem]">{money(due)}</span> to collect
                  </span>
                </>
              ) : (
                <span className="font-semibold text-ink"> · Fully paid</span>
              )}
            </p>
          )}
        </Section>

        {/* ---------------------------------------------------------- expenses */}
        <Section title="Expenses">
          {errors.costs && (
            <p className="mb-3 text-sm font-medium text-loss" role="alert">
              {errors.costs}
            </p>
          )}
          {dayCount === 1 ? (
            <DayFields
              costs={days[0]}
              extras={shownExtras[0] ?? []}
              onShowExtra={(t) => setShownExtras((s) => ({ ...s, 0: [...(s[0] ?? []), t] }))}
              onChange={(type, v) => setDayCost(0, type, v)}
            />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {Array.from({ length: dayCount }, (_, i) => {
                const open = i === activeDay;
                const date = addDays(f.date, i);
                const total = dayTotal(days[i]);
                return (
                  <div key={i}>
                    <button
                      type="button"
                      onClick={() => setOpenDay(open ? -1 : i)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
                    >
                      <span>
                        <span className="font-semibold">Day {i + 1}</span>
                        <span className="text-ink-3"> · {fmtDay(date)}</span>
                        {date === today && <span className="ml-2 text-[0.75rem] font-semibold text-ink-2">Today</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`num text-[1.05rem] font-semibold ${total ? 'text-ink' : 'text-ink-3'}`}>{money(total)}</span>
                        <ChevronDown size={18} className={`text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-line bg-ground/50 px-4 pb-4 pt-3">
                        <DayFields
                          costs={days[i]}
                          extras={shownExtras[i] ?? []}
                          onShowExtra={(t) => setShownExtras((s) => ({ ...s, [i]: [...(s[i] ?? []), t] }))}
                          onChange={(type, v) => setDayCost(i, type, v)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {f.multi && f.endUnknown && dayCount < MAX_DAYS && (
            <div className="mt-3">
              <Chip
                onClick={() => {
                  setMinDays(dayCount + 1);
                  setOpenDay(dayCount);
                }}
              >
                <Plus size={15} strokeWidth={2.4} /> Add day {dayCount + 1}
              </Chip>
            </div>
          )}

          <div className="mt-4">
            <Field label="Notes" htmlFor="notes">
              <textarea id="notes" className="field-input" value={f.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Optional" maxLength={1000} />
            </Field>
          </div>
        </Section>

        {!existing && status === 'upcoming' && (
          <div className="mt-6">
            <Switch checked={addToCalendar} onChange={setAddToCalendar}>
              Add to my phone calendar when I save
            </Switch>
            <p className="mt-1.5 pl-[3.25rem] text-sm text-ink-3">The phone reminds you the evening before and that morning.</p>
          </div>
        )}

        {existing && tripStatus(existing) !== 'done' && (
          <Button
            type="button"
            variant="outline"
            className="mt-8 w-full"
            onClick={() => addTripToPhoneCalendar(existing, data.settings.businessName)}
          >
            <CalendarPlus size={18} /> Add to phone calendar
          </Button>
        )}

        {existing && (
          <div className="mt-3">
            <ConfirmButton
              onConfirm={() => {
                actions.deleteTrip(existing.id);
                navigate(backTo, { replace: true });
              }}
            >
              Delete trip
            </ConfirmButton>
          </div>
        )}

        {/* ---------------------------------------------------------- live result */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8rem] text-ink-3">
                Expenses <span className="num text-[0.95rem] font-semibold text-ink-2">{money(expense)}</span>
                {fare > 0 && due > 0 && (
                  <>
                    {' · '}
                    {status === 'done' ? 'To collect' : 'Balance due'} <span className="num text-[0.95rem] font-semibold text-ink-2">{money(due)}</span>
                  </>
                )}
              </p>
              {fare > 0 ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {status === 'done' ? (profit < 0 ? 'Loss' : 'Profit') : profit < 0 ? 'Expected loss' : 'Expected profit'}
                  </span>
                  <ResultPlate value={profit} size="md" />
                </div>
              ) : (
                <p className="mt-1 text-sm font-medium text-ink-2">Profit shows once the fare is in</p>
              )}
            </div>
            <Button type="submit" className="h-14 shrink-0 px-6 text-[1.05rem]">
              {existing ? 'Save' : status === 'upcoming' ? 'Save booking' : 'Save trip'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 first-of-type:mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DayFields({
  costs = {},
  extras,
  onShowExtra,
  onChange,
}: {
  costs?: DayCosts;
  extras: TripCostType[];
  onShowExtra: (t: TripCostType) => void;
  onChange: (type: TripCostType, v: string) => void;
}) {
  const visible = [...MAIN_TYPES, ...EXTRA_TYPES.filter((t) => extras.includes(t) || toNum(costs[t]) > 0)];
  const hidden = EXTRA_TYPES.filter((t) => !visible.includes(t));
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {visible.map((type) => (
          <MoneyField key={type} label={type} value={costs[type] ?? ''} onChange={(v) => onChange(type, v)} autoFocus={extras.at(-1) === type && !costs[type]} />
        ))}
      </div>
      {hidden.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hidden.map((t) => (
            <Chip key={t} onClick={() => onShowExtra(t)}>
              <Plus size={15} strokeWidth={2.4} /> {t}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
    >
      {children}
    </button>
  );
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-11 items-center gap-3 text-left">
      <span
        aria-hidden
        className={`relative h-7 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-plate shadow-[inset_0_0_0_1.5px_rgb(17_17_17/0.85)]' : 'bg-[#d3d3cc]'}`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full transition-[left] ${checked ? 'left-4 bg-plate-ink' : 'left-1 bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.25)]'}`}
        />
      </span>
      <span className="text-[0.95rem] font-medium text-ink">{children}</span>
    </button>
  );
}

function OdoField({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <Field label={label}>
      <input
        className="field-input num !text-[1.2rem] font-medium"
        inputMode="decimal"
        placeholder="—"
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      />
    </Field>
  );
}
