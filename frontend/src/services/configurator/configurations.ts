import { query, queryOne, run } from '../../db/engine'
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
} from './rules'
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
} from './bom'
import { evaluateCompatibility, filterCompatible, type Selection } from './compatibility'
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
} from './types'

export interface ReferenceData {
  systemTypes: unknown[]
  doorArchitectures: unknown[]
  panelConfigurations: unknown[]
  profileFinishes: unknown[]
  profileSeries: unknown[]
  glassOptions: unknown[]
}

export async function getReference(): Promise<ReferenceData> {
  const [systemTypes, doorArchitectures, panelConfigurations, profileFinishes, profileSeries, glassOptions] = await Promise.all([
    query('SELECT * FROM system_types ORDER BY name'),
    query('SELECT * FROM door_architectures ORDER BY id'),
    query('SELECT * FROM panel_configurations ORDER BY total_panels'),
    query('SELECT * FROM profile_finishes ORDER BY name'),
    query('SELECT * FROM profile_series ORDER BY name'),
    query('SELECT * FROM glass_master ORDER BY thickness_mm'),
  ])
  return { systemTypes, doorArchitectures, panelConfigurations, profileFinishes, profileSeries, glassOptions }
}

const COMPATIBILITY_TABLES = new Set(['lock_master', 'handle_master', 'hinge_master', 'track_master', 'connector_master'])

export interface CompatibilityQuery {
  table: string
  systemTypeId?: number | null
  doorArchitectureId?: number | null
  panelConfigurationId?: number | null
  profileSeriesId?: number | null
  finishId?: number | null
  glassId?: number | null
}

export async function getCompatibility(input: CompatibilityQuery) {
  if (!COMPATIBILITY_TABLES.has(input.table)) {
    throw new Error(`Unknown or unsupported table "${input.table}"`)
  }
  const selection: Selection = {
    system_types: input.systemTypeId ?? null,
    door_architectures: input.doorArchitectureId ?? null,
    panel_configurations: input.panelConfigurationId ?? null,
    profile_series: input.profileSeriesId ?? null,
    profile_finishes: input.finishId ?? null,
    glass_master: input.glassId ?? null,
  }
  return filterCompatible(input.table, selection)
}

export async function listConfigurations() {
  return query('SELECT * FROM configurations ORDER BY created_at DESC')
}

export interface CreateConfigurationInput {
  name?: string
  systemTypeId: number
  doorArchitectureId: number
  panelConfigurationId: number
  profileSeriesId: number
  finishId: number
  glassId?: number | null
  widthMm: number
  heightMm: number
  customerId?: number | null
}

