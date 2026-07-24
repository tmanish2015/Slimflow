import { query, queryOne, run } from '../../db/engine'

export type DimensionKind =
  | 'width'
  | 'height'
  | 'frame'
  | 'glass_thickness'
  | 'mullion_count'
  | 'transom_count'
  | 'scale'
  | 'drawing_unit'
  | 'unknown'

export interface ExtractedDimension {
  id: string
  kind: DimensionKind
  label: string
  rawText: string
  value: number | null
  unit: 'mm' | 'cm' | 'in' | 'ft' | null
  confidence: number
  source: 'vector-pdf' | 'ocr'
  bbox: { x: number; y: number; width: number; height: number } | null
  confirmed: boolean
}

// A manually-tagged design element the automatic pipeline can't detect —
// e.g. an arched fanlight in a hand sketch. Deliberately not auto-detected.
export interface DrawingFeature {
  id: string
  label: string
  shape: 'arch' | 'custom'
  position: 'top' | 'middle' | 'bottom'
  material: string
  notes: string
  cost: number
}

export interface HardwareItem {
  id: string
  label: string
  quantity: number
  unitCost: number
  notes: string
}

export interface BomLine {
  category: string
  item: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
  formula: string
}

export interface Bom {
  lines: BomLine[]
  materialCost: number
  wasteCost: number
  labourCost: number
  totalCost: number
  sellingPrice: number
  generatedAt: string
}

export type DrawingStatus = 'uploaded' | 'processing' | 'needs_review' | 'ready' | 'failed'

export type PanelMaterial = 'glass' | 'acp' | 'wpc'

export interface DrawingRecord {
  id: string
  originalFilename: string
  mimeType: string
  storedPath: string
  previewPath: string | null
  status: DrawingStatus
  errorMessage: string | null
  objectType: string | null
  scale: { knownLabel: string; knownValueMm: number } | null
  dimensions: ExtractedDimension[]
  features: DrawingFeature[]
  hardwareItems: HardwareItem[]
  panelMaterial: PanelMaterial
  bom: Bom | null
  createdAt: string
  updatedAt: string
}

// Drawings live in the local sql.js database — one JSON blob per row (the
// shape is still evolving) plus a real created_at column for ORDER BY. The
// uploaded original + generated preview image live in drawing_files
// (services/drawing/storage.ts), not here.
export async function createDrawing(input: { originalFilename: string; mimeType: string; storedPath: string }): Promise<DrawingRecord> {
  const now = new Date().toISOString()
  const record: DrawingRecord = {
    id: crypto.randomUUID(),
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    storedPath: input.storedPath,
    previewPath: null,
    status: 'uploaded',
    errorMessage: null,
    objectType: null,
    scale: null,
    dimensions: [],
    features: [],
    hardwareItems: [],
    panelMaterial: 'glass',
    bom: null,
    createdAt: now,
    updatedAt: now,
  }
  run('INSERT INTO drawings (id, data, created_at) VALUES (?, ?, ?)', [record.id, JSON.stringify(record), now])
  return record
}

export async function getDrawing(id: string): Promise<DrawingRecord | undefined> {
  const row = await queryOne<{ data: string }>('SELECT data FROM drawings WHERE id = ?', [id])
  return row ? (JSON.parse(row.data) as DrawingRecord) : undefined
}

export async function listDrawings(): Promise<DrawingRecord[]> {
  const rows = await query<{ data: string }>('SELECT data FROM drawings ORDER BY created_at DESC')
  return rows.map((r) => JSON.parse(r.data) as DrawingRecord)
}

export async function updateDrawing(id: string, patch: Partial<Omit<DrawingRecord, 'id' | 'createdAt'>>): Promise<DrawingRecord> {
  const existing = await getDrawing(id)
  if (!existing) throw new Error(`Drawing ${id} not found`)
  const updated: DrawingRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  run('UPDATE drawings SET data = ? WHERE id = ?', [JSON.stringify(updated), id])
  return updated
}
