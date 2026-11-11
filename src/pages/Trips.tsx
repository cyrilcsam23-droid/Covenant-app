import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, Phone, Plus } from 'lucide-react';
import { actions, useData } from '../lib/store';
import { dues, groupByDay, ongoingTrips, summarize, toCSV, tripDue, tripReceived, tripsOnDay, tripStatus, upcomingTrips } from '../lib/calc';
import { fmtDay, fmtMonth, fmtRange, money, monthOf, num, parseISO, signedMoney, todayISO } from '../lib/format';
import type { Trip } from '../lib/types';
import { ShellHeader, Page } from '../components/Layout';
import { ResultPlate } from '../components/Plate';
import { Button, Empty, IconButton, MonthSwitcher, Segmented, SectionTitle, downloadFile } from '../components/ui';
import { TripRow, untilLabel } from '../components/TripRow';

type View = 'month' | 'upcoming' | 'dues' | 'calendar';
const VIEWS: { value: View; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'dues', label: 'To collect' },
  { value: 'calendar', label: 'Calendar' },
];

export default function Trips() {
  const data = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const savedId = (location.state as { savedId?: string } | null)?.savedId;
  const [params, setParams] = useSearchParams();
  const view: View = (VIEWS.find((v) => v.value === params.get('view'))?.value ?? 'month') as View;
  const month = params.get('m') || monthOf(todayISO());
  const go = (next: { view?: View; m?: string }) => {
    const p: Record<string, string> = {};
    const v = next.view ?? view;
    if (v !== 'month') p.view = v;
    if (next.m ?? params.get('m')) p.m = next.m ?? params.get('m')!;
    setParams(p, { replace: true });
  };

  const s = summarize(data, { kind: 'month', month });
  const owed = dues(data);
  const upcoming = upcomingTrips(data);
  const ongoing = ongoingTrips(data);

  return (
    <>
      <ShellHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-[1.35rem] font-semibold">Trips</h1>
          <div className="flex items-center gap-1">
            {view === 'month' && (
              <IconButton
                label={`Download ${fmtMonth(month)} as a spreadsheet`}
                onClick={() => downloadFile(`trips-${month}.csv`, toCSV(s.trips))}
                disabled={s.trips.length === 0}
                className="disabled:opacity-40"
              >
                <Download size={20} />
              </IconButton>
            )}
            <Button className="!h-10 !rounded-lg !px-3 text-sm" onClick={() => navigate('/trips/new')}>
              <Plus size={18} strokeWidth={2.6} /> Log trip
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <Segmented dark name="Trips view" value={view} onChange={(v) => go({ view: v })} options={VIEWS} />
        </div>

        {(view === 'month' || view === 'calendar') && (
          <div className="mt-3">
            <MonthSwitcher month={month} onChange={(m) => go({ m })} />
          </div>
        )}
        {view === 'month' && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-shell-muted">
              <span className="num text-[1.15rem] font-semibold text-white">{s.tripCount}</span> completed ·{' '}
              <span className="num text-[1.15rem] font-semibold text-white">{num(s.km)}</span> km
            </p>
            <ResultPlate value={s.tripProfit} size="md" />
          </div>
        )}
        {view === 'upcoming' && (
          <p className="mt-4 text-sm text-shell-muted">
            <span className="num text-[1.15rem] font-semibold text-white">{ongoing.length}</span> on trip now ·{' '}
            <span className="num text-[1.15rem] font-semibold text-white">{upcoming.length}</span> booked ahead
          </p>
        )}
        {view === 'dues' && (
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-sm text-shell-muted">
              From <span className="num text-[1.15rem] font-semibold text-white">{owed.trips.length}</span>{' '}
              {owed.trips.length === 1 ? 'finished trip' : 'finished trips'}
            </p>
            <p className="num text-[1.6rem] font-bold leading-none text-white" aria-label={`To collect ${money(owed.total)}`}>
              {money(owed.total)}
            </p>
          </div>
        )}
      </ShellHeader>

      <Page>
        {view === 'month' && <MonthList trips={s.trips} month={month} savedId={savedId} />}
        {view === 'upcoming' && <UpcomingList ongoing={ongoing} upcoming={upcoming} savedId={savedId} />}
        {view === 'dues' && <DuesList trips={owed.trips} />}
        {view === 'calendar' && <CalendarView month={month} />}
        <div className="h-8" />
      </Page>
    </>
  );
}

