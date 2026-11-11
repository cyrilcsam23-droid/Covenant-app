import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { Trip } from '../lib/types';
import { costsByType, tripAdvance, tripDays, tripDue, tripProfit, tripStatus } from '../lib/calc';
import { daysBetween, fmtRange, money, num, todayISO } from '../lib/format';
import { motionTokens } from '../lib/motion';
import { ResultPlate } from './Plate';

function costLine(t: Trip) {
  const byType = costsByType(t);
  const parts = Object.entries(byType).map(([k, v]) => `${k} ${money(v ?? 0)}`);
  return parts.length ? parts.join(' · ') : 'No expenses yet';
}

/** "Today", "Tomorrow", "In 5 days". */
export function untilLabel(date: string, today = todayISO()) {
  const d = daysBetween(today, date);
  return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
}

/** Small status label used where a trip has no result yet. */
export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'dark' | 'due' }) {
  const cls =
    tone === 'dark'
      ? 'bg-shell text-white'
      : tone === 'due'
        ? 'bg-surface text-ink ring-1 ring-inset ring-ink/70'
        : 'bg-[#e4e4de] text-ink';
  return <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[0.75rem] font-semibold ${cls}`}>{children}</span>;
}

export function TripRow({
  trip,
  fresh = false,
  showDate = false,
  aside,
}: {
  trip: Trip;
  fresh?: boolean;
  /** Show the trip's dates (lists not already grouped by day). */
  showDate?: boolean;
  /** Replaces the right-hand plate (e.g. a due amount). */
  aside?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLLIElement>(null);
  const status = tripStatus(trip);
  const multiDay = trip.endDate !== trip.date;
  const due = tripDue(trip);

  useEffect(() => {
    if (fresh) ref.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [fresh, reduce]);

  const meta: string[] = [];
  if (showDate || multiDay) meta.push(fmtRange(trip.date, trip.endDate));
  if (trip.customerName) meta.push(trip.customerName);

  let detail: ReactNode;
  if (status === 'upcoming') {
    const adv = tripAdvance(trip);
    detail = (
      <>
        {untilLabel(trip.date)}
        {adv > 0 && (
          <>
            {' · '}Advance <span className="num text-[0.95rem] font-semibold text-ink-2">{money(adv)}</span>
          </>
        )}
        {trip.fare > 0 && (
          <>
            {' · '}Fare <span className="num text-[0.95rem] font-semibold text-ink-2">{money(trip.fare)}</span>
          </>
        )}
      </>
    );
  } else {
    detail = (
      <>
        {trip.km > 0 && (
          <>
            <span className="num text-[0.95rem] font-semibold text-ink-2">{num(trip.km)} km</span>
            <span aria-hidden> · </span>
          </>
        )}
        {costLine(trip)}
      </>
    );
  }

  let right: ReactNode = aside;
  if (right === undefined) {
    if (status === 'upcoming') right = <StatusPill>Upcoming</StatusPill>;
    else if (status === 'ongoing') right = <StatusPill tone="dark">On trip · Day {tripDays(trip).length}</StatusPill>;
    else right = <ResultPlate value={tripProfit(trip)} />;
  }

  return (
    <motion.li
      ref={ref}
      initial={fresh ? { opacity: 0, y: reduce ? 0 : -motionTokens.distance.sm, backgroundColor: 'rgba(245,197,24,0.45)' } : false}
      animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,1)' }}
      transition={{
        duration: motionTokens.duration.slow,
        ease: motionTokens.easing.smooth,
        backgroundColor: { duration: motionTokens.duration.crawl * 1.6, ease: motionTokens.easing.smooth },
      }}
      className="bg-surface"
    >
      <Link to={`/trips/${trip.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.03]">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
            <span className="truncate">{trip.from || 'Start'}</span>
            <ArrowRight size={15} className="shrink-0 text-ink-3" aria-label="to" />
            <span className="truncate">{trip.to || 'End'}</span>
          </p>
          {meta.length > 0 && <p className="mt-0.5 truncate text-[0.83rem] font-medium text-ink-2">{meta.join(' · ')}</p>}
          <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">{detail}</p>
          {status === 'done' && due > 0 && aside === undefined && (
            <p className="mt-1 text-[0.83rem] font-semibold text-ink">
              <span className="num text-[0.95rem]">{money(due)}</span> to collect
            </p>
          )}
          {trip.notes && <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">{trip.notes}</p>}
        </div>
        {right}
      </Link>
    </motion.li>
  );
}
