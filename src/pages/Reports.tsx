import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileDown, FileSpreadsheet, FileText, Share2 } from 'lucide-react';
import { useData } from '../lib/store';
import { buildReportData } from '../lib/report';
import { periodFromParam, periodPhrase, periodToParam, type Period } from '../lib/period';
import { money, monthOf, num, todayISO } from '../lib/format';
import { ShellHeader, Page } from '../components/Layout';
import { PeriodPicker } from '../components/PeriodPicker';
import { ResultPlate } from '../components/Plate';
import { Button, Empty, SectionTitle } from '../components/ui';

type Kind = 'pdf' | 'xlsx';
type Busy = `${'share' | 'save'}-${Kind}` | null;

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function canShare(type: string, name: string) {
  try {
    const probe = new File(['x'], name, { type });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** A summary of any period as a branded PDF or an Excel workbook (opened from More or Home). */
export default function Reports() {
  const data = useData();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const period = periodFromParam(params.get('p'), { kind: 'month', month: monthOf(today) });
  const setPeriod = (p: Period) => setParams({ p: periodToParam(p) }, { replace: true });
  const phrase = periodPhrase(period, today);
  const r = useMemo(() => buildReportData(data, period, today), [data, period, today]);
  const t = r.totals;
  const empty = t.tripCount === 0 && r.expenses.length === 0 && r.openTripList.length === 0;

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const share = useMemo(() => ({ pdf: canShare('application/pdf', 'r.pdf'), xlsx: canShare(XLSX_TYPE, 'r.xlsx') }), []);

  const run = async (action: 'share' | 'save', kind: Kind) => {
    setBusy(`${action}-${kind}`);
    setError('');
    try {
      const m = await import('../lib/reportShare'); // PDF and Excel makers load only now
      if (action === 'share') await m.shareReport(r, kind);
      else await m.downloadReport(r, kind);
    } catch {
      setError('Couldn’t make the report. Check the internet connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const rows: [string, number, boolean?][] = [
    ['Fares', t.fares],
    ['Trip expenses', -t.tripCost],
    ['Trip profit', t.tripProfit, true],
    ['Company expenses', -t.companyExpenses],
  ];

  return (
    <>
      <ShellHeader>
        <Link to="/more" className="-ml-1 inline-flex items-center gap-0.5 text-sm font-medium text-shell-muted hover:text-white">
          <ChevronLeft size={18} /> More
        </Link>
        <h1 className="mt-1 text-[1.35rem] font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-shell-muted">A summary of any period, as a PDF to share or an Excel file for accounts.</p>
        <div className="mt-4">
          <PeriodPicker name="Report period" value={period} onChange={setPeriod} />
        </div>
        <div className="mt-6 flex flex-col items-center text-center">
          <p className="text-[0.95rem] font-medium text-shell-muted">Net {t.net < 0 ? 'loss' : 'profit'} {phrase}</p>
          <ResultPlate value={t.net} size="lg" className="mt-3" />
          <p className="mt-3 text-sm text-shell-muted">
            {t.tripCount} finished {t.tripCount === 1 ? 'trip' : 'trips'} · {num(t.km)} km
          </p>
        </div>
      </ShellHeader>

      <Page>
        {empty ? (
          <div className="mt-6">
            <Empty title={`Nothing recorded ${phrase}`}>Pick another day, month or range above.</Empty>
          </div>
        ) : (
          <>
            <SectionTitle>In this report</SectionTitle>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {rows.map(([label, value, strong]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className={strong ? 'font-semibold' : 'text-ink-2'}>{label}</span>
                  <span className={`num text-[1.15rem] font-semibold ${value < 0 ? 'text-loss' : ''}`}>
                    {value < 0 ? '−' : ''}
                    {money(Math.abs(value))}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="font-semibold">Net</span>
                <ResultPlate value={t.net} />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-ink-2">Still to collect</span>
                <span className="num text-[1.15rem] font-semibold">{money(t.due)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-ink-2">Payments received</span>
                <span className="num text-[1.15rem] font-semibold">{money(t.paymentsReceived)}</span>
              </div>
            </div>
            {t.openTrips > 0 && (
              <p className="mt-2 px-1 text-sm text-ink-3">
                {t.openTrips} {t.openTrips === 1 ? 'booking or trip is' : 'bookings or trips are'} still running ({money(t.openFares)} in fares). They count once
                finished.
              </p>
            )}

            <Format
              icon={<FileText size={20} />}
              title="PDF report"
              text="Summary, trend, where the money went, each vehicle, money to collect, bookings, partner capital, and every trip and expense."
              kind="pdf"
              canShare={share.pdf}
              busy={busy}
              onRun={run}
            />
            <Format
              icon={<FileSpreadsheet size={20} />}
              title="Excel workbook"
              text="The same figures on separate sheets (Summary, Trips, Company expenses, By vehicle, By day or month, To collect, Partner capital), ready to sort, filter and add up."
              kind="xlsx"
              canShare={share.xlsx}
              busy={busy}
              onRun={run}
            />
            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-loss">
                {error}
              </p>
            )}
          </>
        )}
        <div className="h-8" />
      </Page>
    </>
  );
}

function Format({
  icon,
  title,
  text,
  kind,
  canShare,
  busy,
  onRun,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  kind: Kind;
  canShare: boolean;
  busy: Busy;
  onRun: (action: 'share' | 'save', kind: Kind) => void;
}) {
  const primary = kind === 'pdf';
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex gap-3">
          <span className="mt-0.5 text-ink-3" aria-hidden>
            {icon}
          </span>
          <p className="text-sm text-ink-2">{text}</p>
        </div>
        <div className={`mt-4 grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canShare && (
            <Button variant={primary ? 'primary' : 'outline'} className="w-full" disabled={busy !== null} onClick={() => onRun('share', kind)}>
              <Share2 size={18} /> {busy === `share-${kind}` ? 'Preparing…' : 'Share'}
            </Button>
          )}
          <Button
            variant={primary && !canShare ? 'primary' : 'outline'}
            className="w-full"
            disabled={busy !== null}
            onClick={() => onRun('save', kind)}
          >
            <FileDown size={18} /> {busy === `save-${kind}` ? 'Preparing…' : canShare ? 'Download' : `Download ${kind === 'pdf' ? 'PDF' : 'Excel'}`}
          </Button>
        </div>
      </div>
    </>
  );
}
