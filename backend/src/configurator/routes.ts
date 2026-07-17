import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from './db.js'
import { asyncHandler } from '../asyncHandler.js'
import {
  computeProfileLines,
  estimateDoorWeightKg,
  estimateHingeQuantity,
  recommendFrame,
  recommendHinge,
  recommendTrack,
} from './rules.js'
import type {
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
  const hinge = recommendHinge(architecture, doorWeightKg)
  const hingeQuantity = hinge ? estimateHingeQuantity(input.heightMm) : 0

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
    createdAt: now,
    updatedAt: now,
  }
}

function persistConfiguration(result: ConfigurationResult) {
  db.prepare(
    `INSERT INTO configurations
      (id, name, system_type_id, door_architecture_id, panel_configuration_id, profile_series_id, finish_id, glass_id,
       width_mm, height_mm, estimated_door_weight_kg, recommended_track_id, recommended_frame_id, recommended_hinge_id,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    res.json({ ...configuration, profileLines })
  }),
)
