import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData } from '../lib/store';
import { partnerTotals } from '../lib/calc';
import { fmtDate, money } from '../lib/format';
import { ShellHeader, Page } from '../components/Layout';
import { Plate, RollingMoney } from '../components/Plate';
import { Button, Empty, Segmented } from '../components/ui';

type Tab = 'capital' | 'expenses';

export default function Partners() {
  const data = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'expenses' ? 'expenses' : 'capital';
  const totals = partnerTotals(data);
  const grand = totals.reduce((s, t) => s + t.total, 0);
  const capitalTotal = totals.reduce((s, t) => s + t.capital, 0);
  const paidTotal = totals.reduce((s, t) => s + t.paid, 0);
  const nameOf = (id: string) => data.partners.find((p) => p.id === id)?.name ?? 'Unknown partner';

  const entries =
    tab === 'capital'
      ? [...data.capital]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((c) => ({ id: c.id, date: c.date, partnerId: c.partnerId, amount: c.amount, title: c.note || 'Capital added', tag: '' }))
      : [...data.expenses]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((e) => ({ id: e.id, date: e.date, partnerId: e.partnerId, amount: e.amount, title: e.description || e.category, tag: e.category }));

  return (
    <>
      <ShellHeader>
        <h1 className="text-[1.35rem] font-semibold">Partners</h1>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-shell-muted">Put into the business</p>
            <Plate size="md" className="mt-2" label={`Total ${money(grand)}`}>
              <RollingMoney value={grand} />
            </Plate>
          </div>
          <dl className="text-right text-sm text-shell-muted">
            <div>
              <dt className="inline">Capital </dt>
              <dd className="num inline text-[1.05rem] font-semibold text-white">{money(capitalTotal)}</dd>
            </div>
            <div className="mt-0.5">
              <dt className="inline">Expenses paid </dt>
              <dd className="num inline text-[1.05rem] font-semibold text-white">{money(paidTotal)}</dd>
            </div>
          </dl>
        </div>

        <ul className="mt-5 space-y-3">
          {totals.map(({ partner, capital, paid, total }) => (
            <li key={partner.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold">{partner.name}</span>
                <span className="num text-[1.25rem] font-semibold">{money(total)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-shell-2" aria-hidden>
                <div className="h-full rounded-full bg-plate" style={{ width: grand ? `${(total / grand) * 100}%` : 0 }} />
              </div>
              <p className="mt-1 text-[0.8rem] text-shell-muted">
                Capital {money(capital)} · Expenses paid {money(paid)}
                {grand > 0 && ` · ${Math.round((total / grand) * 100)}% of total`}
              </p>
            </li>
          ))}
        </ul>
      </ShellHeader>

      <Page>
        <div className="mt-4">
          <Segmented
            name="Entries"
            value={tab}
            onChange={(t) => setParams({ tab: t }, { replace: true })}
            options={[
              { value: 'capital', label: 'Capital' },
              { value: 'expenses', label: 'Expenses paid' },
            ]}
          />
        </div>

        <Button
          className="mt-4 w-full"
          onClick={() => navigate(tab === 'capital' ? '/partners/capital/new' : '/partners/expense/new')}
        >
          <Plus size={20} strokeWidth={2.6} /> {tab === 'capital' ? 'Add capital' : 'Add expense paid by a partner'}
        </Button>

        <div className="mt-4 pb-8">
          {entries.length === 0 ? (
            <Empty title={tab === 'capital' ? 'No capital recorded yet' : 'No partner expenses yet'}>
              {tab === 'capital'
                ? 'Record what each partner has put in. You can add more capital any time.'
                : 'Maintenance, repairs, tyres or anything a partner paid for out of pocket.'}
            </Empty>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {entries.map((e) => (
                <li key={e.id}>
                  <Link
                    to={tab === 'capital' ? `/partners/capital/${e.id}` : `/partners/expense/${e.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.title}</p>
                      <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">
                        {nameOf(e.partnerId)} · {fmtDate(e.date)}
                        {e.tag && e.tag !== e.title && ` · ${e.tag}`}
                      </p>
                    </div>
                    <span className="num text-[1.2rem] font-semibold">{money(e.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Page>
    </>
  );
}
