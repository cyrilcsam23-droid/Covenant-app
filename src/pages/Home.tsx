import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import { useData } from '../lib/store';
import { dailyProfit, dues, groupByDay, ongoingTrips, partnerTotals, summarize, upcomingTrips, type Period } from '../lib/calc';
import { fmtDay, fmtMonth, money, monthOf, num, todayISO } from '../lib/format';
import { ShellHeader, Page } from '../components/Layout';
import { ResultPlate, RollingMoney, VehiclePlate } from '../components/Plate';
import { Button, Empty, Segmented, SectionTitle } from '../components/ui';
import { TripRow } from '../components/TripRow';
import { SampleNotice } from '../components/SampleNotice';

type Range = 'today' | 'month' | 'all';

export default function Home() {
  const data = useData();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>('today');
  const today = todayISO();
  const month = monthOf(today);
  const period: Period =
    range === 'today' ? { kind: 'day', date: today } : range === 'month' ? { kind: 'month', month } : { kind: 'all' };
  const s = summarize(data, period);
  const resultWord = s.tripProfit < 0 ? 'Loss' : 'Profit';
  const rangeLabel = range === 'today' ? 'today' : range === 'month' ? `in ${fmtMonth(month)}` : 'all time';

  return (
    <>
      <ShellHeader>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[1.05rem] font-semibold">{data.settings.businessName}</p>
          <VehiclePlate number={data.settings.defaultVehicle} />
        </div>

        <div className="mt-4">
          <Segmented
            dark
            name="Period"
            value={range}
            onChange={setRange}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'month', label: 'This month' },
              { value: 'all', label: 'All time' },
            ]}
          />
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <h1 className="text-[0.95rem] font-medium text-shell-muted">
            Trip {resultWord.toLowerCase()} {rangeLabel}
          </h1>
          <ResultPlate value={s.tripProfit} size="lg" className="mt-3" />
          <p className="mt-3 text-sm text-shell-muted">
            {s.tripCount === 0 ? 'No finished trips yet' : `${s.tripCount} finished ${s.tripCount === 1 ? 'trip' : 'trips'}`}
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-3 divide-x divide-shell-line rounded-xl bg-shell-2">
          <Stat label="Fares" value={<RollingMoney value={s.fares} />} />
          <Stat label="Trip expenses" value={<RollingMoney value={s.tripCost} />} />
          <Stat label="Distance" value={`${num(s.km)} km`} />
        </dl>
      </ShellHeader>

      <Page>
        <Button className="mt-4 h-14 w-full text-[1.05rem]" onClick={() => navigate('/trips/new')}>
          <Plus size={22} strokeWidth={2.6} /> Log trip
        </Button>

        {data.isSample && <SampleNotice />}

        <Ahead />

        {range === 'month' && <MonthChart month={month} />}

        <TripsSection range={range} trips={s.trips} />

        <SectionTitle>After partner expenses</SectionTitle>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <Line label="Trip profit" value={s.tripProfit} />
          <Line label="Paid by partners (maintenance etc.)" value={-s.partnerPaid} />
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="font-semibold">Net {rangeLabel}</span>
            <ResultPlate value={s.net} />
          </div>
        </div>

        <SectionTitle
          action={
            <Link to="/partners" className="flex items-center text-sm font-semibold text-ink-2 hover:text-ink">
              Details <ChevronRight size={16} />
            </Link>
          }
        >
          Put in by partners
        </SectionTitle>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {partnerTotals(data).map(({ partner, capital, paid, total }) => (
            <li key={partner.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{partner.name}</p>
                <p className="text-[0.83rem] text-ink-3">
                  Capital {money(capital)} · Paid {money(paid)}
                </p>
              </div>
              <span className="num text-[1.25rem] font-semibold">{money(total)}</span>
            </li>
          ))}
        </ul>
        <div className="h-8" />
      </Page>
    </>
  );
}

