import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { useData } from '../lib/store';
import { partnerTotals } from '../lib/calc';
import { fmtDate, money } from '../lib/format';
import { ShellHeader, Page } from '../components/Layout';
import { Plate, RollingMoney } from '../components/Plate';
import { Button, Empty, SectionTitle } from '../components/ui';

/** Capital each partner has put into the business (opened from More). */
export default function Partners() {
  const data = useData();
  const navigate = useNavigate();
  const totals = partnerTotals(data);
  const grand = totals.reduce((s, t) => s + t.capital, 0);
  const nameOf = (id: string) => data.partners.find((p) => p.id === id)?.name ?? 'Unknown partner';
  const entries = [...data.capital].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <ShellHeader>
        <Link to="/more" className="-ml-1 inline-flex items-center gap-0.5 text-sm font-medium text-shell-muted hover:text-white">
          <ChevronLeft size={18} /> More
        </Link>
        <h1 className="mt-1 text-[1.35rem] font-semibold">Partners</h1>
        <div className="mt-4">
          <p className="text-sm text-shell-muted">Capital put into the business</p>
          <Plate size="md" className="mt-2" label={`Total capital ${money(grand)}`}>
            <RollingMoney value={grand} />
          </Plate>
        </div>

        <ul className="mt-5 space-y-3">
          {totals.map(({ partner, capital }) => (
            <li key={partner.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold">{partner.name}</span>
                <span className="num text-[1.25rem] font-semibold">{money(capital)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-shell-2" aria-hidden>
                <div className="h-full rounded-full bg-plate" style={{ width: grand ? `${(capital / grand) * 100}%` : 0 }} />
              </div>
              {grand > 0 && <p className="mt-1 text-[0.8rem] text-shell-muted">{Math.round((capital / grand) * 100)}% of the capital</p>}
            </li>
          ))}
        </ul>
      </ShellHeader>

      <Page>
        <Button className="mt-4 w-full" onClick={() => navigate('/partners/capital/new')}>
          <Plus size={20} strokeWidth={2.6} /> Add capital
        </Button>

        <SectionTitle>Capital entries</SectionTitle>
        {entries.length === 0 ? (
          <Empty title="No capital recorded yet">Record what each partner has put in. More can be added any time.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {entries.map((e) => (
              <li key={e.id}>
                <Link to={`/partners/capital/${e.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.note || 'Capital added'}</p>
                    <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">
                      {nameOf(e.partnerId)} · {fmtDate(e.date)}
                    </p>
                  </div>
                  <span className="num text-[1.2rem] font-semibold">{money(e.amount)}</span>
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
