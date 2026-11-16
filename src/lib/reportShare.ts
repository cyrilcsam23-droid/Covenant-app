// Loaded only when someone makes a report (PDF library, fonts and the Excel writer).
import type { ReportData } from './report';
import { buildReportPdf, reportFileName } from './reportPdf';
import { buildReportXlsx } from './reportXlsx';
import { loadPdfAssets, saveFile, shareFile } from './pdfAssets';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function reportFile(r: ReportData, kind: 'pdf' | 'xlsx'): Promise<File> {
  if (kind === 'pdf') {
    const pdf = await buildReportPdf(r, await loadPdfAssets());
    return new File([pdf as BlobPart], `${reportFileName(r)}.pdf`, { type: 'application/pdf' });
  }
  const blob = await buildReportXlsx(r);
  return new File([blob], `${reportFileName(r)}.xlsx`, { type: XLSX_TYPE });
}

export async function shareReport(r: ReportData, kind: 'pdf' | 'xlsx') {
  return shareFile(await reportFile(r, kind));
}

export async function downloadReport(r: ReportData, kind: 'pdf' | 'xlsx') {
  saveFile(await reportFile(r, kind));
}
