import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves this to a hashed, locally-served worker asset — no CDN
// dependency, same offline requirement as the OCR engine.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker

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
 * string), far more accurate than OCR for "AutoCAD PDF" exports that carry
 * real text objects for dimension labels rather than rasterized ink.
 */
export async function extractVectorText(pdfBytes: Uint8Array): Promise<PdfPageExtraction> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()

  const tokens: PdfTextToken[] = content.items
    .filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => 'str' in item && item.str.trim().length > 0)
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

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Canvas failed to encode PNG'))
        return
      }
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

/**
 * Rasterize page 1 to a PNG for PDFs that carry no extractable text (pure
 * scanned/photographed blueprints saved as PDF) so they can fall through to
 * the same OCR path used for JPG/PNG/TIFF uploads.
 */
export async function rasterizePdfPage(pdfBytes: Uint8Array, scale = 2): Promise<Uint8Array> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')

  await page.render({ canvas, canvasContext: context, viewport }).promise
  return canvasToPngBytes(canvas)
}
