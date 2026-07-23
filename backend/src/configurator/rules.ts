import { db } from './db.js'
import { evaluateCompatibility, type Selection } from './compatibility.js'
import type {
  ConfigurationProfileLine,
  DoorArchitecture,
  FloorSpringMaster,
  FrameMaster,
  HandleMaster,
  HingeMaster,
  LockMaster,
  PanelConfiguration,
  ProfileRole,
  TrackMaster,
} from './types.js'

const SQM_PER_SQFT = 0.092903
const HINGE_SPACING_MM = 700
const MIN_HINGES = 2

/**
 * Step 4 — automatic frame profile quantity/length/weight/cost calculation.
 * One line per profile role that exists for the chosen series. Orientation
 * decides whether a role's cut length comes from width or height;
 * scaling_rule decides whether quantity is fixed or scales with panel count
 * (e.g. Centre Divider = total_panels - 1, clamped at 0 for single-panel
 * configs). Rates apply the finish's price_multiplier — changing finish
 * changes every line's cost without touching the quantities.
 */
export function computeProfileLines(
  seriesId: number,
  panelConfig: PanelConfiguration,
  widthMm: number,
  heightMm: number,
  priceMultiplier: number,
): ConfigurationProfileLine[] {
  const rows = db
    .prepare(
      `SELECT p.id as profile_id, p.name, p.weight_per_metre_kg, p.rate_per_kg,
              r.name as role_name, r.orientation, r.scaling_rule, r.fixed_qty
       FROM profiles p JOIN profile_roles r ON r.id = p.role_id
       WHERE p.series_id = ?`,
    )
    .all(seriesId) as {
    profile_id: number
    name: string
    weight_per_metre_kg: number
    rate_per_kg: number
    role_name: string
    orientation: 'horizontal' | 'vertical'
    scaling_rule: ProfileRole['scaling_rule']
    fixed_qty: number
  }[]

  return rows.map((row) => {
    const quantity =
      row.scaling_rule === 'per_divider' ? Math.max(panelConfig.total_panels - 1, 0) : row.fixed_qty
    const lengthMm = row.orientation === 'horizontal' ? widthMm : heightMm
    const lengthM = lengthMm / 1000
    const weightKg = quantity * lengthM * row.weight_per_metre_kg
    const cost = weightKg * row.rate_per_kg * priceMultiplier
    return {
      profile_id: row.profile_id,
      role_name: row.role_name,
      quantity,
      length_mm: lengthMm,
      weight_kg: Number(weightKg.toFixed(3)),
      cost: Number(cost.toFixed(2)),
    }
  })
}

/** Simplified door-weight estimate (profile weight + glass weight) feeding
 * the track/frame/hinge recommendation rules — same disclosed-formula
 * approach as the drawing-recognition BOM, not a black-box estimate. */
export function estimateDoorWeightKg(
  profileLines: ConfigurationProfileLine[],
  widthMm: number,
  heightMm: number,
  glassWeightPerSqftKg: number | null,
): number {
  const profileWeight = profileLines.reduce((sum, l) => sum + l.weight_kg, 0)
  const areaSqft = ((widthMm / 1000) * (heightMm / 1000)) / SQM_PER_SQFT
  const glassWeight = glassWeightPerSqftKg ? areaSqft * glassWeightPerSqftKg : 0
  return Number((profileWeight + glassWeight).toFixed(2))
}

/**
 * Step 3 + Step 7 — track recommendation. The rule table encodes the
 * *policy* ("heavy-duty panel config -> at least Heavy Track") as editable
 * threshold-band rows, matched by highest `priority`. But a rule match is
 * only a starting point: if that track's own max_capacity_kg/max_span_mm
 * can't actually carry this door's estimated weight/width, it's escalated to
 * the cheapest track that genuinely can — Step 7 explicitly calls out
 * "Track Capacity" as a driving factor, so a policy match can never override
 * a real capacity shortfall. Soft Close is a premium opt-in, excluded from
 * automatic selection (would otherwise "win" on capacity in some bands).
 * Gated on `architecture.uses_track` — an Openable/Fixed/Pivot/French door
 * doesn't run on a track at all, so no track is recommended for one
 * regardless of weight (that gate is data on door_architectures, not a
 * name check in code — see schema.sql).
 */
export function recommendTrack(
  doorWeightKg: number,
  panelConfig: PanelConfiguration,
  widthMm: number,
  architecture: DoorArchitecture,
): TrackMaster | null {
  if (!architecture.uses_track) return null

  const rules = db
    .prepare(
      `SELECT * FROM track_recommendation_rules
       WHERE min_door_weight_kg <= ?
         AND (max_door_weight_kg IS NULL OR max_door_weight_kg >= ?)
         AND (requires_heavy_duty_config IS NULL OR requires_heavy_duty_config = ?)
         AND (max_span_mm IS NULL OR max_span_mm >= ?)
       ORDER BY priority DESC LIMIT 1`,
    )
    .get(doorWeightKg, doorWeightKg, panelConfig.is_heavy_duty, widthMm) as { recommended_track_id: number } | undefined

  let track = rules
    ? (db.prepare('SELECT * FROM track_master WHERE id = ?').get(rules.recommended_track_id) as unknown as
        | TrackMaster
        | undefined)
    : undefined

  if (!track || track.max_capacity_kg < doorWeightKg || track.max_span_mm < widthMm) {
    const capable = db
      .prepare(
        `SELECT * FROM track_master WHERE duty_class != 'soft_close' AND max_capacity_kg >= ? AND max_span_mm >= ?
         ORDER BY max_capacity_kg ASC LIMIT 1`,
      )
      .get(doorWeightKg, widthMm) as unknown as TrackMaster | undefined
    track =
      capable ??
      (db
        .prepare(`SELECT * FROM track_master WHERE duty_class != 'soft_close' ORDER BY max_capacity_kg DESC LIMIT 1`)
        .get() as unknown as TrackMaster | undefined) ??
      track
  }
  return track ?? null
}

