import { createWorker } from 'tesseract.js'

export interface OcrWord {
  text: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

let workerPromise: ReturnType<typeof createWorker> | null = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng')
  }
  return workerPromise
}

const MIN_CONFIDENCE = 40
// A real word's box is never this large — a hit here is Tesseract failing to
// segment a smudged/low-contrast region and returning a garbage blob for it
// (seen in practice: a single bogus "word" spanning most of the page at
// ~12% confidence). Drop these rather than let them pollute line-grouping.
const MAX_WORD_DIMENSION_PX = 400

/** Runs OCR and returns word-level tokens with bounding boxes so the
 * dimension parser can reason about label position relative to leader
 * lines (e.g. a number sitting along the bottom edge is likely the width). */
export async function runOcr(imageBuffer: Buffer): Promise<OcrWord[]> {
  const worker = await getWorker()
  const { data } = await worker.recognize(imageBuffer, {}, { blocks: true })

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