/** What needs attention: trips on the road, money still owed, the next bookings. */
function Ahead() {
  const data = useData();
  const ongoing = ongoingTrips(data);
  const owed = dues(data);
  const next = upcomingTrips(data).slice(0, 3);
  if (ongoing.length === 0 && owed.total === 0 && next.length === 0) return null;

  return (
    <>
      {ongoing.length > 0 && (
        <>
          <SectionTitle>On trip now</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {ongoing.map((t) => (
              <TripRow key={t.id} trip={t} showDate />
            ))}
          </ul>
        </>
      )}

      {owed.total > 0 && (
        <Link
          to="/trips?view=dues"
          className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 hover:border-ink-3"
        >
          <span className="min-w-0">
            <span className="block font-semibold">To collect</span>
            <span className="block truncate text-[0.83rem] text-ink-3">
              From {owed.trips.length} finished {owed.trips.length === 1 ? 'trip' : 'trips'}, oldest {fmtDay(owed.trips[0].date)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="num text-[1.3rem] font-semibold">{money(owed.total)}</span>
            <ChevronRight size={18} className="text-ink-3" />
          </span>
        </Link>
      )}

      {next.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link to="/trips?view=upcoming" className="flex items-center text-sm font-semibold text-ink-2 hover:text-ink">
                All bookings <ChevronRight size={16} />
              </Link>
            }
          >
            Coming up
          </SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {next.map((t) => (
              <TripRow key={t.id} trip={t} showDate />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-2 py-3 text-center">
      <dt className="text-[0.75rem] font-medium text-shell-muted">{label}</dt>
      <dd className="num mt-0.5 text-[1.3rem] font-semibold leading-tight text-white">{value}</dd>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-ink-2">{label}</span>
      <span className={`num text-[1.15rem] font-semibold ${value < 0 ? 'text-loss' : ''}`}>
        {value < 0 ? '−' : ''}
        {money(Math.abs(value))}
      </span>
    </div>
  );
}

function TripsSection({ range, trips }: { range: Range; trips: ReturnType<typeof summarize>['trips'] }) {
  const title = range === 'today' ? 'Today’s trips' : range === 'month' ? 'This month’s trips' : 'Recent trips';
  const days = groupByDay(trips).slice(0, range === 'today' ? 1 : 4);
  return (
    <>
      <SectionTitle
        action={
          <Link to="/trips" className="flex items-center text-sm font-semibold text-ink-2 hover:text-ink">
            All trips <ChevronRight size={16} />
          </Link>
        }
      >
        {title}
      </SectionTitle>
      {days.length === 0 ? (
        <Empty title={range === 'today' ? 'No trips logged today' : 'No trips yet'}>
          Tap <strong className="font-semibold text-ink-2">Log trip</strong> after each drop.
        </Empty>
      ) : (
        <div className="space-y-4">
          {days.map((d) => (
            <div key={d.date}>
              {range !== 'today' && (
                <p className="mb-1.5 px-1 text-[0.83rem] font-semibold text-ink-3">{fmtDay(d.date)}</p>
              )}
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {d.trips.map((t) => (
                  <TripRow key={t.id} trip={t} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Profit for each day of the month: bars up for profit, red bars down for loss. */
function MonthChart({ month }: { month: string }) {
  const data = useData();
  const days = dailyProfit(data, month);
  const today = todayISO();
  const max = Math.max(1, ...days.map((d) => Math.abs(d.profit)));
  const hasLoss = days.some((d) => d.profit < 0);
  const best = days.reduce((a, b) => (b.profit > a.profit ? b : a), days[0]);
  const H = 72;
  const down = hasLoss ? 28 : 0;

  return (
    <>
      <SectionTitle>Profit by day</SectionTitle>
      <figure className="rounded-xl border border-line bg-surface px-4 pb-3 pt-4">
        <div
          className="flex items-stretch gap-[3px]"
          style={{ height: H + down }}
          role="img"
          aria-label={`Daily trip profit for ${fmtMonth(month)}. Best day ${fmtDay(best.date)}, ${money(best.profit)}.`}
        >
          {days.map((d) => {
            const h = (Math.abs(d.profit) / max) * (d.profit >= 0 ? H : down || H);
            return (
              <div key={d.date} className="relative flex-1" title={`${fmtDay(d.date)}: ${money(d.profit)}`}>
                <div className="absolute inset-x-0 border-t border-line" style={{ top: H }} />
                {d.profit !== 0 && (
                  <div
                    className={`absolute inset-x-0 rounded-[2px] ${
                      d.profit < 0 ? 'bg-loss' : d.date === today ? 'bg-plate shadow-[inset_0_0_0_1px_#111]' : 'bg-shell'
                    }`}
                    style={d.profit >= 0 ? { top: H - Math.max(h, 2), height: Math.max(h, 2) } : { top: H, height: Math.max(h, 2) }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <figcaption className="mt-2 flex justify-between text-[0.75rem] text-ink-3">
          <span>1</span>
          <span>
            Best day: {fmtDay(best.date)}, <span className="num text-[0.9rem] font-semibold text-ink-2">{money(best.profit)}</span>
          </span>
          <span>{days.length}</span>
        </figcaption>
      </figure>
    </>
  );
}
