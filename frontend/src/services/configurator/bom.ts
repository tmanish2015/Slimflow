import { query, queryOne } from '../../db/engine'
import type {
  AccessoryMaster,
  ConfigurationBomLine,
  ConfigurationProfileLine,
  ConnectorMaster,
  GlassMaster,
  PricingRules,
  SealMaster,
  TapeMaster,
} from './types'

const SQM_PER_SQFT = 0.092903

export async function getPricingRules(): Promise<PricingRules> {
  const row = await queryOne<PricingRules>('SELECT * FROM pricing_rules ORDER BY id LIMIT 1')
  if (!row) throw new Error('pricing_rules table is empty')
  return row
}

export async function getDefaultSeal(): Promise<SealMaster | null> {
  return (await queryOne<SealMaster>('SELECT * FROM seal_master ORDER BY rate_per_metre ASC LIMIT 1')) ?? null
}

export async function getDefaultTape(): Promise<TapeMaster | null> {
  return (await queryOne<TapeMaster>('SELECT * FROM tape_master ORDER BY rate_per_sqft ASC LIMIT 1')) ?? null
}

/**
 * Connector quantities derived from which profile roles are actually
 * present in this configuration (frame corners always need 4; each interior
 * divider needs a connector at both ends it joins to).
 */
export async function computeConnectorLines(profileLines: ConfigurationProfileLine[]): Promise<ConfigurationBomLine[]> {
  const lines: ConfigurationBomLine[] = []
  const byName = (name: string) => queryOne<ConnectorMaster>('SELECT * FROM connector_master WHERE name = ?', [name])

  const corner = await byName('Corner Connector')
  if (corner) {
    lines.push({
      category: 'Connector',
      item: corner.name,
      quantity: 4,
      unit: 'pcs',
      unit_cost: corner.rate_per_unit,
      total_cost: Number((4 * corner.rate_per_unit).toFixed(2)),
      formula: '4 frame corners, fixed',
    })
  }

  const centreDivider = profileLines.find((l) => l.role_name === 'Centre Divider')
  const divider = await byName('Divider Connector')
  if (centreDivider && centreDivider.quantity > 0 && divider) {
    const qty = centreDivider.quantity * 2
    lines.push({
      category: 'Connector',
      item: divider.name,
      quantity: qty,
      unit: 'pcs',
      unit_cost: divider.rate_per_unit,
      total_cost: Number((qty * divider.rate_per_unit).toFixed(2)),
      formula: `${centreDivider.quantity} centre divider(s) × 2 ends`,
    })
  }

  const horizontalDivider = profileLines.find((l) => l.role_name === 'Horizontal Divider')
  const tConnector = await byName('T Connector')
  if (horizontalDivider && horizontalDivider.quantity > 0 && tConnector) {
    const qty = horizontalDivider.quantity * 2
    lines.push({
      category: 'Connector',
      item: tConnector.name,
      quantity: qty,
      unit: 'pcs',
      unit_cost: tConnector.rate_per_unit,
      total_cost: Number((qty * tConnector.rate_per_unit).toFixed(2)),
      formula: `${horizontalDivider.quantity} horizontal divider(s) × 2 ends`,
    })
  }

  return lines
}

/** PVC seal running length: sum of every profile line's total cut length. */
export function computeSealLine(profileLines: ConfigurationProfileLine[], seal: SealMaster): ConfigurationBomLine {
  const totalLengthM = profileLines.reduce((sum, l) => sum + (l.quantity * l.length_mm) / 1000, 0)
  return {
    category: 'Seal',
    item: seal.name,
    quantity: Number(totalLengthM.toFixed(2)),
    unit: 'm',
    unit_cost: seal.rate_per_metre,
    total_cost: Number((totalLengthM * seal.rate_per_metre).toFixed(2)),
    formula: 'sum of all profile-line running lengths',
  }
}

/** Double-side tape by opening area (glass/panel area). */
export function computeTapeLine(widthMm: number, heightMm: number, tape: TapeMaster): ConfigurationBomLine {
  const areaSqft = ((widthMm / 1000) * (heightMm / 1000)) / SQM_PER_SQFT
  return {
    category: 'Tape',
    item: tape.name,
    quantity: Number(areaSqft.toFixed(2)),
    unit: 'sqft',
    unit_cost: tape.rate_per_sqft,
    total_cost: Number((areaSqft * tape.rate_per_sqft).toFixed(2)),
    formula: 'W × H opening area',
  }
}

/** Glass area/cost. Weight isn't part of the BOM line itself (it already
 * fed estimateDoorWeightKg upstream) but area and cost are. */
export function computeGlassLine(widthMm: number, heightMm: number, glass: GlassMaster): ConfigurationBomLine {
  const areaSqft = ((widthMm / 1000) * (heightMm / 1000)) / SQM_PER_SQFT
  return {
    category: 'Glass',
    item: `${glass.name} (${glass.thickness_mm}mm ${glass.glass_type})`,
    quantity: Number(areaSqft.toFixed(2)),
    unit: 'sqft',
    unit_cost: glass.rate_per_sqft,
    total_cost: Number((areaSqft * glass.rate_per_sqft).toFixed(2)),
    formula: 'W × H opening area',
  }
}

// Standard small-hardware quantities per unit — named, editable defaults
// rather than a computed guess (real counts depend on per-panel geometry
// this model doesn't track yet).
const DEFAULT_ACCESSORY_QTY: Record<string, number> = {
  'End Cap': 4,
  'Corner Key': 4,
  'Weep Hole Cover': 2,
  'Silicone Sealant Tube': 1,
}

export async function computeAccessoryLines(): Promise<ConfigurationBomLine[]> {
  const rows = await query<AccessoryMaster>('SELECT * FROM accessory_master')
  return rows.map((row) => {
    const qty = DEFAULT_ACCESSORY_QTY[row.name] ?? 1
    return {
      category: 'Accessory',
      item: row.name,
      quantity: qty,
      unit: row.unit,
      unit_cost: row.rate,
      total_cost: Number((qty * row.rate).toFixed(2)),
      formula: 'standard qty per unit',
    }
  })
}

export interface BomTotals {
  materialCost: number
  wasteCost: number
  totalCost: number
  sellingPrice: number
}

/** Final roll-up — waste/margin from the editable pricing_rules row. */
export function rollUpBom(lines: ConfigurationBomLine[], pricing: PricingRules): BomTotals {
  const materialCost = lines.reduce((sum, l) => sum + l.total_cost, 0)
  const wasteCost = (materialCost * pricing.waste_percent) / 100
  const totalCost = materialCost + wasteCost
  const sellingPrice = totalCost * (1 + pricing.margin_percent / 100)
  return {
    materialCost: Number(materialCost.toFixed(2)),
    wasteCost: Number(wasteCost.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    sellingPrice: Number(sellingPrice.toFixed(2)),
  }
}
