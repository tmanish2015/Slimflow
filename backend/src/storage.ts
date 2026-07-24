import { query, queryOne } from './configurator/db.js'

// Uploaded drawings + OCR-generated preview images used to live on local
// disk (backend/data/uploads, backend/data/processed) — Vercel wipes local
// disk between invocations, so both move into Postgres as bytea instead of
// a separate object-storage service: one less credential/service to wire
// up, and fine at this app's scale (an internal tool, not high-volume media
// hosting). Keyed by (drawingId, kind) — a drawing has exactly one upload
// and at most one generated preview, so there's no separate "storage key"
// to invent; the drawing's own id already identifies the file.
export type FileKind = 'upload' | 'preview'

export async function uploadFile(drawingId: string, kind: FileKind, data: Buffer, contentType: string): Promise<void> {
  await query(
    `INSERT INTO drawing_files (drawing_id, kind, data, content_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (drawing_id, kind) DO UPDATE SET data = $3, content_type = $4`,
    [drawingId, kind, data, contentType],
  )
}

export async function downloadFile(drawingId: string, kind: FileKind): Promise<{ data: Buffer; contentType: string }> {
  const row = await queryOne<{ data: Buffer; content_type: string }>(
    'SELECT data, content_type FROM drawing_files WHERE drawing_id = $1 AND kind = $2',
    [drawingId, kind],
  )
  if (!row) throw new Error(`File not found (${drawingId}/${kind})`)
  return { data: row.data, contentType: row.content_type }
}
