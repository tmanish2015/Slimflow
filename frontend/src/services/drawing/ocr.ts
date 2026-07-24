import { createWorker, type Worker } from 'tesseract.js'

export interface OcrWord {
  text: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

let workerPromise: Promise<Worker> | null = null

// Worker script + wasm core + English trained-data are fetched from
// tesseract.js's own default CDN (jsdelivr/tessdata.projectnaptha.com) on
// first use — hand-vendoring these risks a version mismatch between the
// worker glue and the wasm core's exported ABI (tried it; a mismatched pair
// hangs silently during `initializing tesseract` instead of throwing).
// Letting tesseract.js resolve its own matching set is the supported path.
// `cacheMethod: 'indexedDB'` means only the very first run needs network —
// every run after that loads the cached core+language data locally, which
// is the real offline requirement for this app.
async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      cacheMethod: 'indexedDB',
    })
  }
  return workerPromise
}

const MIN_CONFIDENCE = 40
// A real word's box is never this large — a hit here is Tesseract failing to
// segment a smudged/low-contrast region and returning a garbage blob for it.
const MAX_WORD_DIMENSION_PX = 400

/** Runs OCR and returns word-level tokens with bounding boxes so the
 * dimension parser can reason about label position relative to leader
 * lines. Accepts PNG bytes directly — tesseract.js's browser build takes a
 * Blob natively, no base64/data-URL round trip needed. */
export async function runOcr(imageBytes: Uint8Array): Promise<OcrWord[]> {
  const worker = await getWorker()
  const blob = new Blob([imageBytes as BlobPart], { type: 'image/png' })
  const { data } = await worker.recognize(blob, {}, { blocks: true })

  const words: OcrWord[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const width = word.bbox.x1 - word.bbox.x0
          const height = word.bbox.y1 - word.bbox.y0
          if (word.confidence < MIN_CONFIDENCE) continue
          if (width > MAX_WORD_DIMENSION_PX || height > MAX_WORD_DIMENSION_PX) continue
          words.push({
            text: word.text,
            x: word.bbox.x0,
            y: word.bbox.y0,
            width,
            height,
            confidence: word.confidence,
          })
        }
      }
    }
  }
  return words
}

export async function shutdownOcr() {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
  }
}
