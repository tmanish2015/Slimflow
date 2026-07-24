import { updateDrawing, type DrawingRecord } from './store'
import { downloadFile, uploadFile } from './storage'
import { preprocessForOcr } from './preprocess'
import { extractVectorText, rasterizePdfPage } from './pdf'
import { runOcr } from './ocr'
import { parseDimensions, type RawToken } from './dimensionParser'

const MIN_VECTOR_TOKENS = 5

export async function processDrawing(drawing: DrawingRecord): Promise<void> {
  await updateDrawing(drawing.id, { status: 'processing', errorMessage: null })

  try {
    const { data: fileBytes } = await downloadFile(drawing.id, 'upload')
    const isPdf = drawing.mimeType === 'application/pdf'

    let tokens: RawToken[] = []
    let source: 'vector-pdf' | 'ocr' = 'ocr'
    let previewBuffer: Uint8Array

    if (isPdf) {
      const vector = await extractVectorText(fileBytes)
      if (vector.tokens.length >= MIN_VECTOR_TOKENS) {
        tokens = vector.tokens
        source = 'vector-pdf'
        previewBuffer = await rasterizePdfPage(fileBytes)
      } else {
        // Scanned/photographed PDF with no real text layer — fall back to OCR.
        const raster = await rasterizePdfPage(fileBytes)
        const processed = await preprocessForOcr(raster, 'image/png')
        previewBuffer = processed.buffer
        tokens = await runOcr(processed.buffer)
        source = 'ocr'
      }
    } else {
      const processed = await preprocessForOcr(fileBytes, drawing.mimeType)
      previewBuffer = processed.buffer
      tokens = await runOcr(processed.buffer)
      source = 'ocr'
    }

    const previewPath = `${drawing.id}.png`
    await uploadFile(drawing.id, 'preview', previewBuffer, 'image/png')

    const dimensions = parseDimensions(tokens, source)
    const hasAnyDimension = dimensions.some((d) => d.kind === 'width' || d.kind === 'height')

    await updateDrawing(drawing.id, {
      previewPath,
      dimensions,
      status: 'needs_review',
      errorMessage: hasAnyDimension ? null : 'No dimensions detected automatically — enter Width/Height manually below.',
    })
  } catch (err) {
    await updateDrawing(drawing.id, {
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Unknown processing error',
    })
  }
}
