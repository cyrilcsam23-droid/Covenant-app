import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { actions, useData } from '../lib/store';
import { addMonths, num, toNum, todayISO } from '../lib/format';
import { ITEM_TEMPLATES, formatPlate, itemStatus, vehicleOdometer } from '../lib/vehicle';
import { addPaperToPhoneCalendar } from '../lib/calendarFile';
import type { VehicleItem } from '../lib/types';
import { Button, ConfirmButton, Empty, FormBar, Segmented, TextField } from '../components/ui';
import { dueText, StatePill } from './Vehicles';

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const digits = (v: string) => v.replace(/[^\d]/g, '');

/** Add or edit a paper (expiry date) or a service reminder (every N km / months). */
export default function ItemForm() {
  const { vid, iid } = useParams();
  const [params] = useSearchParams();
  const data = useData();
  const navigate = useNavigate();
  const vehicle = data.vehicles.find((v) => v.id === vid);
  const snap = useRef(iid ? data.vehicleItems.find((i) => i.id === iid) : undefined);
  const existing = (iid ? data.vehicleItems.find((i) => i.id === iid) : undefined) ?? snap.current;
  const backTo = `/vehicles?v=${vid}`;

  const [kind, setKind] = useState<VehicleItem['kind']>(existing?.kind ?? (params.get('kind') === 'paper' ? 'paper' : 'service'));
  const [f, setF] = useState(() => ({
    name: existing?.name ?? '',
    everyKm: str(existing?.everyKm),
    everyMonths: str(existing?.everyMonths),
    lastKm: str(existing?.lastKm),
    lastDate: existing?.lastDate ?? '',
    dueDate: existing?.dueDate ?? '',
    remindKm: str(existing?.remindKm ?? 500),
    remindDays: str(existing?.remindDays ?? 15),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  if (!vehicle || (iid && !existing)) {
    return (
      <>
        <FormBar title="Not found" backTo="/vehicles" />
        <div className="mx-auto max-w-xl p-4">
          <Empty title="This reminder no longer exists">It may have been deleted.</Empty>
        </div>
      </>
    );
  }

  const odo = vehicleOdometer(data, vehicle).km;
  const templates = ITEM_TEMPLATES.filter((t) => t.kind === kind);
  const draft: VehicleItem = {
    id: existing?.id ?? 'draft',
    vehicleId: vehicle.id,
    kind,
    name: f.name.trim(),
    everyKm: kind === 'service' && f.everyKm ? toNum(f.everyKm) : null,
    everyMonths: f.everyMonths ? toNum(f.everyMonths) : null,
    lastKm: kind === 'service' && f.lastKm ? toNum(f.lastKm) : null,
    lastDate: f.lastDate || null,
    dueDate: kind === 'paper' && f.dueDate ? f.dueDate : null,
    remindKm: kind === 'service' ? toNum(f.remindKm) : 0,
    remindDays: toNum(f.remindDays),
    position: existing?.position ?? 0,
  };
  const preview = itemStatus(draft, odo);

  const applyTemplate = (name: string) => {
    const t = ITEM_TEMPLATES.find((x) => x.name === name);
    if (!t) return;
    setF((p) => ({
      ...p,
      name: t.name,
      everyKm: str(t.everyKm),
      everyMonths: str(t.everyMonths),
      remindKm: str(t.remindKm || 500),
      remindDays: str(t.remindDays),
    }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!draft.name) err.name = 'Give it a name, e.g. “Oil change”.';
    if (kind === 'service') {
      if (!draft.everyKm && !draft.everyMonths) err.everyKm = 'Set every how many km, months, or both.';
      if (draft.everyKm !== null && (draft.everyKm < 100 || draft.everyKm > 500000)) err.everyKm = 'Use between 100 and 5,00,000 km.';
      if (draft.lastKm !== null && odo > 0 && draft.lastKm > odo) err.lastKm = `That’s more than the current reading (${num(odo)} km).`;
    } else if (!draft.dueDate && !draft.everyMonths) err.dueDate = 'Add the date it’s valid until.';
    if (draft.everyMonths !== null && (draft.everyMonths < 1 || draft.everyMonths > 240)) err.everyMonths = 'Use between 1 and 240 months.';
    if (draft.lastDate && draft.lastDate > todayISO()) err.lastDate = 'That date is in the future.';
    if (draft.remindKm > 20000) err.remindKm = 'At most 20,000 km.';
    if (draft.remindDays > 365) err.remindDays = 'At most 365 days.';
    setErrors(err);
    if (Object.keys(err).length) return;
    const { id: _id, position: _p, ...input } = draft;
    void _id;
    void _p;
    actions.saveItem(input, existing?.id);
    navigate(backTo);
  };

  return (
    <>
      <FormBar title={existing ? existing.name : kind === 'paper' ? 'Add a paper' : 'Add a service reminder'} backTo={backTo} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-6">
        <p className="text-sm text-ink-3">
          For <span className="font-semibold text-ink-2">{formatPlate(vehicle.number)}</span>
          {odo > 0 && ` · now at ${num(odo)} km`}
        </p>

        {!existing && (
          <Segmented
            name="reminder-kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'paper', label: 'Paper (expiry)' },
              { value: 'service', label: 'Service' },
            ]}
          />
        )}

        <div>
          <TextField label="Name" value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder={kind === 'paper' ? 'e.g. Insurance' : 'e.g. Oil change'} maxLength={60} error={errors.name} />
          {!existing && (
            <div className="mt-2 flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(t.name)}
                  aria-pressed={f.name === t.name}
                  className={`h-9 rounded-full border px-3 text-sm font-medium ${f.name === t.name ? 'border-ink bg-shell text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3'}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {kind === 'paper' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Valid until" type="date" value={f.dueDate} onChange={(e) => set('dueDate')(e.target.value)} error={errors.dueDate} max="2100-12-31" />
              <TextField
                label="Renew every (months)"
                inputMode="numeric"
                value={f.everyMonths}
                onChange={(e) => set('everyMonths')(digits(e.target.value))}
                placeholder="12"
                error={errors.everyMonths}
              />
            </div>
            <TextField
              label="Warn this many days before"
              inputMode="numeric"
              value={f.remindDays}
              onChange={(e) => set('remindDays')(digits(e.target.value))}
              error={errors.remindDays}
            />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Every (km)" inputMode="numeric" value={f.everyKm} onChange={(e) => set('everyKm')(digits(e.target.value))} placeholder="5000" error={errors.everyKm} />
              <TextField
                label="or every (months)"
                inputMode="numeric"
                value={f.everyMonths}
                onChange={(e) => set('everyMonths')(digits(e.target.value))}
                placeholder="Optional"
                error={errors.everyMonths}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Last done at (km)"
                inputMode="numeric"
                value={f.lastKm}
                onChange={(e) => set('lastKm')(digits(e.target.value))}
                placeholder={odo > 0 ? String(odo) : 'Odometer'}
                error={errors.lastKm}
              />
              <TextField label="Last done on" type="date" value={f.lastDate} onChange={(e) => set('lastDate')(e.target.value)} error={errors.lastDate} max={todayISO()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Warn km before" inputMode="numeric" value={f.remindKm} onChange={(e) => set('remindKm')(digits(e.target.value))} error={errors.remindKm} />
              <TextField label="Warn days before" inputMode="numeric" value={f.remindDays} onChange={(e) => set('remindDays')(digits(e.target.value))} error={errors.remindDays} />
            </div>
          </>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-ink-2 ring-1 ring-inset ring-line" aria-live="polite">
          <StatePill status={preview} />
          <span>{dueText(draft, preview)}</span>
        </div>

        <Button type="submit" className="h-14 w-full text-[1.05rem]">
          {existing ? 'Save changes' : 'Add'}
        </Button>

        {existing && (
          <Button type="button" variant="outline" className="w-full" onClick={() => navigate(`/expenses/new?vehicle=${vehicle.id}&item=${existing.id}`)}>
            {existing.kind === 'paper' ? 'Mark as renewed' : 'Mark as done'}
          </Button>
        )}

        {kind === 'paper' && (draft.dueDate || (draft.lastDate && draft.everyMonths)) && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              addPaperToPhoneCalendar(
                {
                  id: existing?.id ?? `${vehicle.id}-${draft.name}`,
                  name: draft.name || 'Paper',
                  vehicle: formatPlate(vehicle.number),
                  validUntil: draft.dueDate ?? addMonths(draft.lastDate!, draft.everyMonths!),
                },
                data.settings.businessName,
              )
            }
          >
            <CalendarPlus size={18} /> Add expiry to phone calendar
          </Button>
        )}

        {existing && (
          <ConfirmButton
            onConfirm={() => {
              actions.deleteItem(existing.id);
              navigate(backTo, { replace: true });
            }}
          >
            Stop tracking this
          </ConfirmButton>
        )}
      </form>
    </>
  );
}
