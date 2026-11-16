/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildReceipt, money2, paymentSummary, receiptFileName, receiptNumber, rupeesInWords, tripDates, type ReceiptAssets } from './receipt';
import type { Trip } from './types';

const font = (subset: string, w: number) =>
  new Uint8Array(readFileSync(`node_modules/@fontsource/poppins/files/poppins-${subset}-${w}-normal.woff`));
const assets: ReceiptAssets = {
  logo: new Uint8Array(readFileSync('public/brand/covenant-logo.png')),
  regular: font('latin', 400),
  medium: font('latin', 500),
  semibold: font('latin', 600),
  rupee: font('devanagari', 600),
};

const trip: Trip = {
  id: '7e3710bc-8f9a-4f07-a09d-ff92034b8b4f',
  date: '2026-11-02',
  endDate: '2026-11-06',
  vehicle: 'KL39Y0770',
  from: 'Mulanthuruthy',
  to: 'Lulu Mall, Ernakulam',
  startKm: 48210,
  endKm: 48585,
  km: 375,
  customerName: 'Rajesh Menon',
  customerPhone: '+91 98470 12345',
  fare: 23880,
  payments: [
    { date: '2026-10-29', kind: 'advance', amount: 2000 },
    { date: '2026-11-06', kind: 'balance', amount: 21880 },
  ],
  costs: [{ date: '2026-11-02', type: 'Fuel', amount: 2000 }],
  notes: 'internal note that must never reach the customer',
  createdAt: '2026-10-29T10:00:00Z',
};

const business = {
  address: 'Near Bus Stand, Mulanthuruthy, Ernakulam, Kerala 682314',
  phone: '+91 98470 00000',
  email: 'bookings@example.com',
  gstin: '',
};

describe('amount in words', () => {
  it('uses Indian lakh and crore', () => {
    expect(rupeesInWords(23880)).toBe('Rupees Twenty Three Thousand Eight Hundred Eighty Only');
    expect(rupeesInWords(150000)).toBe('Rupees One Lakh Fifty Thousand Only');
    expect(rupeesInWords(12500000)).toBe('Rupees One Crore Twenty Five Lakh Only');
    expect(rupeesInWords(2000)).toBe('Rupees Two Thousand Only');
    expect(rupeesInWords(0)).toBe('Rupees Zero Only');
    expect(rupeesInWords(101)).toBe('Rupees One Hundred One Only');
    expect(rupeesInWords(99.5)).toBe('Rupees Ninety Nine and Fifty Paise Only');
  });
  it('formats money with paise', () => {
    expect(money2(23880)).toBe('₹23,880.00');
    expect(money2(150000)).toBe('₹1,50,000.00');
  });
});

describe('receipt details', () => {
  it('numbers receipts from the trip', () => {
    expect(receiptNumber(trip)).toBe('CT-261102-7E37');
    expect(receiptFileName(trip)).toBe('Receipt-CT-261102-7E37.pdf');
  });

  it('writes the trip dates', () => {
    expect(tripDates(trip)).toBe('2 – 6 Nov 2026 · 5 days');
    expect(tripDates({ date: '2026-11-02', endDate: '2026-11-02' })).toBe('2 Nov 2026');
    expect(tripDates({ date: '2026-11-02', endDate: null })).toBe('From 2 Nov 2026');
    expect(tripDates({ date: '2026-11-30', endDate: '2026-12-02' })).toBe('30 Nov – 2 Dec 2026 · 3 days');
  });

  it('knows what is paid', () => {
    expect(paymentSummary(trip)).toEqual({ received: 23880, due: 0, paidInFull: true });
    expect(paymentSummary({ fare: 9000, payments: [{ date: '2026-11-10', kind: 'advance', amount: 2000 }] })).toEqual({
      received: 2000,
      due: 7000,
      paidInFull: false,
    });
  });
});

describe('receipt PDF', () => {
  it('builds an A5 PDF with the brand fonts and logo', async () => {
    const bytes = await buildReceipt(trip, assets, business, '2026-11-16');
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    expect(doc.getTitle()).toBe('Receipt CT-261102-7E37');
    if (process.env.RECEIPT_OUT) writeFileSync(`${process.env.RECEIPT_OUT}/paid.pdf`, bytes);
  });

  it('handles a booking with only an advance, long names and missing km', async () => {
    const booking: Trip = {
      ...trip,
      id: 'abc12345',
      date: '2026-11-19',
      endDate: null,
      from: 'Thiruvananthapuram International Airport',
      to: 'Kanyakumari Vivekananda Rock Memorial',
      startKm: null,
      endKm: null,
      km: 0,
      customerName: '',
      customerPhone: '',
      fare: 9000,
      payments: [{ date: '2026-11-10', kind: 'advance', amount: 2000 }],
    };
    const bytes = await buildReceipt(booking, assets, { address: '', phone: '', email: '', gstin: '' }, '2026-11-16');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    if (process.env.RECEIPT_OUT) writeFileSync(`${process.env.RECEIPT_OUT}/advance.pdf`, bytes);
  });
});
