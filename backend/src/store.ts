import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

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
  unit: 'mm' | 'cm' | 'in' | null
  confidence: number
  source: 'vector-pdf' | 'ocr'
  bbox: { x: number; y: number; width: number; height: number } | null
  confirmed: boolean
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
  bom: Bom | null
  createdAt: string
  updatedAt: string
}

const DATA_DIR = path.resolve(import.meta.dirname, '../data')
const DB_FILE = path.join(DATA_DIR, 'drawings.json')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
export const PROCESSED_DIR = path.join(DATA_DIR, 'processed')

interface DbShape {
  drawings: Record<string, DrawingRecord>
}

let cache: DbShape | null = null

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true })
  await mkdir(UPLOAD_DIR, { recursive: true })
  await mkdir(PROCESSED_DIR, { recursive: true })
}

async function load(): Promise<DbShape> {
  if (cache) return cache
  await ensureDirs()
  try {
    const raw = await readFile(DB_FILE, 'utf-8')
    cache = JSON.parse(raw) as DbShape
  } catch {
    cache = { drawings: {} }
  }
  return cache
}

async function persist() {
  if (!cache) return
  await writeFile(DB_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

export async function createDrawing(input: {
  originalFilename: string
  mimeType: string
  storedPath: string
}): Promise<DrawingRecord> {
  const db = await load()
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
    bom: null,
    createdAt: now,
    updatedAt: now,
  }
  db.drawings[record.id] = record
  await persist()
  return record
}

export async function getDrawing(id: string): Promise<DrawingRecord | undefined> {
  const db = await load()
  return db.drawings[id]
}

export async function listDrawings(): Promise<DrawingRecord[]> {
  const db = await load()
  return Object.values(db.drawings).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function updateDrawing(
  id: string,
  patch: Partial<Omit<DrawingRecord, 'id' | 'createdAt'>>,
): Promise<DrawingRecord> {
  const db = await load()
  const existing = db.drawings[id]
  if (!existing) throw new Error(`Drawing ${id} not found`)
  const updated: DrawingRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  db.drawings[id] = updated
  await persist()
  return updated
}
