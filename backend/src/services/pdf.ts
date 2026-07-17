import { createCanvas } from '@napi-rs/canvas'
// pdfjs-dist's legacy Node build ships plain JS (no DOM/worker requirements).
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

interface PdfTextItem {
  str: string
  transform: number[]
  width: number
  height: number
}

export interface PdfTextToken {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface PdfPageExtraction {
  tokens: PdfTextToken[]
  pageWidth: number
  pageHeight: number
}

/**
 * Pull embedded vector text directly from a PDF's content stream (position +
 * string), which is far more accurate than OCR for "AutoCAD PDF" exports that
 * carry real text objects for dimension labels rather than rasterized ink.
 */
export async function extractVectorText(pdfBuffer: Buffer): Promise<PdfPageExtraction> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()

  const tokens: PdfTextToken[] = (content.items as PdfTextItem[])
    .filter((item) => typeof item.str === 'string' && item.str.trim().length > 0)
    .map((item) => {
      const [, , , , e, f] = item.transform
      // PDF origin is bottom-left; flip to top-left to match image/OCR coordinate space.
      return {
        text: item.str.trim(),
        x: e,
        y: viewport.height - f,
        width: item.width,
        height: item.height || 10,
      }
    })

  return { tokens, pageWidth: viewport.width, pageHeight: viewport.height }
}

/**
 * Rasterize page 1 to a PNG for PDFs that carry no extractable text (pure
 * scanned/photographed blueprints saved as PDF) so they can fall through to
 * the same OCR path used for JPG/PNG/TIFF uploads.
 */
export async function rasterizePdfPage(pdfBuffer: Buffer, scale = 2): Promise<Buffer> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')

  await page.render({ canvasContext: context as unknown as object, viewport }).promise
  return canvas.toBuffer('image/png')
}
