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
  recommendGlassBead,
  recommendHandle,
  recommendHardwareSet,
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
  FinishPriceGroup,
  FloorSpringMaster,
  GlassMaster,
  HandleMaster,
  HingeMaster,
  LockMaster,
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

  const finishGroup = db.prepare('SELECT * FROM finish_price_groups WHERE id = ?').get(finish.group_id) as
    | FinishPriceGroup
    | undefined
  if (!finishGroup) throw new Error('Finish has no price group')

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
    finishGroup.multiplier,
  )
  if (profileLines.length === 0) {
    throw new Error('Selected profile series has no profiles configured for its roles')
  }

  // Glass bead is sized by the glass's own thickness, not by a flat
  // per-series placeholder — override that one role's weight/cost in place
  // if a thickness band matches, so the door-weight estimate and every BOM
  // line derived from profileLines below pick up the change automatically.
  // No glass selected, or an out-of-range thickness with no admin-defined
  // band: leave the series' own Glass Bead profile line as-is.
  const glassBead = glass ? recommendGlassBead(glass.thickness_mm) : null
  if (glassBead) {
    const beadLine = profileLines.find((l) => l.role_name === 'Glass Bead')
    if (beadLine) {
      const lengthM = beadLine.length_mm / 1000
      beadLine.weight_kg = Number((beadLine.quantity * lengthM * glassBead.weight_per_metre_kg).toFixed(3))
      beadLine.cost = Number((beadLine.quantity * lengthM * glassBead.rate_per_metre * finishGroup.multiplier).toFixed(2))
    }
  }

  const doorWeightKg = estimateDoorWeightKg(
    profileLines,
    input.widthMm,
    input.heightMm,
    glass?.weight_per_sqft_kg ?? null,
  )

  const track = recommendTrack(doorWeightKg, panelConfig, input.widthMm, architecture)
  const frame = recommendFrame(input.heightMm, input.widthMm, doorWeightKg)

  // Defense in depth: the recommendation-rule tables and the compatibility
  // engine are two separate, independently-editable data sources (same
  // reasoning as the earlier track/frame capacity safety net) — an admin
  // could add a *_recommendation_rules row that a later compatibility_rules
  // exclusion invalidates. Never hand back a component the compatibility
  // engine itself would reject.
  const selection: Selection = {
    system_types: input.systemTypeId,
    door_architectures: input.doorArchitectureId,
    panel_configurations: input.panelConfigurationId,
    profile_series: input.profileSeriesId,
    profile_finishes: input.finishId,
    glass_master: input.glassId ?? null,
  }

  let hinge: HingeMaster | null = null
  let floorSpring: FloorSpringMaster | null = null
  let handle: HandleMaster | null = null
  let lock: LockMaster | null = null

  // Try a bundled OEM-style hardware set first (Step 6/10-14, all four
  // components as one priced SKU). It only replaces the individual picks if
  // every one of its non-null component ids clears the Step 17 compatibility
  // check — an admin can free-associate any hinge/floor-spring/handle/lock
  // into a set, so this is the same capacity-safety-net pattern as
  // recommendTrack/recommendFrame, just checked as a group instead of solo.
  // Falling back to the pre-existing individual-pick logic (unchanged below)
  // keeps every architecture that has no matching set working exactly as
  // before this feature existed.
  const hardwareSet = recommendHardwareSet(architecture, input.profileSeriesId, doorWeightKg)
  let useHardwareSet = false
  if (hardwareSet) {
    const parts: [string, number | null][] = [
      ['hinge_master', hardwareSet.hinge_id],
      ['floor_spring_master', hardwareSet.floor_spring_id],
      ['handle_master', hardwareSet.handle_id],
      ['lock_master', hardwareSet.lock_id],
    ]
    const allCompatible = parts.every(
      ([table, id]) => id === null || evaluateCompatibility(table, id, selection).allowed,
    )
    const hingeGateOk = hardwareSet.hinge_id === null || architecture.uses_hinges
    if (allCompatible && hingeGateOk) {
      useHardwareSet = true
      if (hardwareSet.hinge_id) {
        hinge = db.prepare('SELECT * FROM hinge_master WHERE id = ?').get(hardwareSet.hinge_id) as unknown as HingeMaster
      }
      if (hardwareSet.floor_spring_id) {
        floorSpring = db
          .prepare('SELECT * FROM floor_spring_master WHERE id = ?')
          .get(hardwareSet.floor_spring_id) as unknown as FloorSpringMaster
      }
      handle = db.prepare('SELECT * FROM handle_master WHERE id = ?').get(hardwareSet.handle_id) as unknown as HandleMaster
      lock = db.prepare('SELECT * FROM lock_master WHERE id = ?').get(hardwareSet.lock_id) as unknown as LockMaster
    }
  }

  if (!useHardwareSet) {
    hinge = recommendHinge(architecture, doorWeightKg)
    if (hinge && !evaluateCompatibility('hinge_master', hinge.id, selection).allowed) {
      hinge = null
    }
    floorSpring = recommendFloorSpring(architecture, doorWeightKg)
    if (floorSpring && !evaluateCompatibility('floor_spring_master', floorSpring.id, selection).allowed) {
      floorSpring = null
    }
    handle = recommendHandle(selection)
    lock = recommendLock(selection)
  }

  const hingeQuantity = hinge ? estimateHingeQuantity(input.heightMm) : 0

  // --- Step 16: assemble the complete BOM from every component above ---
  const bomLines: ConfigurationBomLine[] = profileLines.map((l) => ({
    category: 'Profile',
    item: l.role_name,
    quantity: l.quantity,
    unit: 'pcs',
    unit_cost: l.quantity > 0 ? Number((l.cost / l.quantity).toFixed(2)) : 0,
    total_cost: l.cost,
    formula:
      l.role_name === 'Glass Bead' && glassBead
        ? `${l.length_mm}mm cut length, ${glassBead.name} (${glass!.thickness_mm}mm glass)`
        : `${l.length_mm}mm cut length`,
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

  if (useHardwareSet && hardwareSet) {
    const parts = [hinge?.name, floorSpring?.name, handle?.name, lock?.name].filter(Boolean).join(' + ')
    bomLines.push({
      category: 'Hardware Set',
      item: hardwareSet.name,
      quantity: 1,
      unit: 'set',
      unit_cost: hardwareSet.rate_per_set,
      total_cost: hardwareSet.rate_per_set,
      formula: `bundled OEM set (${parts}), Step 17-checked`,
    })
  } else {
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
    recommendedHardwareSet: useHardwareSet ? hardwareSet : null,
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
       recommended_floor_spring_id, recommended_handle_id, recommended_lock_id, recommended_hardware_set_id,
       material_cost, waste_cost, total_cost, selling_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    result.recommendedHardwareSet?.id ?? null,
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