async function buildConfiguration(id: string, input: CreateConfigurationInput): Promise<ConfigurationResult> {
  const panelConfig = await queryOne<PanelConfiguration>('SELECT * FROM panel_configurations WHERE id = ?', [input.panelConfigurationId])
  if (!panelConfig) throw new Error('Unknown panel configuration')

  const finish = await queryOne<ProfileFinish>('SELECT * FROM profile_finishes WHERE id = ?', [input.finishId])
  if (!finish) throw new Error('Unknown finish')

  const finishGroup = await queryOne<FinishPriceGroup>('SELECT * FROM finish_price_groups WHERE id = ?', [finish.group_id])
  if (!finishGroup) throw new Error('Finish has no price group')

  const architecture = await queryOne<DoorArchitecture>('SELECT * FROM door_architectures WHERE id = ?', [input.doorArchitectureId])
  if (!architecture) throw new Error('Unknown door architecture')

  const glass = input.glassId ? await queryOne<GlassMaster>('SELECT * FROM glass_master WHERE id = ?', [input.glassId]) : undefined

  const profileLines = await computeProfileLines(input.profileSeriesId, panelConfig, input.widthMm, input.heightMm, finishGroup.multiplier)
  if (profileLines.length === 0) {
    throw new Error('Selected profile series has no profiles configured for its roles')
  }

  // Glass bead is sized by the glass's own thickness, not by a flat
  // per-series placeholder — override that one role's weight/cost in place
  // if a thickness band matches.
  const glassBead = glass ? await recommendGlassBead(glass.thickness_mm) : null
  if (glassBead) {
    const beadLine = profileLines.find((l) => l.role_name === 'Glass Bead')
    if (beadLine) {
      const lengthM = beadLine.length_mm / 1000
      beadLine.weight_kg = Number((beadLine.quantity * lengthM * glassBead.weight_per_metre_kg).toFixed(3))
      beadLine.cost = Number((beadLine.quantity * lengthM * glassBead.rate_per_metre * finishGroup.multiplier).toFixed(2))
    }
  }

  const doorWeightKg = estimateDoorWeightKg(profileLines, input.widthMm, input.heightMm, glass?.weight_per_sqft_kg ?? null)

  const [track, frame] = await Promise.all([
    recommendTrack(doorWeightKg, panelConfig, input.widthMm, architecture),
    recommendFrame(input.heightMm, input.widthMm, doorWeightKg),
  ])

  // Defense in depth: never hand back a component the compatibility engine
  // itself would reject, even if a recommendation-rule row suggests it.
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

  // Try a bundled OEM-style hardware set first. It only replaces the
  // individual picks if every one of its non-null component ids clears the
  // compatibility check.
  const hardwareSet = await recommendHardwareSet(architecture, input.profileSeriesId, doorWeightKg)
  let useHardwareSet = false
  if (hardwareSet) {
    const parts: [string, number | null][] = [
      ['hinge_master', hardwareSet.hinge_id],
      ['floor_spring_master', hardwareSet.floor_spring_id],
      ['handle_master', hardwareSet.handle_id],
      ['lock_master', hardwareSet.lock_id],
    ]
    const compatibilityChecks = await Promise.all(
      parts.map(async ([table, cid]) => cid === null || (await evaluateCompatibility(table, cid, selection)).allowed),
    )
    const allCompatible = compatibilityChecks.every(Boolean)
    const hingeGateOk = hardwareSet.hinge_id === null || architecture.uses_hinges
    if (allCompatible && hingeGateOk) {
      useHardwareSet = true
      if (hardwareSet.hinge_id) {
        hinge = (await queryOne<HingeMaster>('SELECT * FROM hinge_master WHERE id = ?', [hardwareSet.hinge_id])) ?? null
      }
      if (hardwareSet.floor_spring_id) {
        floorSpring = (await queryOne<FloorSpringMaster>('SELECT * FROM floor_spring_master WHERE id = ?', [hardwareSet.floor_spring_id])) ?? null
      }
      handle = (await queryOne<HandleMaster>('SELECT * FROM handle_master WHERE id = ?', [hardwareSet.handle_id])) ?? null
      lock = (await queryOne<LockMaster>('SELECT * FROM lock_master WHERE id = ?', [hardwareSet.lock_id])) ?? null
    }
  }

  if (!useHardwareSet) {
    hinge = await recommendHinge(architecture, doorWeightKg)
    if (hinge && !(await evaluateCompatibility('hinge_master', hinge.id, selection)).allowed) {
      hinge = null
    }
    floorSpring = await recommendFloorSpring(architecture, doorWeightKg)
    if (floorSpring && !(await evaluateCompatibility('floor_spring_master', floorSpring.id, selection)).allowed) {
      floorSpring = null
    }
    handle = await recommendHandle(selection)
    lock = await recommendLock(selection)
  }

  const hingeQuantity = hinge ? estimateHingeQuantity(input.heightMm) : 0

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

  bomLines.push(...(await computeConnectorLines(profileLines)))

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
      formula: `bundled OEM set (${parts}), compatibility-checked`,
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
        formula: 'cheapest compatible option',
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
        formula: 'cheapest compatible option',
      })
    }
  }

  const seal = await getDefaultSeal()
  if (seal) bomLines.push(computeSealLine(profileLines, seal))

  const tape = await getDefaultTape()
  if (tape) bomLines.push(computeTapeLine(input.widthMm, input.heightMm, tape))

  if (glass) bomLines.push(computeGlassLine(input.widthMm, input.heightMm, glass))

  bomLines.push(...(await computeAccessoryLines()))

  const pricing = await getPricingRules()
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
    customerId: input.customerId ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

async function persistConfiguration(result: ConfigurationResult) {
  run(
    `INSERT INTO configurations
      (id, name, system_type_id, door_architecture_id, panel_configuration_id, profile_series_id, finish_id, glass_id,
       width_mm, height_mm, estimated_door_weight_kg, recommended_track_id, recommended_frame_id, recommended_hinge_id,
       recommended_floor_spring_id, recommended_handle_id, recommended_lock_id, recommended_hardware_set_id,
       material_cost, waste_cost, total_cost, selling_price, customer_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
      result.customerId,
      result.createdAt,
      result.updatedAt,
    ],
  )

  for (const line of result.profileLines) {
    run(
      `INSERT INTO configuration_profile_lines (configuration_id, profile_id, role_name, quantity, length_mm, weight_kg, cost)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [result.id, line.profile_id, line.role_name, line.quantity, line.length_mm, line.weight_kg, line.cost],
    )
  }

  for (const line of result.bomLines) {
    run(
      `INSERT INTO configuration_bom_lines (configuration_id, category, item, quantity, unit, unit_cost, total_cost, formula)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [result.id, line.category, line.item, line.quantity, line.unit, line.unit_cost, line.total_cost, line.formula],
    )
  }
}

export async function createConfiguration(input: CreateConfigurationInput): Promise<ConfigurationResult> {
  const id = crypto.randomUUID()
  const result = await buildConfiguration(id, input)
  await persistConfiguration(result)
  return result
}

export async function getConfiguration(id: string) {
  const configuration = await queryOne('SELECT * FROM configurations WHERE id = ?', [id])
  if (!configuration) throw new Error('Configuration not found')
  const profileLines = await query('SELECT * FROM configuration_profile_lines WHERE configuration_id = ?', [id])
  const bomLines = await query('SELECT * FROM configuration_bom_lines WHERE configuration_id = ?', [id])
  return { ...configuration, profileLines, bomLines }
}
