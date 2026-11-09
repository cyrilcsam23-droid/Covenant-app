import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { useData } from '../lib/store';
import { groupByDay, summarize, toCSV } from '../lib/calc';
import { fmtDay, fmtMonth, monthOf, num, signedMoney, todayISO } from '../lib/format';
import { ShellHeader, Page } from '../components/Layout';
import { ResultPlate } from '../components/Plate';
import { Button, Empty, IconButton, MonthSwitcher, downloadFile } from '../components/ui';
import { TripRow } from '../components/TripRow';

export default function Trips() {
  const data = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const savedId = (location.state as { savedId?: string } | null)?.savedId;
  const [params, setParams] = useSearchParams();
  const month = params.get('m') || monthOf(todayISO());
  const s = summarize(data, { kind: 'month', month });
  const days = groupByDay(s.trips);

  const exportCSV = () => downloadFile(`trips-${month}.csv`, toCSV(s.trips));

  return (
    <>
      <ShellHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-[1.35rem] font-semibold">Trips</h1>
          <div className="flex items-center gap-1">
            <IconButton label={`Download ${fmtMonth(month)} as CSV`} onClick={exportCSV} disabled={s.tripCount === 0} className="disabled:opacity-40">
              <Download size={20} />
            </IconButton>
            <Button className="!h-10 !rounded-lg !px-3 text-sm" onClick={() => navigate('/trips/new')}>
              <Plus size={18} strokeWidth={2.6} /> Log trip
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <MonthSwitcher month={month} onChange={(m) => setParams({ m }, { replace: true })} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-shell-muted">
            <span className="num text-[1.15rem] font-semibold text-white">{s.tripCount}</span> trips ·{' '}
            <span className="num text-[1.15rem] font-semibold text-white">{num(s.km)}</span> km
          </p>
          <ResultPlate value={s.tripProfit} size="md" />
        </div>
      </ShellHeader>

      <Page>
        {days.length === 0 ? (
          <div className="mt-6">
            <Empty title={`No trips in ${fmtMonth(month)}`}>Trips you log for this month will show up here, grouped by day.</Empty>
          </div>
        ) : (
          <div className="mt-5 space-y-5 pb-8">
            {days.map((d) => (
              <section key={d.date} aria-label={fmtDay(d.date)}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h2 className="text-[0.9rem] font-semibold text-ink">{fmtDay(d.date)}</h2>
                  <p className="text-[0.83rem] text-ink-3">
                    {d.trips.length} {d.trips.length === 1 ? 'trip' : 'trips'} · {num(d.km)} km ·{' '}
                    <span className={`num text-[0.95rem] font-semibold ${d.profit < 0 ? 'text-loss' : 'text-ink-2'}`}>
                      {signedMoney(d.profit)}
                    </span>
                  </p>
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {d.trips.map((t) => (
                    <TripRow key={t.id} trip={t} fresh={t.id === savedId} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Page>
    </>
  );
}
