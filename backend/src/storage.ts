import { createClient } from '@supabase/supabase-js'

// Uploaded drawings + OCR-generated preview images used to live on local
// disk (backend/data/uploads, backend/data/processed) — Vercel wipes local
// disk between invocations, so both buckets moved to Supabase Storage.
// Server-side only: uses the service_role key (bypasses RLS/bucket
// policies), never exposed to the frontend — every route that touches these
// buckets is already behind requireAuth in index.ts.
const supabase = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')

export const UPLOAD_BUCKET = 'drawing-uploads'
export const PROCESSED_BUCKET = 'drawing-processed'

export async function uploadToStorage(bucket: string, key: string, data: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(key, data, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed (${bucket}/${key}): ${error.message}`)
}

export async function downloadFromStorage(bucket: string, key: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(key)
  if (error || !data) throw new Error(`Storage download failed (${bucket}/${key}): ${error?.message}`)
  return Buffer.from(await data.arrayBuffer())
}

/** Signed URL so the frontend can load an image directly from Storage
 * without the Express server proxying every byte — same short-lived-link
 * pattern as any private-bucket read. */
export async function signedStorageUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, expiresInSeconds)
  if (error || !data) throw new Error(`Could not sign URL (${bucket}/${key}): ${error?.message}`)
  return data.signedUrl
}
