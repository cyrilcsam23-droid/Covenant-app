// Fonts and logo for the branded PDFs, fetched on first use. This module is only reached
// through dynamic imports, so none of it is in the app's first download.
import regularUrl from '@fontsource/poppins/files/poppins-latin-400-normal.woff?url';
import mediumUrl from '@fontsource/poppins/files/poppins-latin-500-normal.woff?url';
import semiboldUrl from '@fontsource/poppins/files/poppins-latin-600-normal.woff?url';
import rupeeUrl from '@fontsource/poppins/files/poppins-devanagari-600-normal.woff?url';
import type { PdfAssets } from './pdfKit';

const logoUrl = `${import.meta.env.BASE_URL}brand/covenant-logo.png`;

async function bytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

let cached: Promise<PdfAssets> | null = null;

export function loadPdfAssets(): Promise<PdfAssets> {
  cached ??= Promise.all([logoUrl, regularUrl, mediumUrl, semiboldUrl, rupeeUrl].map(bytes))
    .then(([logo, regular, medium, semibold, rupee]) => ({ logo, regular, medium, semibold, rupee }))
    .catch((e) => {
      cached = null; // let the next tap try again
      throw e;
    });
  return cached;
}

/** True when the phone can hand this kind of file to WhatsApp, Gmail and so on. */
export function canShareFile(type: string, name = 'file'): boolean {
  try {
    const probe = new File(['x'], name, { type });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Open the share sheet. Resolves false if the person closes it. */
export async function shareFile(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title: file.name.replace(/\.[a-z]+$/i, '') });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}

export function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
