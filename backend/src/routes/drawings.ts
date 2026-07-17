import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import {
  UPLOAD_DIR,
  createDrawing,
  getDrawing,
  listDrawings,
  updateDrawing,
  type ExtractedDimension,
  type DrawingFeature,
  type HardwareItem,
  type PanelMaterial,
} from '../store.js'
import { processDrawing } from '../services/processDrawing.js'
import { generateBom, firstValueMm } from '../services/bom.js'
import { suggestHardware } from '../services/hardware.js'
import { getRateMaster, saveRateMaster } from '../services/rateMaster.js'
import { asyncHandler } from '../asyncHandler.js'

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
])

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ''
      cb(null, `${randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`))
      return
    }
    cb(null, true)
  },
})

export const drawingsRouter = Router()

drawingsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await listDrawings())
}))

drawingsRouter.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded (field name must be "file")' })
    return
  }
  const record = await createDrawing({
    originalFilename: req.file.originalname,
    mimeType: req.file.mimetype,
    storedPath: req.file.path,
  })
  res.status(201).json(record)

  // Process after responding so the client gets an id to poll immediately.
  void processDrawing(record)
}))

drawingsRouter.get('/:id', asyncHandler(async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  res.json(drawing)
}))

const dimensionPatchSchema = z.object({
  dimensions: z.array(
    z.object({
      id: z.string().optional(),
      kind: z.string(),
      label: z.string(),
      rawText: z.string().optional().default(''),
      value: z.number().nullable(),
      unit: z.enum(['mm', 'cm', 'in', 'ft']).nullable(),
      confirmed: z.boolean(),
    }),
  ),
})

const featuresPatchSchema = z.object({
  features: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string(),
      shape: z.enum(['arch', 'custom']),
      position: z.enum(['top', 'middle', 'bottom']),
      material: z.string().optional().default(''),
      notes: z.string().optional().default(''),
      cost: z.number(),
    }),
  ),
})

drawingsRouter.patch('/:id/dimensions', asyncHandler(async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  const parsed = dimensionPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const byId = new Map(drawing.dimensions.map((d) => [d.id, d]))
  const nextDimensions: ExtractedDimension[] = parsed.data.dimensions.map((edit) => {
    const existing = edit.id ? byId.get(edit.id) : undefined
    if (existing) {
      return { ...existing, ...edit, kind: edit.kind as ExtractedDimension['kind'] }
    }
    return {
      id: randomUUID(),
      kind: edit.kind as ExtractedDimension['kind'],
      label: edit.label,
      rawText: edit.rawText ?? '',
      value: edit.value,
      unit: edit.unit,
      confidence: 1,
      source: 'ocr' as const,
      bbox: null,
      confirmed: edit.confirmed,
    }
  })

  const updated = await updateDrawing(drawing.id, { dimensions: nextDimensions })
  res.json(updated)
}))

drawingsRouter.patch('/:id/features', asyncHandler(async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  const parsed = featuresPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const byId = new Map((drawing.features ?? []).map((f) => [f.id, f]))
  const nextFeatures: DrawingFeature[] = parsed.data.features.map((edit) => {
    const existing = edit.id ? byId.get(edit.id) : undefined
    return {
      id: existing?.id ?? randomUUID(),
      label: edit.label,
      shape: edit.shape,
      position: edit.position,
      material: edit.material ?? '',
      notes: edit.notes ?? '',
      cost: edit.cost,
    }
  })

  const updated = await updateDrawing(drawing.id, { features: nextFeatures })
  res.json(updated)
}))

const hardwarePatchSchema = z.object({
  hardwareItems: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string(),
      quantity: z.number(),
      unitCost: z.number(),
      notes: z.string().optional().default(''),
    }),
  ),
})

drawingsRouter.patch('/:id/hardware', asyncHandler(async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  const parsed = hardwarePatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const byId = new Map((drawing.hardwareItems ?? []).map((h) => [h.id, h]))
  const nextHardware: HardwareItem[] = parsed.data.hardwareItems.map((edit) => ({
    id: (edit.id && byId.get(edit.id)?.id) ?? randomUUID(),
    label: edit.label,
    quantity: edit.quantity,
    unitCost: edit.unitCost,
    notes: edit.notes ?? '',
  }))

  const updated = await updateDrawing(drawing.id, { hardwareItems: nextHardware })
  res.json(updated)
}))

drawingsRouter.post('/:id/hardware/suggest', asyncHandler(async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  const heightMm = firstValueMm(drawing.dimensions, 'height')
  if (heightMm == null) {
    res.status(400).json({ error: 'Confirm Height before suggesting hardware' })
    return
  }
  const rates = await getRateMaster()
  const hardwareItems = suggestHardware(heightMm, rates)
  const updated = await updateDrawing(drawing.id, { hardwareItems })
  res.json(updated)
}))

const panelMaterialPatchSchema = z.object({
  panelMaterial: z.enum(['glass', 'acp', 'wpc']),
})

drawingsRouter.patch('/:id/panel-material', asyncHandler(async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  const parsed = panelMaterialPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const updated = await updateDrawing(drawing.id, { panelMaterial: parsed.data.panelMaterial })
  res.json(updated)
}))

drawingsRouter.post('/:id/bom', asyncHandler(async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  try {
    const rates = await getRateMaster()
    const panelMaterial: PanelMaterial = drawing.panelMaterial ?? 'glass'

    // Hardware must be an explicit, reviewed list before the cost roll-up —
    // if nobody's visited the Hardware step yet, seed it from height here so
    // the BOM never silently falls back to a flat guessed quantity.
    let hardwareItems = drawing.hardwareItems ?? []
    if (hardwareItems.length === 0) {
      const heightMm = firstValueMm(drawing.dimensions, 'height')
      if (heightMm != null) {
        hardwareItems = suggestHardware(heightMm, rates)
      }
    }

    const bom = generateBom(drawing.dimensions, drawing.features ?? [], hardwareItems, panelMaterial, rates)
    const updated = await updateDrawing(drawing.id, { bom, status: 'ready', hardwareItems })
    res.json(updated)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not generate BOM' })
  }
}))

export const rateMasterRouter = Router()

rateMasterRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await getRateMaster())
}))

rateMasterRouter.put('/', asyncHandler(async (req, res) => {
  const updated = await saveRateMaster(req.body ?? {})
  res.json(updated)
}))
