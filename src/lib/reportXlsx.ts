import writeXlsxFile, { type Cell, type CellObject, type Row, type Sheet } from 'write-excel-file/universal';
import type { ReportData } from './report';
import { costsByType, tripDue, tripExpense, tripProfit, tripReceived, tripStatus } from './calc';
import { TRIP_COST_TYPES } from './types';
import { formatPlate } from './vehicle';

/**
 * The period report as an Excel workbook: a Summary sheet with the same figures as the PDF,
 * then one sheet per list (trips, company expenses, by vehicle, trend, money to collect,
 * bookings, partner capital). Dates are real dates and money is numbers, so the sheets sort,
 * filter and add up in Excel or Google Sheets.
 */

const NAVY = '#002050';
const TINT = '#F1F3F7';
const RUPEES = '"₹"#,##0';
const DATE = 'dd-mmm-yyyy';

const head = (labels: string[]): Row =>
  labels.map((value) => ({ value, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: NAVY, alignVertical: 'center' }) as CellObject);
const date = (iso: string | null): Cell => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: DATE };
};
const rupees = (n: number, bold = false): Cell => ({ value: Math.round(n * 100) / 100, type: Number, format: RUPEES, ...(bold ? { fontWeight: 'bold' } : {}) });
const count = (n: number, bold = false): Cell => ({ value: n, type: Number, format: '#,##0', ...(bold ? { fontWeight: 'bold' } : {}) });
const percent = (n: number): Cell => ({ value: n, type: Number, format: '0%' });
const bold = (value: string): Cell => ({ value, fontWeight: 'bold' });
const totalRow = (cells: Cell[]): Row => cells.map((c) => (c && typeof c === 'object' ? { ...c, backgroundColor: TINT, fontWeight: 'bold' } : { value: c ?? '', backgroundColor: TINT, fontWeight: 'bold' })) as Row;
const widths = (...w: number[]) => w.map((width) => ({ width }));

