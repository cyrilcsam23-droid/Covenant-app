// Loaded only when someone asks for a receipt, so the PDF library and fonts stay out of the
// app's first download.
import type { Settings, Trip } from './types';
import { buildReceipt, receiptFileName } from './receipt';
import { loadPdfAssets, saveFile, shareFile } from './pdfAssets';

export async function receiptFile(trip: Trip, settings: Settings): Promise<File> {
  const pdf = await buildReceipt(trip, await loadPdfAssets(), {
    address: settings.receiptAddress ?? '',
    phone: settings.receiptPhone ?? '',
    email: settings.receiptEmail ?? '',
    gstin: settings.receiptGstin ?? '',
  });
  return new File([pdf as BlobPart], receiptFileName(trip), { type: 'application/pdf' });
}

/** Open the phone's share sheet with the receipt. Resolves false if the person closes the sheet. */
export async function shareReceipt(trip: Trip, settings: Settings): Promise<boolean> {
  return shareFile(await receiptFile(trip, settings));
}

export async function downloadReceipt(trip: Trip, settings: Settings): Promise<void> {
  saveFile(await receiptFile(trip, settings));
}
