export interface PreprocessResult {
  buffer: Uint8Array
  width: number
  height: number
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

/** Greyscale (luminance) + linear contrast stretch across the full tonal
 * range, in one pass. Writes back as R=G=B so the later single-channel
 * filters below only need to read one component. */
function greyscaleNormalize(pixels: Uint8ClampedArray): void {
  const n = pixels.length / 4
  const luma = new Float32Array(n)
  let min = 255
  let max = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const l = 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2]
    luma[i] = l
    if (l < min) min = l
    if (l > max) max = l
  }
  const range = max - min || 1
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const stretched = Math.round(((luma[i] - min) / range) * 255)
    pixels[o] = stretched
    pixels[o + 1] = stretched
    pixels[o + 2] = stretched
  }
}

/** Light 3x3 median denoise on the (now single-channel) grey image —
 * preserves thin dimension lines better than a gaussian blur. Reads from a
 * snapshot so writes don't feed back into the same pass. */
function medianDenoise(pixels: Uint8ClampedArray, width: number, height: number): void {
  const src = Uint8ClampedArray.from(pixels)
  const at = (x: number, y: number) => src[(Math.min(Math.max(y, 0), height - 1) * width + Math.min(Math.max(x, 0), width - 1)) * 4]
  const window = new Uint8Array(9)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let k = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          window[k++] = at(x + dx, y + dy)
        }
      }
      window.sort()
      const o = (y * width + x) * 4
      const median = window[4]
      pixels[o] = median
      pixels[o + 1] = median
      pixels[o + 2] = median
    }
  }
}

/** Standard edge-sharpen convolution: [[0,-1,0],[-1,5,-1],[0,-1,0]]. */
function sharpen(pixels: Uint8ClampedArray, width: number, height: number): void {
  const src = Uint8ClampedArray.from(pixels)
  const at = (x: number, y: number) => src[(Math.min(Math.max(y, 0), height - 1) * width + Math.min(Math.max(x, 0), width - 1)) * 4]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = 5 * at(x, y) - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1)
      const clamped = Math.min(255, Math.max(0, value))
      const o = (y * width + x) * 4
      pixels[o] = clamped
      pixels[o + 1] = clamped
      pixels[o + 2] = clamped
    }
  }
}

/**
 * Basic raster cleanup ahead of OCR: EXIF auto-orient, upscale small/low-res
 * photos so OCR has enough pixel density, greyscale + contrast stretch,
 * light denoise, sharpen. Runs entirely on a canvas — the browser
 * equivalent of the server version's sharp pipeline. Full perspective
 * correction/deskew is intentionally out of scope, same as before.
 */
export async function preprocessForOcr(input: Uint8Array, mimeType: string): Promise<PreprocessResult> {
  const blob = new Blob([input as BlobPart], { type: mimeType })
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })

  // Tesseract accuracy drops sharply below ~150 DPI equivalent; upscale
  // anything narrower than 2000px so small phone photos still resolve digits.
  const targetWidth = bitmap.width < 2000 ? 2000 : bitmap.width
  const scale = targetWidth / bitmap.width
  const targetHeight = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
  greyscaleNormalize(imageData.data)
  medianDenoise(imageData.data, targetWidth, targetHeight)
  sharpen(imageData.data, targetWidth, targetHeight)
  ctx.putImageData(imageData, 0, 0)

  const buffer = await canvasToPngBytes(canvas)
  return { buffer, width: targetWidth, height: targetHeight }
}