function MonthList({ trips, month, savedId }: { trips: Trip[]; month: string; savedId?: string }) {
  const days = groupByDay(trips);
  if (days.length === 0) {
    return (
      <div className="mt-6">
        <Empty title={`No trips in ${fmtMonth(month)}`}>Trips are listed under the day they start, newest first.</Empty>
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-5">
      {days.map((d) => (
        <section key={d.date} aria-label={fmtDay(d.date)}>
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <h2 className="text-[0.9rem] font-semibold text-ink">{fmtDay(d.date)}</h2>
            {d.counted > 0 && (
              <p className="text-[0.83rem] text-ink-3">
                {num(d.km)} km ·{' '}
                <span className={`num text-[0.95rem] font-semibold ${d.profit < 0 ? 'text-loss' : 'text-ink-2'}`}>{signedMoney(d.profit)}</span>
              </p>
            )}
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {d.trips.map((t) => (
              <TripRow key={t.id} trip={t} fresh={t.id === savedId} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function UpcomingList({ ongoing, upcoming, savedId }: { ongoing: Trip[]; upcoming: Trip[]; savedId?: string }) {
  if (ongoing.length === 0 && upcoming.length === 0) {
    return (
      <div className="mt-6">
        <Empty title="No bookings yet">
          Log a trip with a future date to save it as a booking, with the customer and any advance. It stays here until the day it starts.
        </Empty>
      </div>
    );
  }
  const byDate = new Map<string, Trip[]>();
  for (const t of upcoming) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
  return (
    <>
      {ongoing.length > 0 && (
        <>
          <SectionTitle>On trip now</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {ongoing.map((t) => (
              <TripRow key={t.id} trip={t} showDate fresh={t.id === savedId} />
            ))}
          </ul>
        </>
      )}
      {upcoming.length > 0 && <SectionTitle>Booked ahead</SectionTitle>}
      <div className="space-y-5">
        {[...byDate.entries()].map(([date, list]) => (
          <section key={date} aria-label={fmtDay(date)}>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h3 className="text-[0.9rem] font-semibold text-ink">{fmtDay(date)}</h3>
              <p className="text-[0.83rem] font-medium text-ink-3">{untilLabel(date)}</p>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {list.map((t) => (
                <TripRow key={t.id} trip={t} fresh={t.id === savedId} aside={null} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function DuesList({ trips }: { trips: Trip[] }) {
  if (trips.length === 0) {
    return (
      <div className="mt-6">
        <Empty title="Nothing to collect">Every finished trip is fully paid. Trips with money still owed show up here, oldest first.</Empty>
      </div>
    );
  }
  return (
    <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {trips.map((t) => (
        <DueItem key={t.id} trip={t} />
      ))}
    </ul>
  );
}

function DueItem({ trip }: { trip: Trip }) {
  const due = tripDue(trip);
  const [armed, setArmed] = useState(false);
  const phone = trip.customerPhone.replace(/[^\d+]/g, '');
  return (
    <li className="bg-surface">
      <Link to={`/trips/${trip.id}`} className="flex items-start gap-3 px-4 pt-3.5 hover:bg-black/[0.02]">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 font-semibold">
            <span className="truncate">{trip.from}</span>
            <ArrowRight size={15} className="shrink-0 text-ink-3" aria-label="to" />
            <span className="truncate">{trip.to}</span>
          </p>
          <p className="mt-0.5 truncate text-[0.83rem] font-medium text-ink-2">
            {[fmtRange(trip.date, trip.endDate), trip.customerName].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-0.5 text-[0.83rem] text-ink-3">
            Received <span className="num text-[0.95rem] font-semibold text-ink-2">{money(tripReceived(trip))}</span> of{' '}
            <span className="num text-[0.95rem] font-semibold text-ink-2">{money(trip.fare)}</span>
          </p>
        </div>
        <span className="num pt-0.5 text-[1.3rem] font-semibold leading-none text-ink">{money(due)}</span>
      </Link>
      <div className="flex gap-2 px-4 pb-3.5 pt-3">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            <Phone size={15} /> Call {trip.customerName.split(' ')[0] || 'customer'}
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              setTimeout(() => setArmed(false), 3500);
              return;
            }
            actions.recordPayment(trip.id, due);
          }}
          className={`ml-auto inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
            armed ? 'bg-shell text-white' : 'border border-line text-ink hover:border-ink-3'
          }`}
        >
          {armed ? 'Tap again to confirm' : `Mark ${money(due)} received`}
        </button>
      </div>
    </li>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarView({ month }: { month: string }) {
  const data = useData();
  const today = todayISO();
  const [picked, setPicked] = useState<string | null>(null);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = parseISO(`${month}-01`).getDay();
  const selected = picked && picked.startsWith(month) ? picked : today.startsWith(month) ? today : `${month}-01`;
  const dayTrips = tripsOnDay(data, selected);

  return (
    <>
      <div className="mt-5 rounded-xl border border-line bg-surface p-2" role="grid" aria-label={`Trips in ${fmtMonth(month)}`}>
        <div className="grid grid-cols-7 pb-1" role="row">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="py-1.5 text-center text-[0.72rem] font-semibold text-ink-3">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="rowgroup">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`lead-${i}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`;
            const list = tripsOnDay(data, date);
            const isSel = date === selected;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${fmtDay(date)}: ${list.length ? `${list.length} ${list.length === 1 ? 'trip' : 'trips'}` : 'no trips'}`}
                onClick={() => setPicked(date)}
                className={`flex h-14 flex-col items-center justify-start gap-1 rounded-lg pt-1.5 transition-colors ${
                  isSel ? 'bg-plate text-plate-ink shadow-[inset_0_0_0_1.5px_rgb(17_17_17/0.85)]' : 'hover:bg-black/[0.04]'
                } ${isToday && !isSel ? 'ring-1 ring-inset ring-ink' : ''}`}
              >
                <span className={`num text-[1rem] leading-none ${isSel || isToday ? 'font-bold' : 'font-medium text-ink-2'}`}>{i + 1}</span>
                <span className="flex gap-0.5" aria-hidden>
                  {list.slice(0, 3).map((t) => {
                    const st = tripStatus(t, today);
                    return (
                      <span
                        key={t.id}
                        className={`h-1.5 w-1.5 rounded-full ${st === 'upcoming' ? 'ring-1 ring-inset ring-ink bg-transparent' : isSel ? 'bg-plate-ink' : 'bg-ink'}`}
                      />
                    );
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 flex gap-4 px-1 text-[0.75rem] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden /> Trip
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-ink" aria-hidden /> Booking
        </span>
      </p>

      <SectionTitle>{fmtDay(selected)}</SectionTitle>
      {dayTrips.length === 0 ? (
        <Empty title="No trips this day">
          <Link to="/trips/new" className="font-semibold text-ink-2 underline underline-offset-2">
            Log a trip
          </Link>{' '}
          or a booking for any date.
        </Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {dayTrips.map((t) => (
            <TripRow key={t.id} trip={t} showDate />
          ))}
        </ul>
      )}
    </>
  );
}
