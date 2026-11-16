/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildReportData } from './report';
import { buildReportPdf, reportFileName } from './reportPdf';
import { buildReportXlsx } from './reportXlsx';
import type { PdfAssets } from './pdfKit';
import type { AppData, Trip, TripCostType } from './types';

const font = (subset: string, w: number) => new Uint8Array(readFileSync(`node_modules/@fontsource/poppins/files/poppins-${subset}-${w}-normal.woff`));
const assets: PdfAssets = {
  logo: new Uint8Array(readFileSync('public/brand/covenant-logo.png')),
  regular: font('latin', 400),
  medium: font('latin', 500),
  semibold: font('latin', 600),
  rupee: font('devanagari', 600),
};

const TODAY = '2026-11-16';
const places = ['Vyttila', 'Thrippunithura', 'Peruva', 'Eramalloor', 'Lulu Mall, Ernakulam', 'Kochi Airport', 'Munnar', 'Alappuzha', 'Kumarakom'];
const names = ['Rajesh Menon', 'Boban', 'Fathima', 'Arjun', 'Suresh Kumar', ''];

/** A busy, believable month (deterministic). */
function busyData(): AppData {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const trips: Trip[] = [];
  for (let d = 1; d <= 22; d++) {
    const count = rnd() < 0.3 ? 0 : rnd() < 0.7 ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`;
      const multi = rnd() < 0.15;
      const end = multi ? `2026-11-${String(Math.min(d + 2, 28)).padStart(2, '0')}` : date;
      const fare = Math.round((2000 + rnd() * 9000) / 100) * 100 * (multi ? 2.5 : 1);
      const km = Math.round(40 + rnd() * 260) * (multi ? 2 : 1);
      const costs: { date: string; type: TripCostType; amount: number }[] = [
        { date, type: 'Fuel', amount: Math.round(km * 7) },
        ...(rnd() < 0.5 ? [{ date, type: 'Toll' as const, amount: 130 }] : []),
        ...(rnd() < 0.6 ? [{ date, type: 'Driver bata' as const, amount: 600 }] : []),
        ...(rnd() < 0.2 ? [{ date, type: 'Parking' as const, amount: 80 }] : []),
      ];
      const paidAll = rnd() < 0.8;
      trips.push({
        id: `t${d}${k}`,
        date,
        endDate: end,
        vehicle: rnd() < 0.75 ? 'KL39Y0770' : 'KL07AB1234',
        from: 'Mulanthuruthy',
        to: places[Math.floor(rnd() * places.length)],
        startKm: null,
        endKm: null,
        km,
        customerName: names[Math.floor(rnd() * names.length)],
        customerPhone: '',
        fare,
        payments: paidAll ? [{ date: end, kind: 'balance', amount: fare }] : [{ date, kind: 'advance', amount: 1000 }],
        costs,
        notes: '',
        createdAt: `${date}T10:00:00Z`,
      });
    }
  }
  return {
    partners: [
      { id: 'p1', name: 'Partner 1' },
      { id: 'p2', name: 'Partner 2' },
      { id: 'p3', name: 'Partner 3' },
    ],
    trips: [...trips, { ...trips[0], id: 'up', date: '2026-11-24', endDate: '2026-11-25', fare: 9000, payments: [{ date: '2026-11-10', kind: 'advance', amount: 2000 }] }],
    capital: [
      { id: 'c1', partnerId: 'p1', date: '2026-10-01', amount: 120000, note: '' },
      { id: 'c2', partnerId: 'p2', date: '2026-11-05', amount: 50000, note: '' },
      { id: 'c3', partnerId: 'p3', date: '2026-10-01', amount: 100000, note: '' },
    ],
    expenses: [
      { id: 'e1', date: '2026-11-04', amount: 1500, category: 'Other', description: 'Seat cover (balance)', vehicleId: 'v1', itemId: null, odometerKm: null },
      { id: 'e2', date: '2026-11-07', amount: 1700, category: 'Other', description: 'Pipe, RC book', vehicleId: 'v1', itemId: null, odometerKm: null },
      { id: 'e3', date: '2026-11-09', amount: 4430, category: 'Loan / EMI', description: 'Vehicle EMI', vehicleId: 'v1', itemId: null, odometerKm: null },
      { id: 'e4', date: '2026-11-10', amount: 15000, category: 'Driver salary', description: 'Driver salary, November', vehicleId: null, itemId: null, odometerKm: null },
      { id: 'e5', date: '2026-11-12', amount: 7600, category: 'Tyres', description: 'Two front tyres', vehicleId: 'v2', itemId: null, odometerKm: null },
      { id: 'e6', date: '2026-11-14', amount: 3200, category: 'Service', description: 'General service', vehicleId: 'v1', itemId: null, odometerKm: 48900 },
    ],
    vehicles: [
      { id: 'v1', number: 'KL39Y0770', name: '', odometerKm: null, odometerDate: null, position: 0 },
      { id: 'v2', number: 'KL07AB1234', name: 'Toyota Etios', odometerKm: null, odometerDate: null, position: 1 },
    ] as AppData['vehicles'],
    vehicleItems: [],
    settings: { businessName: 'Covenant', defaultVehicle: '', receiptAddress: '', receiptPhone: '', receiptEmail: '', receiptGstin: '' },
    isSample: false,
  };
}

describe('report files', () => {
  const data = busyData();

  it('builds a multi-page A4 PDF for a busy month', async () => {
    const r = buildReportData(data, { kind: 'month', month: '2026-11' }, TODAY);
    const bytes = await buildReportPdf(r, assets);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
    expect(Math.round(doc.getPage(0).getSize().width)).toBe(595);
    expect(reportFileName(r)).toBe('Covenant-report-2026-11-01_to_2026-11-30');
    if (process.env.REPORT_OUT) writeFileSync(`${process.env.REPORT_OUT}/month.pdf`, bytes);
  });

  it('builds an empty period without failing', async () => {
    const r = buildReportData(data, { kind: 'month', month: '2025-01' }, TODAY);
    const doc = await PDFDocument.load(await buildReportPdf(r, assets));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('builds a year and a single day', async () => {
    for (const p of [{ kind: 'year', year: '2026' }, { kind: 'day', date: '2026-11-02' }] as const) {
      const bytes = await buildReportPdf(buildReportData(data, p, TODAY), assets);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
      if (process.env.REPORT_OUT) writeFileSync(`${process.env.REPORT_OUT}/${p.kind}.pdf`, bytes);
    }
  });

  it('builds the Excel workbook', async () => {
    const r = buildReportData(data, { kind: 'month', month: '2026-11' }, TODAY);
    const blob = await buildReportXlsx(r);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK'); // a zip, as .xlsx files are
    if (process.env.REPORT_OUT) writeFileSync(`${process.env.REPORT_OUT}/month.xlsx`, bytes);
  });
});
