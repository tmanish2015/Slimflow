import type { Bom, DrawingRecord, ExtractedDimension, RateMaster } from './types'

const BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  uploadDrawing(file: File) {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE}/drawings`, { method: 'POST', body: form }).then((r) => json<DrawingRecord>(r))
  },
  getDrawing(id: string) {
    return fetch(`${BASE}/drawings/${id}`).then((r) => json<DrawingRecord>(r))
  },
  listDrawings() {
    return fetch(`${BASE}/drawings`).then((r) => json<DrawingRecord[]>(r))
  },
  updateDimensions(id: string, dimensions: ExtractedDimension[]) {
    return fetch(`${BASE}/drawings/${id}/dimensions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimensions }),
    }).then((r) => json<DrawingRecord>(r))
  },
  generateBom(id: string) {
    return fetch(`${BASE}/drawings/${id}/bom`, { method: 'POST' }).then((r) => json<DrawingRecord>(r))
  },
  getRateMaster() {
    return fetch(`${BASE}/rate-master`).then((r) => json<RateMaster>(r))
  },
  saveRateMaster(patch: Partial<RateMaster>) {
    return fetch(`${BASE}/rate-master`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<RateMaster>(r))
  },
}

export type { Bom, DrawingRecord, ExtractedDimension, RateMaster }
