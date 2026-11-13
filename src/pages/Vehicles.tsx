import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Gauge, Plus } from 'lucide-react';
import { useData } from '../lib/store';
import { tripStatus } from '../lib/calc';
import { fmtDate, money, monthOf, num, todayISO } from '../lib/format';
import { formatPlate, plateKey, scheduleLabel, vehicleItems, vehicleOdometer, type ItemStatus } from '../lib/vehicle';
import type { AppData, Vehicle, VehicleItem } from '../lib/types';
import { ShellHeader, Page } from '../components/Layout';
import { Plate } from '../components/Plate';
import { Button, Empty, IconButton, SectionTitle } from '../components/ui';
import { ChoiceChips } from '../components/ChoiceChips';

/** Vehicle dashboard: papers, service reminders, odometer, this month, history. */
export default function Vehicles() {
  const data = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const vehicles = [...data.vehicles].sort((a, b) => a.position - b.position);
  const defaultKey = plateKey(data.settings.defaultVehicle);
  const v =
    vehicles.find((x) => x.id === params.get('v')) ?? vehicles.find((x) => plateKey(x.number) === defaultKey) ?? vehicles[0];

  if (!v) {
    return (
      <>
        <ShellHeader>
          <h1 className="text-[1.35rem] font-semibold">Vehicle</h1>
          <p className="mt-1 text-sm text-shell-muted">Papers, service reminders and costs for each vehicle.</p>
        </ShellHeader>
        <Page>
          <div className="mt-6">
            <Empty title="No vehicle yet">
              Add the vehicle once: its number, the odometer reading, and which papers and services to track.
            </Empty>
          </div>
          <Button className="mt-4 h-14 w-full text-[1.05rem]" onClick={() => navigate('/vehicles/new')}>
            <Plus size={22} strokeWidth={2.6} /> Add vehicle
          </Button>
        </Page>
      </>
    );
  }

  const reading = vehicleOdometer(data, v);
  const items = vehicleItems(data, v);
  const overdue = items.filter((x) => x.status.state === 'overdue').length;
  const soon = items.filter((x) => x.status.state === 'soon').length;
  const papers = items.filter((x) => x.item.kind === 'paper');
  const services = items.filter((x) => x.item.kind === 'service');
  const month = monthOf(todayISO());
  const stats = monthStats(data, v, month);
  const history = data.expenses
    .filter((e) => e.vehicleId === v.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const isDefault = plateKey(v.number) === defaultKey;

  return (
    <>
      <ShellHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-[1.35rem] font-semibold">Vehicle</h1>
          <IconButton label="Add a vehicle" onClick={() => navigate('/vehicles/new')}>
            <Plus size={22} />
          </IconButton>
        </div>
        {vehicles.length > 1 && (
          <div className="mt-3">
            <ChoiceChips
              dark
              label="Vehicle"
              value={v.id}
              onChange={(id) => setParams({ v: id }, { replace: true })}
              options={vehicles.map((x) => ({ value: x.id, label: formatPlate(x.number) }))}
            />
          </div>
        )}

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Plate size="md" className="tracking-[0.06em]" label={`Vehicle ${formatPlate(v.number)}`}>
              {formatPlate(v.number)}
            </Plate>
            <p className="mt-2 truncate text-sm text-shell-muted">
              {v.name || 'Model not set'}
              {isDefault && ' · Default for trips'}
            </p>
            {(overdue > 0 || soon > 0) && (
              <p className="mt-1 text-sm font-semibold text-white">
                {[overdue > 0 && `${overdue} overdue`, soon > 0 && `${soon} due soon`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <Link to={`/vehicles/${v.id}`} className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-semibold text-shell-muted hover:bg-white/10 hover:text-white">
            Edit
          </Link>
        </div>

        <Link to={`/vehicles/${v.id}#odometer`} className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-shell-2 px-4 py-3 hover:bg-shell-line/60">
          <span className="flex items-center gap-3">
            <Gauge size={20} className="text-shell-muted" />
            <span>
              <span className="num block text-[1.6rem] font-semibold leading-none text-white">{reading.source === 'none' ? '—' : `${num(reading.km)} km`}</span>
              <span className="mt-1 block text-[0.8rem] text-shell-muted">{readingNote(reading)}</span>
            </span>
          </span>
          <span className="text-sm font-semibold text-shell-muted">Update</span>
        </Link>

        <dl className="mt-3 grid grid-cols-3 divide-x divide-shell-line rounded-xl bg-shell-2">
          <Stat label="Km this month" value={num(stats.km)} />
          <Stat label="Fares" value={money(stats.fares)} />
          <Stat label="Spent on it" value={money(stats.spent)} />
        </dl>
      </ShellHeader>

      <Page>
        <SectionTitle
          action={
            <Link to={`/vehicles/${v.id}/items/new?kind=paper`} className="flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
              <Plus size={16} /> Add
            </Link>
          }
        >
          Papers
        </SectionTitle>
        {papers.length === 0 ? (
          <Empty title="No papers tracked">Insurance, pollution test, tax, permit and fitness, each with its expiry date.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {papers.map(({ item, status }) => (
              <ItemRow key={item.id} vehicle={v} item={item} status={status} />
            ))}
          </ul>
        )}

        <SectionTitle
          action={
            <Link to={`/vehicles/${v.id}/items/new?kind=service`} className="flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
              <Plus size={16} /> Add
            </Link>
          }
        >
          Service
        </SectionTitle>
        {services.length === 0 ? (
          <Empty title="No service reminders">Oil change, general service, tyres: every so many km or months.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {services.map(({ item, status }) => (
              <ItemRow key={item.id} vehicle={v} item={item} status={status} />
            ))}
          </ul>
        )}

        <SectionTitle
          action={
            <Link to={`/expenses?vehicle=${v.id}`} className="flex items-center text-sm font-semibold text-ink-2 hover:text-ink">
              All costs <ChevronRight size={16} />
            </Link>
          }
        >
          Recent costs
        </SectionTitle>
        {history.length === 0 ? (
          <Empty title="Nothing spent on this vehicle yet">Service, repairs, insurance and other costs for it show here.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {history.map((e) => (
              <li key={e.id}>
                <Link to={`/expenses/${e.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.description}</p>
                    <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">
                      {e.category} · {fmtDate(e.date)}
                      {e.odometerKm != null && ` · at ${num(e.odometerKm)} km`}
                    </p>
                  </div>
                  <span className="num text-[1.15rem] font-semibold">{money(e.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="h-8" />
      </Page>
    </>
  );
}

function monthStats(data: AppData, v: Vehicle, month: string) {
  const key = plateKey(v.number);
  const trips = data.trips.filter((t) => plateKey(t.vehicle) === key && t.date.startsWith(month) && tripStatus(t) === 'done');
  return {
    km: trips.reduce((s, t) => s + (t.km || 0), 0),
    fares: trips.reduce((s, t) => s + (t.fare || 0), 0),
    spent: data.expenses.filter((e) => e.vehicleId === v.id && e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0),
  };
}

function readingNote(r: ReturnType<typeof vehicleOdometer>) {
  if (r.source === 'none') return 'Add the odometer reading to track service by km';
  const when = r.date ? fmtDate(r.date) : '';
  return r.source === 'trip' ? `From the trip on ${when}` : r.source === 'service' ? `From the service on ${when}` : `Entered ${when}`;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-2 py-3 text-center">
      <dt className="text-[0.75rem] font-medium text-shell-muted">{label}</dt>
      <dd className="num mt-0.5 truncate text-[1.2rem] font-semibold leading-tight text-white">{value}</dd>
    </div>
  );
}

/** One paper or service reminder: what it is, when it's due, and the action to complete it. */
export function ItemRow({ vehicle, item, status, showVehicle = false }: { vehicle: Vehicle; item: VehicleItem; status: ItemStatus; showVehicle?: boolean }) {
  return (
    <li className="flex items-stretch bg-surface">
      <Link to={`/vehicles/${vehicle.id}/items/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 pr-2 hover:bg-black/[0.02]">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate font-semibold">{item.name}</span>
            <StatePill status={status} />
          </p>
          <p className="mt-0.5 text-[0.83rem] leading-snug text-ink-3">
            {showVehicle && `${formatPlate(vehicle.number)} · `}
            {dueText(item, status)}
          </p>
          {!showVehicle && <p className="mt-0.5 truncate text-[0.78rem] text-ink-3">{scheduleLabel(item)}</p>}
        </div>
      </Link>
      <div className="flex items-center pr-3">
        <Link
          to={`/expenses/new?vehicle=${vehicle.id}&item=${item.id}`}
          className={`inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
            status.state === 'overdue' || status.state === 'soon' ? 'bg-shell text-white hover:bg-shell-2' : 'border border-line text-ink-2 hover:border-ink-3 hover:text-ink'
          }`}
        >
          {item.kind === 'paper' ? 'Renewed' : 'Done'}
        </Link>
      </div>
    </li>
  );
}

export function StatePill({ status }: { status: ItemStatus }) {
  if (status.state === 'ok') return null;
  const map = {
    overdue: ['Overdue', 'bg-loss text-white'],
    soon: ['Due soon', 'bg-surface text-ink ring-1 ring-inset ring-ink/80'],
    unset: ['Not set', 'bg-[#e4e4de] text-ink-2'],
  } as const;
  const [label, cls] = map[status.state];
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.72rem] font-semibold ${cls}`}>{label}</span>;
}

/** "Valid until 31 Mar 2027", "Expired 3 days ago", "Next at 54,000 km · 3,600 km to go", "When was it last done?" */
export function dueText(item: VehicleItem, s: ItemStatus) {
  if (s.state === 'unset') return item.kind === 'paper' ? 'Add the date it’s valid until' : 'When was it last done?';
  const parts: string[] = [];
  if (item.kind === 'paper' && s.nextDate) {
    const d = s.daysLeft ?? 0;
    parts.push(d < 0 ? `Expired ${fmtDate(s.nextDate)} (${-d} ${-d === 1 ? 'day' : 'days'} ago)` : d === 0 ? 'Expires today' : `Valid until ${fmtDate(s.nextDate)} · ${d} ${d === 1 ? 'day' : 'days'} left`);
    return parts.join('');
  }
  if (s.nextKm !== null && s.kmLeft !== null) {
    parts.push(s.kmLeft <= 0 ? `${num(-s.kmLeft)} km overdue (was due at ${num(s.nextKm)})` : `Next at ${num(s.nextKm)} km · ${num(s.kmLeft)} km to go`);
  }
  if (s.nextDate && s.daysLeft !== null) {
    parts.push(s.daysLeft < 0 ? `was due ${fmtDate(s.nextDate)}` : `by ${fmtDate(s.nextDate)}`);
  }
  return parts.join(' · ');
}
