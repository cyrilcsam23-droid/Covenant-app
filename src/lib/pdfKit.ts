import { PDFDocument, popGraphicsState, pushGraphicsState, rgb, setCharacterSpacing, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/** Font files and logo for branded PDFs (receipts, reports). Loaded by pdfAssets.ts in the browser. */
export interface PdfAssets {
  logo: Uint8Array; // PNG
  regular: Uint8Array; // Poppins latin 400
  medium: Uint8Array; // Poppins latin 500
  semibold: Uint8Array; // Poppins latin 600
  rupee: Uint8Array; // Poppins devanagari 600 (only used for ₹)
}

export interface PdfFonts {
  regular: PDFFont;
  medium: PDFFont;
  semibold: PDFFont;
  rupee: PDFFont;
}

/** Covenant Travels colours, from the logo. */
export const BRAND = {
  navy: rgb(0 / 255, 32 / 255, 80 / 255),
  gold: rgb(168 / 255, 118 / 255, 12 / 255), // gold that reads as text on white
  goldLine: rgb(201 / 255, 151 / 255, 28 / 255),
  ink: rgb(30 / 255, 32 / 255, 38 / 255),
  muted: rgb(96 / 255, 100 / 255, 110 / 255),
  faint: rgb(140 / 255, 144 / 255, 152 / 255),
  rule: rgb(214 / 255, 217 / 255, 224 / 255),
  tint: rgb(244 / 255, 246 / 255, 250 / 255),
  loss: rgb(178 / 255, 50 / 255, 38 / 255),
  white: rgb(1, 1, 1),
};

export const A4 = { w: 595.28, h: 841.89 };

export async function startPdf(assets: PdfAssets, meta: { title: string; subject?: string; author: string }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, medium, semibold, rupee] = await Promise.all([
    doc.embedFont(assets.regular, { subset: true }),
    doc.embedFont(assets.medium, { subset: true }),
    doc.embedFont(assets.semibold, { subset: true }),
    doc.embedFont(assets.rupee, { subset: true }),
  ]);
  const logo = await doc.embedPng(assets.logo);
  doc.setTitle(meta.title);
  if (meta.subject) doc.setSubject(meta.subject);
  doc.setAuthor(meta.author);
  doc.setCreator(meta.author);
  doc.setProducer(meta.author);
  return { doc, fonts: { regular, medium, semibold, rupee } as PdfFonts, logo };
}

type BoxOpts = { color?: RGB; borderColor?: RGB; borderWidth?: number };

/**
 * Drawing on one page with top-down coordinates (y grows downwards, like the screen).
 * Text switches to the rupee font for "₹"; letter-spacing uses PDF character spacing so
 * spaced headings still copy as words.
 */
export class Pen {
  constructor(
    public page: PDFPage,
    private f: PdfFonts,
  ) {}

  private y(y: number) {
    return this.page.getHeight() - y;
  }

  private runs(s: string) {
    return s.split(/(₹)/).filter(Boolean);
  }

  width(s: string, size: number, font: PDFFont, spacing = 0) {
    return this.runs(s).reduce((w, part) => w + (part === '₹' ? this.f.rupee : font).widthOfTextAtSize(part, size) + spacing * [...part].length, 0);
  }

  text(s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = BRAND.ink, spacing = 0) {
    let cx = x;
    for (const part of this.runs(s)) {
      const f = part === '₹' ? this.f.rupee : font;
      if (spacing) this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(spacing));
      this.page.drawText(part, { x: cx, y: this.y(y), size, font: f, color });
      if (spacing) this.page.pushOperators(popGraphicsState());
      cx += f.widthOfTextAtSize(part, size) + spacing * [...part].length;
    }
    return cx - x;
  }

  right(s: string, xr: number, y: number, size: number, font: PDFFont, color: RGB = BRAND.ink, spacing = 0) {
    return this.text(s, xr - this.width(s, size, font, spacing) + spacing, y, size, font, color, spacing);
  }

  center(s: string, cx: number, y: number, size: number, font: PDFFont, color: RGB = BRAND.ink, spacing = 0) {
    return this.text(s, cx - this.width(s, size, font, spacing) / 2, y, size, font, color, spacing);
  }

  /** Word-wrap to a width; very long words are broken. */
  wrap(s: string, maxW: number, size: number, font: PDFFont): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of s.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (this.width(next, size, font) <= maxW) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      let w = word;
      while (this.width(w, size, font) > maxW && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && this.width(w.slice(0, cut), size, font) > maxW) cut--;
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /** Cut to fit a width with an ellipsis. */
  fit(s: string, maxW: number, size: number, font: PDFFont) {
    if (this.width(s, size, font) <= maxW) return s;
    let out = s;
    while (out.length > 1 && this.width(`${out}…`, size, font) > maxW) out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
  }

  hline(x1: number, x2: number, y: number, color: RGB = BRAND.rule, thickness = 0.75) {
    this.page.drawLine({ start: { x: x1, y: this.y(y) }, end: { x: x2, y: this.y(y) }, thickness, color });
  }

  vline(x: number, y1: number, y2: number, color: RGB = BRAND.rule, thickness = 0.75) {
    this.page.drawLine({ start: { x, y: this.y(y1) }, end: { x, y: this.y(y2) }, thickness, color });
  }

  rect(x: number, y: number, w: number, h: number, opts: BoxOpts) {
    if (w <= 0 || h <= 0) return;
    this.page.drawRectangle({ x, y: this.y(y + h), width: w, height: h, ...opts });
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, opts: BoxOpts) {
    const rr = Math.min(r, w / 2, h / 2);
    this.page.drawSvgPath(
      `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${h - rr} Q ${w} ${h} ${w - rr} ${h} H ${rr} Q 0 ${h} 0 ${h - rr} V ${rr} Q 0 0 ${rr} 0 Z`,
      { x, y: this.y(y), ...opts },
    );
  }

  image(img: PDFImage, x: number, y: number, w: number) {
    const h = (img.height / img.width) * w;
    this.page.drawImage(img, { x, y: this.y(y + h), width: w, height: h });
    return h;
  }
}
