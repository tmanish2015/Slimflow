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

// Manually-tagged design element the automatic pipeline can't detect (e.g.
// an arched fanlight from a hand sketch) — human-entered, not inferred.
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
  dimensions: ExtractedDimension[]
  features: DrawingFeature[]
  hardwareItems: HardwareItem[]
  panelMaterial: PanelMaterial
  bom: Bom | null
  customerId: number | null
  createdAt: string
  updatedAt: string
}

export interface RateMaster {
  currency: string
  profileRatePerKg: number
  profileWeightPerMetreKg: number
  barLengthM: number
  glassRatePerSqft: number
  acpRatePerSqft: number
  wpcRatePerSqft: number
  hardwareSetRate: number
  hingeRate: number
  fastenerRatePerUnit: number
  fastenersPerMetre: number
  labourRatePerSqft: number
  wastePercent: number
  marginPercent: number
}
