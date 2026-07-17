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
} from '../store.js'
import { processDrawing } from '../services/processDrawing.js'
import { generateBom } from '../services/bom.js'
import { getRateMaster, saveRateMaster } from '../services/rateMaster.js'

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

drawingsRouter.get('/', async (_req, res) => {
  res.json(await listDrawings())
})

drawingsRouter.post('/', upload.single('file'), async (req, res) => {
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
})

drawingsRouter.get('/:id', async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  res.json(drawing)
})

const dimensionPatchSchema = z.object({
  dimensions: z.array(
    z.object({
      id: z.string().optional(),
      kind: z.string(),
      label: z.string(),
      rawText: z.string().optional().default(''),
      value: z.number().nullable(),
      unit: z.enum(['mm', 'cm', 'in']).nullable(),
      confirmed: z.boolean(),
    }),
  ),
})

drawingsRouter.patch('/:id/dimensions', async (req, res) => {
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
})

drawingsRouter.post('/:id/bom', async (req, res) => {
  const drawing = await getDrawing(req.params.id)
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found' })
    return
  }
  try {
    const rates = await getRateMaster()
    const bom = generateBom(drawing.dimensions, rates)
    const updated = await updateDrawing(drawing.id, { bom, status: 'ready' })
    res.json(updated)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not generate BOM' })
  }
})

export const rateMasterRouter = Router()

rateMasterRouter.get('/', async (_req, res) => {
  res.json(await getRateMaster())
})

rateMasterRouter.put('/', async (req, res) => {
  const updated = await saveRateMaster(req.body ?? {})
  res.json(updated)
})
