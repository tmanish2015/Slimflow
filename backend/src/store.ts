import { randomUUID } from 'node:crypto'
import { query, queryOne } from './configurator/db.js'

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
// e.g. an arched fanlight in a hand sketch. Deliberately not auto-detected:
// arbitrary curved-shape recognition from rough sketches is unreliable, so
// this is a human-entered line rather than a guess (same "no fake AI" spirit
// as the rest of the extraction — see feedback-tradeflow-build-conventions).
export interface DrawingFeature {
  id: string
  label: string
  shape: 'arch' | 'custom'
  position: 'top' | 'middle' | 'bottom'
  material: string
  notes: string
  cost: number
}

// A hardware line item — quantities are either a disclosed dimension-driven
// suggestion (e.g. hinge count from height) or manually entered/edited, never
// a silent guess. Listing hardware explicitly, before the final cost roll-up,
// is what lets a fabricator catch a wrong count before it's baked into price.
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

// Drawings live in Postgres now (one jsonb column per row) instead of a
// single backend/data/drawings.json blob file — that file didn't survive
// Vercel's ephemeral filesystem. Kept as one jsonb column rather than fully
// normalized: the shape is still evolving and the app already treats it as
// one nested object end-to-end — jsonb preserves that exactly. `created_at`
// is pulled out as its own real column purely so listDrawings can ORDER BY
// at the DB level.
export async function createDrawing(input: {
  originalFilename: string
  mimeType: string
  storedPath: string
}): Promise<DrawingRecord> {
  const now = new Date().toISOString()
  const record: DrawingRecord = {
    id: randomUUID(),
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
  await query('INSERT INTO drawings (id, data, created_at) VALUES ($1, $2, $3)', [
    record.id,
    JSON.stringify(record),
    now,
  ])
  return record
}

export async function getDrawing(id: string): Promise<DrawingRecord | undefined> {
  const row = await queryOne<{ data: DrawingRecord }>('SELECT data FROM drawings WHERE id = $1', [id])
  return row?.data
}

export async function listDrawings(): Promise<DrawingRecord[]> {
  const rows = await query<{ data: DrawingRecord }>('SELECT data FROM drawings ORDER BY created_at DESC')
  return rows.map((r) => r.data)
}

export async function updateDrawing(
  id: string,
  patch: Partial<Omit<DrawingRecord, 'id' | 'createdAt'>>,
): Promise<DrawingRecord> {
  const existing = await getDrawing(id)
  if (!existing) throw new Error(`Drawing ${id} not found`)
  const updated: DrawingRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  await query('UPDATE drawings SET data = $1 WHERE id = $2', [JSON.stringify(updated), id])
  return updated
}
