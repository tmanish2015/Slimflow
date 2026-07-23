import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from './db.js'
import { asyncHandler } from '../asyncHandler.js'
import {
  computeProfileLines,
  estimateDoorWeightKg,
  estimateHingeQuantity,
  recommendFloorSpring,
  recommendFrame,
  recommendHandle,
  recommendHinge,
  recommendLock,
  recommendTrack,
} from './rules.js'
import {
  computeAccessoryLines,
  computeConnectorLines,
  computeGlassLine,
  computeSealLine,
  computeTapeLine,
  getDefaultSeal,
  getDefaultTape,
  getPricingRules,
  rollUpBom,
} from './bom.js'
import { evaluateCompatibility, filterCompatible, type Selection } from './compatibility.js'
import type {
  ConfigurationBomLine,
  ConfigurationResult,
  DoorArchitecture,
  GlassMaster,
  PanelConfiguration,
  ProfileFinish,
} from './types.js'

export const configuratorRouter = Router()

configuratorRouter.get(
  '/reference',
  asyncHandler(async (_req, res) => {
    res.json({
      systemTypes: db.prepare('SELECT * FROM system_types ORDER BY name').all(),
      doorArchitectures: db.prepare('SELECT * FROM door_architectures ORDER BY id').all(),
      panelConfigurations: db.prepare('SELECT * FROM panel_configurations ORDER BY total_panels').all(),
      profileFinishes: db.prepare('SELECT * FROM profile_finishes ORDER BY name').all(),
      profileSeries: db.prepare('SELECT * FROM profile_series ORDER BY name').all(),
      glassOptions: db.prepare('SELECT * FROM glass_master ORDER BY thickness_mm').all(),
    })
  }),
)

// Whitelisted so the `table` query param can never drive an arbitrary
// `SELECT * FROM <injected>` — these are the only master tables the
// compatibility engine currently knows how to check.
const COMPATIBILITY_TABLES = new Set(['lock_master', 'handle_master', 'hinge_master', 'track_master', 'connector_master'])

configuratorRouter.get(
  '/compatibility',
  asyncHandler(async (req, res) => {
    const table = String(req.query.table ?? '')
    if (!COMPATIBILITY_TABLES.has(table)) {
      res.status(400).json({ error: `Unknown or unsupported table "${table}"` })
      return
    }
    const num = (v: unknown) => (v != null && v !== '' ? Number(v) : null)
    const selection: Selection = {
      system_types: num(req.query.systemTypeId),
      door_architectures: num(req.query.doorArchitectureId),
      panel_configurations: num(req.query.panelConfigurationId),
      profile_series: num(req.query.profileSeriesId),
      profile_finishes: num(req.query.finishId),
      glass_master: num(req.query.glassId),
    }
    res.json(filterCompatible(table, selection))
  }),
)

configuratorRouter.get(
  '/configurations',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM configurations ORDER BY created_at DESC').all()
    res.json(rows)
  }),
)

