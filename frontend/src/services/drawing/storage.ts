import { queryOne, run } from '../../db/engine'

// Uploaded drawings + OCR-generated preview images live in the same local
// sql.js database as everything else, as BLOB columns — keyed by
// (drawingId, kind) since a drawing has exactly one upload and at most one
// generated preview, so there's no separate "storage key" to invent.
export type FileKind = 'upload' | 'preview'

export async function uploadFile(drawingId: string, kind: FileKind, data: Uint8Array, contentType: string): Promise<void> {
  run(
    `INSERT INTO drawing_files (drawing_id, kind, data, content_type) VALUES (?, ?, ?, ?)
     ON CONFLICT (drawing_id, kind) DO UPDATE SET data = excluded.data, content_type = excluded.content_type`,
    [drawingId, kind, data, contentType],
  )
}

export async function downloadFile(drawingId: string, kind: FileKind): Promise<{ data: Uint8Array; contentType: string }> {
  const row = await queryOne<{ data: Uint8Array; content_type: string }>(
    'SELECT data, content_type FROM drawing_files WHERE drawing_id = ? AND kind = ?',
    [drawingId, kind],
  )
  if (!row) throw new Error(`File not found (${drawingId}/${kind})`)
  return { data: row.data, contentType: row.content_type }
}
