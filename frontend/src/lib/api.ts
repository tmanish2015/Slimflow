import * as store from '~/services/drawing/store'
import { uploadFile } from '~/services/drawing/storage'
import { processDrawing } from '~/services/drawing/processDrawing'
import { generateBom as generateBomLines, firstValueMm } from '~/services/drawing/bom'
import { suggestHardware as suggestHardwareItems } from '~/services/drawing/hardware'
import { getRateMaster as getRates, saveRateMaster as saveRates } from '~/services/drawing/rateMaster'
import type {
  Bom,
  DrawingFeature,
  DrawingRecord,
  ExtractedDimension,
  HardwareItem,
  PanelMaterial,
  RateMaster,
} from './types'

const ACCEPTED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp'])

export const api = {
  async uploadDrawing(file: File): Promise<DrawingRecord> {
    if (!ACCEPTED_MIME.has(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`)
    }
    const record = await store.createDrawing({
      originalFilename: file.name,
      mimeType: file.type,
      storedPath: file.name,
    })
    const bytes = new Uint8Array(await file.arrayBuffer())
    await uploadFile(record.id, 'upload', bytes, file.type)
    void processDrawing(record)
    return record as unknown as DrawingRecord
  },

  async getDrawing(id: string): Promise<DrawingRecord> {
    const drawing = await store.getDrawing(id)
    if (!drawing) throw new Error('Drawing not found')
    return drawing as unknown as DrawingRecord
  },

  async listDrawings(): Promise<DrawingRecord[]> {
    return (await store.listDrawings()) as unknown as DrawingRecord[]
  },

  async updateDimensions(id: string, dimensions: ExtractedDimension[]): Promise<DrawingRecord> {
    const drawing = await store.getDrawing(id)
    if (!drawing) throw new Error('Drawing not found')
    const byId = new Map(drawing.dimensions.map((d) => [d.id, d]))
    const next = dimensions.map((edit) => {
      const existing = edit.id ? byId.get(edit.id) : undefined
      return existing ? { ...existing, ...edit } : { ...edit, id: edit.id || crypto.randomUUID() }
    })
    return (await store.updateDrawing(id, { dimensions: next as store.ExtractedDimension[] })) as unknown as DrawingRecord
  },

  async updateFeatures(id: string, features: DrawingFeature[]): Promise<DrawingRecord> {
    const drawing = await store.getDrawing(id)
    if (!drawing) throw new Error('Drawing not found')
    const byId = new Map((drawing.features ?? []).map((f) => [f.id, f]))
    const next = features.map((edit) => ({
      ...edit,
      id: (edit.id && byId.get(edit.id)?.id) || edit.id || crypto.randomUUID(),
    }))
    return (await store.updateDrawing(id, { features: next as store.DrawingFeature[] })) as unknown as DrawingRecord
  },

  async updateHardware(id: string, hardwareItems: HardwareItem[]): Promise<DrawingRecord> {
    const drawing = await store.getDrawing(id)
    if (!drawing) throw new Error('Drawing not found')
    const byId = new Map((drawing.hardwareItems ?? []).map((h) => [h.id, h]))
    const next = hardwareItems.map((edit) => ({
      ...edit,
      id: (edit.id && byId.get(edit.id)?.id) || edit.id || crypto.randomUUID(),
    }))
    return (await store.updateDrawing(id, { hardwareItems: next as store.HardwareItem[] })) as unknown as DrawingRecord
  },

  async suggestHardware(id: string): Promise<DrawingRecord> {
    const drawing = await store.getDrawing(id)
    if (!drawing) throw new Error('Drawing not found')
    const heightMm = firstValueMm(drawing.dimensions, 'height')
    if (heightMm == null) throw new Error('Confirm Height before suggesting hardware')
    const rates = await getRates()
    const hardwareItems = suggestHardwareItems(heightMm, rates)
    return (await store.updateDrawing(id, { hardwareItems })) as unknown as DrawingRecord
  },

  async updatePanelMaterial(id: string, panelMaterial: PanelMaterial): Promise<DrawingRecord> {
    return (await store.updateDrawing(id, { panelMaterial })) as unknown as DrawingRecord
  },

  async setCustomer(id: string, customerId: number | null): Promise<DrawingRecord> {
    return (await store.updateDrawing(id, { customerId })) as unknown as DrawingRecord
  },

  async generateBom(id: string): Promise<DrawingRecord> {
    const drawing = await store.getDrawing(id)
    if (!drawing) throw new Error('Drawing not found')
    const rates = await getRates()
    const panelMaterial = drawing.panelMaterial ?? 'glass'
    let hardwareItems = drawing.hardwareItems ?? []
    if (hardwareItems.length === 0) {
      const heightMm = firstValueMm(drawing.dimensions, 'height')
      if (heightMm != null) hardwareItems = suggestHardwareItems(heightMm, rates)
    }
    const bom = generateBomLines(drawing.dimensions, drawing.features ?? [], hardwareItems, panelMaterial, rates)
    return (await store.updateDrawing(id, { bom: bom as Bom, status: 'ready', hardwareItems })) as unknown as DrawingRecord
  },

  async getRateMaster(): Promise<RateMaster> {
    return getRates()
  },

  async saveRateMaster(patch: Partial<RateMaster>): Promise<RateMaster> {
    return saveRates(patch)
  },
}

export type { Bom, DrawingFeature, DrawingRecord, ExtractedDimension, HardwareItem, PanelMaterial, RateMaster }
