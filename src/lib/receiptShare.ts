// Loaded only when someone asks for a receipt, so the PDF library and fonts stay out of the
// app's first download.
import regularUrl from '@fontsource/poppins/files/poppins-latin-400-normal.woff?url';
import mediumUrl from '@fontsource/poppins/files/poppins-latin-500-normal.woff?url';
import semiboldUrl from '@fontsource/poppins/files/poppins-latin-600-normal.woff?url';
import rupeeUrl from '@fontsource/poppins/files/poppins-devanagari-600-normal.woff?url';
import type { Settings, Trip } from './types';
import { buildReceipt, receiptFileName } from './receipt';

const logoUrl = `${import.meta.env.BASE_URL}brand/covenant-logo.png`;

async function bytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function receiptFile(trip: Trip, settings: Settings): Promise<File> {
  const [logo, regular, medium, semibold, rupee] = await Promise.all([logoUrl, regularUrl, mediumUrl, semiboldUrl, rupeeUrl].map(bytes));
  const pdf = await buildReceipt(
    trip,
    { logo, regular, medium, semibold, rupee },
    { address: settings.receiptAddress ?? '', phone: settings.receiptPhone ?? '', email: settings.receiptEmail ?? '', gstin: settings.receiptGstin ?? '' },
  );
  return new File([pdf as BlobPart], receiptFileName(trip), { type: 'application/pdf' });
}

/** True when the phone can hand a PDF to WhatsApp, Gmail and so on. */
export function canShareFiles(): boolean {
  try {
    const probe = new File(['x'], 'probe.pdf', { type: 'application/pdf' });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Open the phone's share sheet with the receipt. Resolves false if the person closes the sheet. */
export async function shareReceipt(trip: Trip, settings: Settings): Promise<boolean> {
  const file = await receiptFile(trip, settings);
  try {
    await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}

export async function downloadReceipt(trip: Trip, settings: Settings): Promise<void> {
  const file = await receiptFile(trip, settings);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