/**
 * Step 8 — door frame class recommendation from height/width/weight bands,
 * with the same capacity safety net as recommendTrack: a rule match whose
 * frame can't actually bear the estimated door weight gets escalated to the
 * cheapest frame that can.
 */
export function recommendFrame(heightMm: number, widthMm: number, doorWeightKg: number): FrameMaster | null {
  const rule = db
    .prepare(
      `SELECT * FROM frame_recommendation_rules
       WHERE min_height_mm <= ? AND (max_height_mm IS NULL OR max_height_mm >= ?)
         AND min_width_mm <= ? AND (max_width_mm IS NULL OR max_width_mm >= ?)
         AND min_total_weight_kg <= ?
       ORDER BY priority DESC LIMIT 1`,
    )
    .get(heightMm, heightMm, widthMm, widthMm, doorWeightKg) as { recommended_frame_id: number } | undefined

  let frame = rule
    ? (db.prepare('SELECT * FROM frame_master WHERE id = ?').get(rule.recommended_frame_id) as unknown as
        | FrameMaster
        | undefined)
    : undefined

  if (!frame || frame.max_capacity_kg < doorWeightKg) {
    const capable = db
      .prepare('SELECT * FROM frame_master WHERE max_capacity_kg >= ? ORDER BY max_capacity_kg ASC LIMIT 1')
      .get(doorWeightKg) as unknown as FrameMaster | undefined
    frame =
      capable ??
      (db.prepare('SELECT * FROM frame_master ORDER BY max_capacity_kg DESC LIMIT 1').get() as unknown as
        | FrameMaster
        | undefined) ??
      frame
  }
  return frame ?? null
}

/**
 * Step 9 — hinge recommendation. Gated on `architecture.uses_hinges` (data,
 * not a name check) — Sliding/Fixed/Pocket Door correctly get no hinge at
 * all, same reasoning as recommendTrack's uses_track gate.
 */
export function recommendHinge(architecture: DoorArchitecture, doorWeightKg: number): HingeMaster | null {
  if (!architecture.uses_hinges) return null

  const rule = db
    .prepare(
      `SELECT * FROM hinge_recommendation_rules
       WHERE (door_architecture_id IS NULL OR door_architecture_id = ?)
         AND min_door_weight_kg <= ? AND (max_door_weight_kg IS NULL OR max_door_weight_kg >= ?)
       ORDER BY priority DESC LIMIT 1`,
    )
    .get(architecture.id, doorWeightKg, doorWeightKg) as { recommended_hinge_id: number } | undefined
  if (!rule) return null
  return db.prepare('SELECT * FROM hinge_master WHERE id = ?').get(rule.recommended_hinge_id) as unknown as HingeMaster
}

/** Same disclosed rule as the drawing-recognition hardware suggestion:
 * 1 hinge per ~700mm of height, minimum 2. Only meaningful when a hinge
 * type was actually recommended (hinged architectures). */
export function estimateHingeQuantity(heightMm: number): number {
  return Math.max(MIN_HINGES, Math.ceil(heightMm / HINGE_SPACING_MM))
}

/**
 * Step 10 — floor spring recommendation. No architecture flag column here
 * (unlike uses_track/uses_hinges): only Pivot doors have any
 * floor_spring_recommendation_rules rows seeded, so the absence of a match
 * *is* the correct "not applicable" for every other architecture — adding an
 * explicit flag would just duplicate that same fact in two places.
 */
export function recommendFloorSpring(architecture: DoorArchitecture, doorWeightKg: number): FloorSpringMaster | null {
  const rule = db
    .prepare(
      `SELECT * FROM floor_spring_recommendation_rules
       WHERE (door_architecture_id IS NULL OR door_architecture_id = ?)
         AND min_door_weight_kg <= ? AND (max_door_weight_kg IS NULL OR max_door_weight_kg >= ?)
       ORDER BY priority DESC LIMIT 1`,
    )
    .get(architecture.id, doorWeightKg, doorWeightKg) as { recommended_floor_spring_id: number } | undefined
  if (!rule) return null
  return db
    .prepare('SELECT * FROM floor_spring_master WHERE id = ?')
    .get(rule.recommended_floor_spring_id) as unknown as FloorSpringMaster
}

/**
 * Steps 11/12 — handle/lock recommendation. Rather than a separate
 * recommendation-rule table, this reuses the Step 17 compatibility engine
 * directly: among rows the compatibility engine allows for this selection,
 * recommend the cheapest. Two sources of truth for "what's compatible" would
 * risk the exact drift bug found earlier in this project (track/frame
 * capacity vs. panel-config flag) — there's only one here.
 */
function recommendCheapestCompatible<T extends { id: number; rate_per_unit: number }>(
  table: string,
  selection: Selection,
): T | null {
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rate_per_unit ASC`).all() as unknown as T[]
  for (const row of rows) {
    if (evaluateCompatibility(table, row.id, selection).allowed) return row
  }
  return null
}

export function recommendHandle(selection: Selection): HandleMaster | null {
  return recommendCheapestCompatible<HandleMaster>('handle_master', selection)
}

export function recommendLock(selection: Selection): LockMaster | null {
  return recommendCheapestCompatible<LockMaster>('lock_master', selection)
}
