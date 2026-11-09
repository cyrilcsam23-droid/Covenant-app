import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { Trip } from '../lib/types';
import { tripProfit } from '../lib/calc';
import { money, num } from '../lib/format';
import { motionTokens } from '../lib/motion';
import { ResultPlate } from './Plate';

function costLine(t: Trip) {
  const parts: string[] = [];
  if (t.fuel) parts.push(`Fuel ${money(t.fuel)}`);
  if (t.toll) parts.push(`Toll ${money(t.toll)}`);
  if (t.parking) parts.push(`Parking ${money(t.parking)}`);
  if (t.other) parts.push(`Other ${money(t.other)}`);
  return parts.length ? parts.join(' · ') : 'No expenses';
}

export function TripRow({ trip, fresh = false }: { trip: Trip; fresh?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (fresh) ref.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [fresh, reduce]);

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
          <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">
            <span className="num text-[0.95rem] font-semibold text-ink-2">{num(trip.km)} km</span>
            <span aria-hidden> · </span>
            {costLine(trip)}
          </p>
          {trip.notes && <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">{trip.notes}</p>}
        </div>
        <ResultPlate value={tripProfit(trip)} />
      </Link>
    </motion.li>
  );
}
