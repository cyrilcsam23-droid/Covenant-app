import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, X } from 'lucide-react';
import { useData } from '../lib/store';
import { fmtDay, fmtMonth, money, monthOf, num, todayISO } from '../lib/format';
import { formatPlate } from '../lib/vehicle';
import type { Expense } from '../lib/types';
import { ShellHeader, Page } from '../components/Layout';
import { Button, Empty, IconButton, MonthSwitcher, downloadFile } from '../components/ui';

/** Company expenses outside trips, month by month. */
export default function Expenses() {
  const data = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const month = params.get('m') || monthOf(todayISO());
  const vehicleId = params.get('vehicle');
  const vehicle = vehicleId ? data.vehicles.find((v) => v.id === vehicleId) : undefined;
  const plateOf = (id: string | null) => {
    const v = id ? data.vehicles.find((x) => x.id === id) : undefined;
    return v ? formatPlate(v.number) : '';
  };

  const list = data.expenses
    .filter((e) => e.date.startsWith(month) && (!vehicle || e.vehicleId === vehicle.id))
    .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
  const total = list.reduce((s, e) => s + e.amount, 0);
  const byCategory = Object.entries(
    list.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const days = new Map<string, Expense[]>();
  for (const e of list) days.set(e.date, [...(days.get(e.date) ?? []), e]);

  const go = (m: string) => setParams(vehicle ? { m, vehicle: vehicle.id } : { m }, { replace: true });
  const exportCSV = () => {
    const esc = (v: unknown) => {
      let s = String(v ?? '');
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [['Date', 'Type', 'Description', 'Vehicle', 'Odometer', 'Amount'], ...[...list].reverse().map((e) => [e.date, e.category, e.description, plateOf(e.vehicleId), e.odometerKm ?? '', e.amount])];
    downloadFile(`expenses-${month}.csv`, rows.map((r) => r.map(esc).join(',')).join('\n'));
  };

  return (
    <>
      <ShellHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-[1.35rem] font-semibold">Expenses</h1>
          <div className="flex items-center gap-1">
            <IconButton label={`Download ${fmtMonth(month)} as a spreadsheet`} onClick={exportCSV} disabled={list.length === 0} className="disabled:opacity-40">
              <Download size={20} />
            </IconButton>
            <Button className="!h-10 !rounded-lg !px-3 text-sm" onClick={() => navigate(vehicle ? `/expenses/new?vehicle=${vehicle.id}` : '/expenses/new')}>
              <Plus size={18} strokeWidth={2.6} /> Add
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-shell-muted">Company costs outside trips: service, repairs, insurance, salary, EMI…</p>
        {vehicle && (
          <Link
            to={`/expenses?m=${month}`}
            replace
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-plate bg-plate px-3 text-sm font-semibold text-plate-ink"
            aria-label={`Showing ${formatPlate(vehicle.number)} only. Show all vehicles`}
          >
            {formatPlate(vehicle.number)} only <X size={15} />
          </Link>
        )}
        <div className="mt-4">
          <MonthSwitcher month={month} onChange={go} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="text-sm text-shell-muted">
            <span className="num text-[1.15rem] font-semibold text-white">{list.length}</span> {list.length === 1 ? 'expense' : 'expenses'}
          </p>
          <p className="num text-[1.6rem] font-bold leading-none text-white" aria-label={`Total ${money(total)}`}>
            {money(total)}
          </p>
        </div>
        {byCategory.length > 1 && (
          <p className="mt-2 text-[0.8rem] leading-relaxed text-shell-muted">
            {byCategory.map(([c, amt], i) => (
              <span key={c}>
                {i > 0 && ' · '}
                {c} <span className="num text-[0.95rem] font-semibold text-white">{money(amt)}</span>
              </span>
            ))}
          </p>
        )}
      </ShellHeader>

      <Page>
        {list.length === 0 ? (
          <div className="mt-6">
            <Empty title={`No expenses in ${fmtMonth(month)}`}>
              Service, repairs, tyres, insurance, driver salary, EMI: anything the business pays that isn’t part of a trip.
            </Empty>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {[...days.entries()].map(([date, items]) => (
              <section key={date} aria-label={fmtDay(date)}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h2 className="text-[0.9rem] font-semibold">{fmtDay(date)}</h2>
                  <p className="num text-[0.95rem] font-semibold text-ink-2">{money(items.reduce((s, e) => s + e.amount, 0))}</p>
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {items.map((e) => (
                    <li key={e.id}>
                      <Link to={`/expenses/${e.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.03]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{e.description}</p>
                          <p className="mt-0.5 truncate text-[0.83rem] text-ink-3">
                            {[e.category, plateOf(e.vehicleId), e.odometerKm != null ? `at ${num(e.odometerKm)} km` : ''].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className="num text-[1.15rem] font-semibold">{money(e.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className="h-8" />
      </Page>
    </>
  );
}
