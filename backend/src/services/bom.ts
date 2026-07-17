import type { Bom, BomLine, DrawingFeature, ExtractedDimension } from '../store.js'
import { toMillimetres } from './dimensionParser.js'
import type { RateMaster } from './rateMaster.js'

const SQM_PER_SQFT = 0.092903

function firstValueMm(dims: ExtractedDimension[], kind: ExtractedDimension['kind']): number | null {
  const dim = dims.find((d) => d.kind === kind && d.confirmed && d.value != null)
  if (!dim || dim.value == null) return null
  return toMillimetres(dim.value, dim.unit)
}

function firstValue(dims: ExtractedDimension[], kind: ExtractedDimension['kind']): number | null {
  const dim = dims.find((d) => d.kind === kind && d.confirmed && d.value != null)
  return dim?.value ?? null
}

/**
 * Deterministic BOM math — every line is a disclosed formula over confirmed
 * dimensions and the editable rate master, not a model estimate. Matches the
 * "no simulated AI" convention: thresholds/assumptions are named in comments
 * so a fabricator can sanity-check every number.
 */
export function generateBom(
  dimensions: ExtractedDimension[],
  features: DrawingFeature[],
  rates: RateMaster,
): Bom {
  const widthMm = firstValueMm(dimensions, 'width')
  const heightMm = firstValueMm(dimensions, 'height')
  if (widthMm == null || heightMm == null) {
    throw new Error('Confirm both Width and Height before generating a BOM')
  }

  const frameMm = firstValue(dimensions, 'frame') // frame section size, mm — informational only pre-MVP
  const mullionCount = firstValue(dimensions, 'mullion_count') ?? 0
  const transomCount = firstValue(dimensions, 'transom_count') ?? 0

  const widthM = widthMm / 1000
  const heightM = heightMm / 1000

  // Perimeter for the outer frame, plus one bar per interior mullion (runs
  // full height) and one per transom (runs full width) — the standard
  // aluminium-fabrication convention for straight (non-mitred-interior) bars.
  const perimeterM = 2 * (widthM + heightM)
  const mullionLengthM = mullionCount * heightM
  const transomLengthM = transomCount * widthM
  const totalProfileLengthM = perimeterM + mullionLengthM + transomLengthM

  const barsRequired = Math.ceil(totalProfileLengthM / rates.barLengthM)
  const profileWeightKg = totalProfileLengthM * rates.profileWeightPerMetreKg
  const profileCost = profileWeightKg * rates.profileRatePerKg

  // Net glass area deducts the frame section on all four sides when a frame
  // size was confirmed; otherwise falls back to the full opening (disclosed
  // via the line's formula string so it's clear which case applied).
  const glassWidthM = frameMm ? Math.max(widthM - (2 * frameMm) / 1000, 0) : widthM
  const glassHeightM = frameMm ? Math.max(heightM - (2 * frameMm) / 1000, 0) : heightM
  const glassAreaSqft = (glassWidthM * glassHeightM) / SQM_PER_SQFT
  const glassCost = glassAreaSqft * rates.glassRatePerSqft

  // Openable-panel/hardware-set count isn't detected by OCR yet, so this
  // defaults to 1 set — always visible and editable via the rate master.
  const hardwareQty = 1
  const hardwareCost = hardwareQty * rates.hardwareSetRate

  const fastenersQty = Math.ceil(totalProfileLengthM * rates.fastenersPerMetre)
  const fastenersCost = fastenersQty * rates.fastenerRatePerUnit

  // Manually-tagged design elements the automatic pipeline can't detect
  // (e.g. an arched fanlight) — cost is whatever the user entered for it,
  // not computed, since there's no geometry to compute it from.
  const featuresCost = features.reduce((sum, f) => sum + f.cost, 0)

  const materialCost = profileCost + glassCost + hardwareCost + fastenersCost + featuresCost
  const wasteCost = ((profileCost + glassCost) * rates.wastePercent) / 100
  const labourCost = glassAreaSqft * rates.labourRatePerSqft
  const totalCost = materialCost + wasteCost + labourCost
  const sellingPrice = totalCost * (1 + rates.marginPercent / 100)

  const lines: BomLine[] = [
    {
      category: 'Profile',
      item: `Aluminium profile bars (${rates.barLengthM}m std.)`,
      quantity: barsRequired,
      unit: 'bars',
      unitCost: rates.profileRatePerKg * rates.profileWeightPerMetreKg * rates.barLengthM,
      totalCost: profileCost,
      formula: `perimeter 2×(W+H) + ${mullionCount} mullion(s)×H + ${transomCount} transom(s)×W = ${totalProfileLengthM.toFixed(2)}m × ${rates.profileWeightPerMetreKg}kg/m × ₹${rates.profileRatePerKg}/kg`,
    },
    {
      category: 'Glass',
      item: 'Glass panel(s)',
      quantity: Number(glassAreaSqft.toFixed(2)),
      unit: 'sqft',
      unitCost: rates.glassRatePerSqft,
      totalCost: glassCost,
      formula: frameMm
        ? `(W − 2×frame) × (H − 2×frame) = ${glassWidthM.toFixed(2)}m × ${glassHeightM.toFixed(2)}m`
        : `W × H (no frame section confirmed, using full opening)`,
    },
    {
      category: 'Hardware',
      item: 'Handle/lock set',
      quantity: hardwareQty,
      unit: 'set',
      unitCost: rates.hardwareSetRate,
      totalCost: hardwareCost,
      formula: 'default 1 set per unit — edit once openable-panel detection is added',
    },
    {
      category: 'Fasteners',
      item: 'Screws/fasteners',
      quantity: fastenersQty,
      unit: 'pcs',
      unitCost: rates.fastenerRatePerUnit,
      totalCost: fastenersCost,
      formula: `${rates.fastenersPerMetre}/m × ${totalProfileLengthM.toFixed(2)}m profile`,
    },
    ...features.map((f) => ({
      category: 'Special Feature',
      item: f.material ? `${f.label} (${f.material})` : f.label,
      quantity: 1,
      unit: 'unit',
      unitCost: f.cost,
      totalCost: f.cost,
      formula: 'manually entered — not auto-detected from the drawing',
    })),
  ]

  return {
    lines,
    materialCost,
    wasteCost,
    labourCost,
    totalCost,
    sellingPrice,
    generatedAt: new Date().toISOString(),
  }
}