const createConfigurationSchema = z.object({
  name: z.string().optional().default(''),
  systemTypeId: z.number(),
  doorArchitectureId: z.number(),
  panelConfigurationId: z.number(),
  profileSeriesId: z.number(),
  finishId: z.number(),
  glassId: z.number().nullable().optional(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
})

function buildConfiguration(id: string, input: z.infer<typeof createConfigurationSchema>): ConfigurationResult {
  const panelConfig = db
    .prepare('SELECT * FROM panel_configurations WHERE id = ?')
    .get(input.panelConfigurationId) as PanelConfiguration | undefined
  if (!panelConfig) throw new Error('Unknown panel configuration')

  const finish = db.prepare('SELECT * FROM profile_finishes WHERE id = ?').get(input.finishId) as
    | ProfileFinish
    | undefined
  if (!finish) throw new Error('Unknown finish')

  const architecture = db
    .prepare('SELECT * FROM door_architectures WHERE id = ?')
    .get(input.doorArchitectureId) as DoorArchitecture | undefined
  if (!architecture) throw new Error('Unknown door architecture')

  const glass = input.glassId
    ? (db.prepare('SELECT * FROM glass_master WHERE id = ?').get(input.glassId) as GlassMaster | undefined)
    : undefined

  const profileLines = computeProfileLines(
    input.profileSeriesId,
    panelConfig,
    input.widthMm,
    input.heightMm,
    finish.price_multiplier,
  )
  if (profileLines.length === 0) {
    throw new Error('Selected profile series has no profiles configured for its roles')
  }

  const doorWeightKg = estimateDoorWeightKg(
    profileLines,
    input.widthMm,
    input.heightMm,
    glass?.weight_per_sqft_kg ?? null,
  )

  const track = recommendTrack(doorWeightKg, panelConfig, input.widthMm, architecture)
  const frame = recommendFrame(input.heightMm, input.widthMm, doorWeightKg)
  let hinge = recommendHinge(architecture, doorWeightKg)

  // Defense in depth: the recommendation-rule tables and the compatibility
  // engine are two separate, independently-editable data sources (same
  // reasoning as the earlier track/frame capacity safety net) — an admin
  // could add a hinge_recommendation_rules row that a later
  // compatibility_rules exclusion invalidates. Never hand back a hinge the
  // compatibility engine itself would reject.
  const selection: Selection = {
    system_types: input.systemTypeId,
    door_architectures: input.doorArchitectureId,
    panel_configurations: input.panelConfigurationId,
    profile_series: input.profileSeriesId,
    profile_finishes: input.finishId,
    glass_master: input.glassId ?? null,
  }
  if (hinge && !evaluateCompatibility('hinge_master', hinge.id, selection).allowed) {
    hinge = null
  }
  const hingeQuantity = hinge ? estimateHingeQuantity(input.heightMm) : 0

  let floorSpring = recommendFloorSpring(architecture, doorWeightKg)
  if (floorSpring && !evaluateCompatibility('floor_spring_master', floorSpring.id, selection).allowed) {
    floorSpring = null
  }

  const handle = recommendHandle(selection)
  const lock = recommendLock(selection)

  // --- Step 16: assemble the complete BOM from every component above ---
  const bomLines: ConfigurationBomLine[] = profileLines.map((l) => ({
    category: 'Profile',
    item: l.role_name,
    quantity: l.quantity,
    unit: 'pcs',
    unit_cost: l.quantity > 0 ? Number((l.cost / l.quantity).toFixed(2)) : 0,
    total_cost: l.cost,
    formula: `${l.length_mm}mm cut length`,
  }))

  bomLines.push(...computeConnectorLines(profileLines))

  if (track) {
    const trackLengthM = (input.widthMm / 1000) * panelConfig.track_count
    bomLines.push({
      category: 'Track',
      item: track.name,
      quantity: Number(trackLengthM.toFixed(2)),
      unit: 'm',
      unit_cost: track.rate_per_metre,
      total_cost: Number((trackLengthM * track.rate_per_metre).toFixed(2)),
      formula: `width × ${panelConfig.track_count} track(s)`,
    })
  }

  if (hinge && hingeQuantity > 0) {
    bomLines.push({
      category: 'Hinge',
      item: hinge.name,
      quantity: hingeQuantity,
      unit: 'pcs',
      unit_cost: hinge.rate_per_unit,
      total_cost: Number((hingeQuantity * hinge.rate_per_unit).toFixed(2)),
      formula: '1 per ~700mm height, min 2',
    })
  }

  if (floorSpring) {
    bomLines.push({
      category: 'Floor Spring',
      item: floorSpring.name,
      quantity: 1,
      unit: 'pcs',
      unit_cost: floorSpring.rate_per_unit,
      total_cost: floorSpring.rate_per_unit,
      formula: 'default 1 per unit',
    })
  }

  if (handle) {
    bomLines.push({
      category: 'Handle',
      item: handle.name,
      quantity: 1,
      unit: 'pcs',
      unit_cost: handle.rate_per_unit,
      total_cost: handle.rate_per_unit,
      formula: 'cheapest compatible option (Step 17)',
    })
  }

  if (lock) {
    bomLines.push({
      category: 'Lock',
      item: lock.name,
      quantity: 1,
      unit: 'pcs',
      unit_cost: lock.rate_per_unit,
      total_cost: lock.rate_per_unit,
      formula: 'cheapest compatible option (Step 17)',
    })
  }

  const seal = getDefaultSeal()
  if (seal) bomLines.push(computeSealLine(profileLines, seal))

  const tape = getDefaultTape()
  if (tape) bomLines.push(computeTapeLine(input.widthMm, input.heightMm, tape))

  if (glass) bomLines.push(computeGlassLine(input.widthMm, input.heightMm, glass))

  bomLines.push(...computeAccessoryLines())

  const pricing = getPricingRules()
  const totals = rollUpBom(bomLines, pricing)

  const now = new Date().toISOString()

  return {
    id,
    name: input.name || `${architecture.name} ${panelConfig.label}`,
    systemTypeId: input.systemTypeId,
    doorArchitectureId: input.doorArchitectureId,
    panelConfigurationId: input.panelConfigurationId,
    profileSeriesId: input.profileSeriesId,
    finishId: input.finishId,
    glassId: input.glassId ?? null,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    profileLines,
    estimatedDoorWeightKg: doorWeightKg,
    recommendedTrack: track,
    recommendedFrame: frame,
    recommendedHinge: hinge,
    hingeQuantity,
    recommendedFloorSpring: floorSpring,
    recommendedHandle: handle,
    recommendedLock: lock,
    bomLines,
    materialCost: totals.materialCost,
    wasteCost: totals.wasteCost,
    totalCost: totals.totalCost,
    sellingPrice: totals.sellingPrice,
    createdAt: now,
    updatedAt: now,
  }
}

function persistConfiguration(result: ConfigurationResult) {
  db.prepare(
    `INSERT INTO configurations
      (id, name, system_type_id, door_architecture_id, panel_configuration_id, profile_series_id, finish_id, glass_id,
       width_mm, height_mm, estimated_door_weight_kg, recommended_track_id, recommended_frame_id, recommended_hinge_id,
       recommended_floor_spring_id, recommended_handle_id, recommended_lock_id,
       material_cost, waste_cost, total_cost, selling_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    result.id,
    result.name,
    result.systemTypeId,
    result.doorArchitectureId,
    result.panelConfigurationId,
    result.profileSeriesId,
    result.finishId,
    result.glassId,
    result.widthMm,
    result.heightMm,
    result.estimatedDoorWeightKg,
    result.recommendedTrack?.id ?? null,
    result.recommendedFrame?.id ?? null,
    result.recommendedHinge?.id ?? null,
    result.recommendedFloorSpring?.id ?? null,
    result.recommendedHandle?.id ?? null,
    result.recommendedLock?.id ?? null,
    result.materialCost,
    result.wasteCost,
    result.totalCost,
    result.sellingPrice,
    result.createdAt,
    result.updatedAt,
  )

  const insertLine = db.prepare(
    `INSERT INTO configuration_profile_lines
      (configuration_id, profile_id, role_name, quantity, length_mm, weight_kg, cost)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const line of result.profileLines) {
    insertLine.run(result.id, line.profile_id, line.role_name, line.quantity, line.length_mm, line.weight_kg, line.cost)
  }

  const insertBomLine = db.prepare(
    `INSERT INTO configuration_bom_lines
      (configuration_id, category, item, quantity, unit, unit_cost, total_cost, formula)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const line of result.bomLines) {
    insertBomLine.run(result.id, line.category, line.item, line.quantity, line.unit, line.unit_cost, line.total_cost, line.formula)
  }
}

configuratorRouter.post(
  '/configurations',
  asyncHandler(async (req, res) => {
    const parsed = createConfigurationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const id = randomUUID()
      const result = buildConfiguration(id, parsed.data)
      persistConfiguration(result)
      res.status(201).json(result)
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Could not build configuration' })
    }
  }),
)

configuratorRouter.get(
  '/configurations/:id',
  asyncHandler(async (req, res) => {
    const configuration = db.prepare('SELECT * FROM configurations WHERE id = ?').get(req.params.id)
    if (!configuration) {
      res.status(404).json({ error: 'Configuration not found' })
      return
    }
    const profileLines = db
      .prepare('SELECT * FROM configuration_profile_lines WHERE configuration_id = ?')
      .all(req.params.id)
    const bomLines = db
      .prepare('SELECT * FROM configuration_bom_lines WHERE configuration_id = ?')
      .all(req.params.id)
    res.json({ ...configuration, profileLines, bomLines })
  }),
)
