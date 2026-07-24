import { updateDrawing, type DrawingRecord } from '../store.js'
import { downloadFile, uploadFile } from '../storage.js'
import { preprocessForOcr } from './preprocess.js'
import { extractVectorText, rasterizePdfPage } from './pdf.js'
import { runOcr } from './ocr.js'
import { parseDimensions, type RawToken } from './dimensionParser.js'

const MIN_VECTOR_TOKENS = 5

export async function processDrawing(drawing: DrawingRecord): Promise<void> {
  await updateDrawing(drawing.id, { status: 'processing', errorMessage: null })

  try {
    const { data: fileBuffer } = await downloadFile(drawing.id, 'upload')
    const isPdf = drawing.mimeType === 'application/pdf'

    let tokens: RawToken[] = []
    let source: 'vector-pdf' | 'ocr' = 'ocr'
    let previewBuffer: Buffer

    if (isPdf) {
      const vector = await extractVectorText(fileBuffer)
      if (vector.tokens.length >= MIN_VECTOR_TOKENS) {
        tokens = vector.tokens
        source = 'vector-pdf'
        previewBuffer = await rasterizePdfPage(fileBuffer)
      } else {
        // Scanned/photographed PDF with no real text layer — fall back to OCR.
        const raster = await rasterizePdfPage(fileBuffer)
        const processed = await preprocessForOcr(raster)
        previewBuffer = processed.buffer
        const words = await runOcr(processed.buffer)
        tokens = words
        source = 'ocr'
      }
    } else {
      const processed = await preprocessForOcr(fileBuffer)
      previewBuffer = processed.buffer
      const words = await runOcr(processed.buffer)
      tokens = words
      source = 'ocr'
    }

    const previewPath = `${drawing.id}.png`
    await uploadFile(drawing.id, 'preview', previewBuffer, 'image/png')

    const dimensions = parseDimensions(tokens, source)
    const hasAnyDimension = dimensions.some((d) => d.kind === 'width' || d.kind === 'height')

    await updateDrawing(drawing.id, {
      previewPath,
      dimensions,
      status: hasAnyDimension ? 'needs_review' : 'needs_review',
      errorMessage: hasAnyDimension
        ? null
        : 'No dimensions detected automatically — enter Width/Height manually below.',
    })
  } catch (err) {
    await updateDrawing(drawing.id, {
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Unknown processing error',
    })
  }
}