export function reportXlsxSheets(r: ReportData): Sheet<Blob>[] {
  const t = r.totals;
  const a = r.averages;
  const status = (s: ReturnType<typeof tripStatus>) => (s === 'done' ? 'Completed' : s === 'ongoing' ? 'On trip' : 'Upcoming');

  // ------------------------------------------------------------ Summary
  const summary: Row[] = [
    [{ value: 'Covenant Travels · Business report', fontWeight: 'bold', fontSize: 14, textColor: NAVY }],
    [{ value: r.title, fontWeight: 'bold', fontSize: 12 }],
    ['Period', date(r.from), 'to', date(r.to)],
    ['Generated', date(r.generated)],
    [],
    head(['Figure', 'Amount', 'Note']),
    [bold('Net profit'), rupees(t.net, true), 'Trip profit − company expenses'],
    ['Fares', rupees(t.fares), 'Agreed fares of finished trips'],
    ['Trip expenses', rupees(t.tripCost), 'Fuel, toll, parking, bata and more'],
    [bold('Trip profit'), rupees(t.tripProfit, true), 'Fares − trip expenses'],
    ['Company expenses', rupees(t.companyExpenses), 'Service, repairs, EMI, salary…'],
    ['Payments received', rupees(t.paymentsReceived), 'By the date the money came in'],
    ['To collect', rupees(t.due), 'Still owed on these finished trips'],
    ['Bookings and trips still running', rupees(t.openFares), `${t.openTrips} not counted until finished`],
    [],
    head(['Activity', 'Value', '']),
    ['Finished trips', count(t.tripCount)],
    ['Distance (km)', count(t.km)],
    ['Profit per trip', a.profitPerTrip === null ? '' : rupees(a.profitPerTrip)],
    ['Profit per km', a.profitPerKm === null ? '' : { value: Math.round(a.profitPerKm * 100) / 100, type: Number, format: '"₹"#,##0.00' }],
    ['Net per day', a.netPerDay === null ? '' : rupees(a.netPerDay)],
    ['Days with trips', `${a.activeDays} of ${a.days}`],
    [],
    head(['Trip expenses by type', 'Amount', 'Share']),
    ...r.tripCostByType.map((s): Row => [s.label, rupees(s.amount), percent(s.share)]),
    totalRow(['Total', rupees(t.tripCost), percent(t.tripCost ? 1 : 0)]),
    [],
    head(['Company expenses by type', 'Amount', 'Share']),
    ...r.expenseByCategory.map((s): Row => [s.label, rupees(s.amount), percent(s.share)]),
    totalRow(['Total', rupees(t.companyExpenses), percent(t.companyExpenses ? 1 : 0)]),
  ];

  // ------------------------------------------------------------ Trips (finished, counted)
  const tripHead = ['Start date', 'End date', 'Customer', 'Phone', 'Vehicle', 'From', 'To', 'Start km', 'End km', 'Km', 'Fare', 'Received', 'Due', ...TRIP_COST_TYPES, 'Total expenses', 'Profit'];
  const trips: Row[] = [
    head(tripHead),
    ...r.trips.map((trip): Row => {
      const by = costsByType(trip);
      return [
        date(trip.date),
        date(trip.endDate),
        trip.customerName,
        trip.customerPhone,
        trip.vehicle ? formatPlate(trip.vehicle) : '',
        trip.from,
        trip.to,
        trip.startKm ?? null,
        trip.endKm ?? null,
        count(trip.km),
        rupees(trip.fare),
        rupees(tripReceived(trip)),
        rupees(tripDue(trip)),
        ...TRIP_COST_TYPES.map((k) => rupees(by[k] ?? 0)),
        rupees(tripExpense(trip)),
        rupees(tripProfit(trip), true),
      ];
    }),
    totalRow([
      'Total', null, null, null, null, null, null, null, null, count(t.km), rupees(t.fares),
      rupees(r.trips.reduce((s, x) => s + tripReceived(x), 0)), rupees(t.due),
      ...TRIP_COST_TYPES.map((k) => rupees(r.trips.reduce((s, x) => s + (costsByType(x)[k] ?? 0), 0))),
      rupees(t.tripCost), rupees(t.tripProfit),
    ]),
  ];

  // ------------------------------------------------------------ Company expenses
  const expenses: Row[] = [
    head(['Date', 'Type', 'Description', 'Vehicle', 'Odometer (km)', 'Amount']),
    ...r.expenses.map((e): Row => [date(e.date), e.category, e.description, e.vehicleId ? (r.vehicleNames[e.vehicleId] ?? '') : '', e.odometerKm ?? null, rupees(e.amount)]),
    totalRow(['Total', null, null, null, null, rupees(t.companyExpenses)]),
  ];

  // ------------------------------------------------------------ By vehicle
  const vehicles: Row[] = [
    head(['Vehicle', 'Trips', 'Km', 'Fares', 'Trip expenses', 'Trip profit', 'Company expenses', 'Net']),
    ...r.byVehicle.map((v): Row => [v.vehicle, count(v.trips), count(v.km), rupees(v.fares), rupees(v.tripCost), rupees(v.tripProfit), rupees(v.companyExpenses), rupees(v.net, true)]),
    totalRow(['Total', count(t.tripCount), count(t.km), rupees(t.fares), rupees(t.tripCost), rupees(t.tripProfit), rupees(t.companyExpenses), rupees(t.net)]),
  ];

  // ------------------------------------------------------------ Trend
  const trend: Row[] = r.trend
    ? [
        head([r.trend.unit === 'day' ? 'Day' : 'Month', 'Trips', 'Fares', 'Trip expenses', 'Trip profit', 'Company expenses', 'Net']),
        ...r.trend.buckets.map((b): Row => [
          r.trend!.unit === 'day' ? date(b.key) : b.label,
          count(b.trips),
          rupees(b.fares),
          rupees(b.tripCost),
          rupees(b.tripProfit),
          rupees(b.companyExpenses),
          rupees(b.net, true),
        ]),
        totalRow(['Total', count(t.tripCount), rupees(t.fares), rupees(t.tripCost), rupees(t.tripProfit), rupees(t.companyExpenses), rupees(t.net)]),
      ]
    : [];

  // ------------------------------------------------------------ To collect, bookings, capital
  const dues: Row[] = [
    head(['Trip date', 'Customer', 'Phone', 'From', 'To', 'Fare', 'Received', 'To collect']),
    ...r.dues.map(({ trip, due }): Row => [date(trip.date), trip.customerName, trip.customerPhone, trip.from, trip.to, rupees(trip.fare), rupees(tripReceived(trip)), rupees(due, true)]),
    totalRow(['Total', null, null, null, null, null, null, rupees(t.due)]),
  ];
  const open: Row[] = [
    head(['Starts', 'Ends', 'Status', 'Customer', 'Phone', 'From', 'To', 'Fare', 'Advance received', 'Balance']),
    ...r.openTripList.map((trip): Row => [
      date(trip.date), date(trip.endDate), status(tripStatus(trip, r.generated)), trip.customerName, trip.customerPhone, trip.from, trip.to,
      rupees(trip.fare), rupees(tripReceived(trip)), rupees(tripDue(trip)),
    ]),
  ];
  const capital: Row[] = [
    head(['Partner', 'Added in this period', 'Total to date']),
    ...r.capital.map((c): Row => [c.partner, rupees(c.inPeriod), rupees(c.total)]),
    totalRow(['Total', rupees(r.capital.reduce((s, c) => s + c.inPeriod, 0)), rupees(r.capital.reduce((s, c) => s + c.total, 0))]),
  ];

  const sheets: Sheet<Blob>[] = [
    { sheet: 'Summary', data: summary, columns: widths(34, 16, 40, 14) },
    { sheet: 'Trips', data: trips, columns: widths(12, 12, 20, 15, 14, 20, 24, 10, 10, 8, 11, 11, 11, ...TRIP_COST_TYPES.map(() => 11), 14, 12), stickyRowsCount: 1 },
    { sheet: 'Company expenses', data: expenses, columns: widths(12, 16, 36, 14, 14, 12), stickyRowsCount: 1 },
    { sheet: 'By vehicle', data: vehicles, columns: widths(16, 8, 10, 12, 14, 12, 17, 12), stickyRowsCount: 1 },
  ];
  if (trend.length) sheets.push({ sheet: r.trend!.unit === 'day' ? 'By day' : 'By month', data: trend, columns: widths(14, 8, 12, 14, 12, 17, 12), stickyRowsCount: 1 });
  sheets.push({ sheet: 'To collect', data: dues, columns: widths(12, 20, 15, 20, 24, 12, 12, 12), stickyRowsCount: 1 });
  if (r.openTripList.length) sheets.push({ sheet: 'Bookings', data: open, columns: widths(12, 12, 11, 20, 15, 20, 24, 12, 16, 12), stickyRowsCount: 1 });
  sheets.push({ sheet: 'Partner capital', data: capital, columns: widths(22, 20, 16), stickyRowsCount: 1 });
  return sheets;
}

export async function buildReportXlsx(r: ReportData): Promise<Blob> {
  return writeXlsxFile(reportXlsxSheets(r), { fontFamily: 'Calibri', fontSize: 11 }).toBlob();
}
