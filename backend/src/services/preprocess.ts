import sharp from 'sharp'

export interface PreprocessResult {
  buffer: Buffer
  width: number
  height: number
}

/**
 * Basic raster cleanup ahead of OCR: normalize contrast, greyscale, denoise,
 * sharpen edges, and upscale small/low-res photos so OCR has enough pixel
 * density to resolve dimension text. Full perspective correction / deskew
 * (Step 2's "correct perspective" / "straighten image") needs contour +
 * homography analysis and is intentionally deferred past this MVP pass.
 */
export async function preprocessForOcr(input: Buffer): Promise<PreprocessResult> {
  const meta = await sharp(input).metadata()
  const width = meta.width ?? 1600
  const height = meta.height ?? 1200

  // Tesseract accuracy drops sharply below ~150 DPI equivalent; upscale
  // anything narrower than 2000px so small phone photos still resolve digits.
  const targetWidth = width < 2000 ? 2000 : width

  const pipeline = sharp(input)
    .rotate() // auto-orient using EXIF for mobile camera photos
    .resize({ width: targetWidth, withoutEnlargement: false })
    .greyscale()
    .normalize() // stretch contrast to use the full tonal range
    .median(1) // light denoise, preserves thin dimension lines better than gaussian blur
    .sharpen()

  const buffer = await pipeline.png().toBuffer()
  const outMeta = await sharp(buffer).metadata()
  return { buffer, width: outMeta.width ?? targetWidth, height: outMeta.height ?? height }
}
