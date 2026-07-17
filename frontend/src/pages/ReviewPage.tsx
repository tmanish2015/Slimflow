import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type DrawingFeature, type DrawingRecord, type ExtractedDimension, type PanelMaterial } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DrawingSchematic, type SchematicInput } from '@/components/DrawingSchematic'
import { toMillimetres } from '@/lib/units'

const UNIT_OPTIONS: NonNullable<ExtractedDimension['unit']>[] = ['mm', 'cm', 'in', 'ft']
const PANEL_MATERIAL_OPTIONS: { value: PanelMaterial; label: string }[] = [
  { value: 'glass', label: 'Glass' },
  { value: 'acp', label: 'ACP' },
  { value: 'wpc', label: 'WPC' },
]

const KIND_OPTIONS: ExtractedDimension['kind'][] = [
  'width',
  'height',
  'frame',
  'glass_thickness',
  'mullion_count',
  'transom_count',
  'scale',
  'drawing_unit',
  'unknown',
]

function formatCurrency(n: number, currency: string) {
  return `${currency === 'INR' ? '₹' : currency + ' '}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

// Reads straight from the (possibly unconfirmed, still-being-edited) rows,
// not just confirmed ones — this is a live preview aid, not the authoritative
// BOM input, so it should update as the user types rather than only after Save.
function deriveSchematicInput(
  rows: ExtractedDimension[],
  features: DrawingFeature[],
  panelMaterial: PanelMaterial,
): SchematicInput {
  const firstMm = (kind: ExtractedDimension['kind']) => {
    const row = rows.find((r) => r.kind === kind && r.value != null)
    return row?.value != null ? toMillimetres(row.value, row.unit) : null
  }
  const frameRows = rows.filter((r) => r.kind === 'frame' && r.value != null)
  const mullionRow = rows.find((r) => r.kind === 'mullion_count' && r.value != null)
  const transomRow = rows.find((r) => r.kind === 'transom_count' && r.value != null)

  return {
    widthMm: firstMm('width'),
    heightMm: firstMm('height'),
    frameWidthMm: frameRows[0]?.value ?? null,
    frameThicknessMm: frameRows[1]?.value ?? null,
    glassThicknessMm: firstMm('glass_thickness'),
    mullionCount: mullionRow?.value ?? 0,
    transomCount: transomRow?.value ?? 0,
    features: features.map((f) => ({ id: f.id, label: f.label, shape: f.shape, position: f.position })),
    panelMaterial,
  }
}

function emptyFeature(): DrawingFeature {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: 'Arched fanlight',
    shape: 'arch',
    position: 'middle',
    material: '',
    notes: '',
    cost: 0,
  }
}

export function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const [drawing, setDrawing] = useState<DrawingRecord | null>(null)
  const [rows, setRows] = useState<ExtractedDimension[]>([])
  const [features, setFeatures] = useState<DrawingFeature[]>([])
  const [panelMaterial, setPanelMaterial] = useState<PanelMaterial>('glass')
  const [saving, setSaving] = useState(false)
  const [savingFeatures, setSavingFeatures] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('INR')

  const refresh = useCallback(async () => {
    if (!id) return
    const d = await api.getDrawing(id)
    setDrawing(d)
    setRows(d.dimensions)
    setFeatures(d.features)
    setPanelMaterial(d.panelMaterial)
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    api.getRateMaster().then((r) => setCurrency(r.currency))
  }, [])

  useEffect(() => {
    if (!drawing) return
    if (drawing.status !== 'uploaded' && drawing.status !== 'processing') return
    const timer = setInterval(() => void refresh(), 1500)
    return () => clearInterval(timer)
  }, [drawing, refresh])

  // Must run on every render (rows.length is defined even before `drawing`
  // loads) — placing this after the early returns below made the hook count
  // differ between the loading and loaded renders (React "Rules of Hooks" violation).
  const schematicInput = useMemo(
    () => deriveSchematicInput(rows, features, panelMaterial),
    [rows, features, panelMaterial],
  )

  if (!id) return null
  if (!drawing) return <div className="p-6 text-sm text-neutral-500">Loading…</div>

  const updateRow = (rowId: string, patch: Partial<ExtractedDimension>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        kind: 'width',
        label: 'Manual entry',
        rawText: '',
        value: null,
        unit: 'mm',
        confidence: 1,
        source: 'ocr',
        bbox: null,
        confirmed: true,
      },
    ])
  }

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const saveDimensions = async () => {
    setSaving(true)
    try {
      const cleaned = rows.map((r) => ({ ...r, id: r.id.startsWith('new-') ? undefined : r.id }))
      const updated = await api.updateDimensions(id, cleaned as ExtractedDimension[])
      setDrawing(updated)
      setRows(updated.dimensions)
    } finally {
      setSaving(false)
    }
  }

  const updateFeature = (featureId: string, patch: Partial<DrawingFeature>) => {
    setFeatures((prev) => prev.map((f) => (f.id === featureId ? { ...f, ...patch } : f)))
  }

  const addFeature = () => {
    setFeatures((prev) => [...prev, emptyFeature()])
  }

  const removeFeature = (featureId: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== featureId))
  }

  const saveFeatures = async () => {
    setSavingFeatures(true)
    try {
      const cleaned = features.map((f) => ({ ...f, id: f.id.startsWith('new-') ? undefined : f.id }))
      const updated = await api.updateFeatures(id, cleaned as DrawingFeature[])
      setDrawing(updated)
      setFeatures(updated.features)
    } finally {
      setSavingFeatures(false)
    }
  }

  const savePanelMaterial = async (next: PanelMaterial) => {
    setPanelMaterial(next)
    const updated = await api.updatePanelMaterial(id, next)
    setDrawing(updated)
  }

  const generateBom = async () => {
    setGenError(null)
    await saveDimensions()
    await saveFeatures()
    try {
      const updated = await api.generateBom(id)
      setDrawing(updated)
      setRows(updated.dimensions)
      setFeatures(updated.features)
      setPanelMaterial(updated.panelMaterial)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate BOM')
    }
  }

  const previewUrl = `/processed/${drawing.id}.png`
  const isProcessing = drawing.status === 'uploaded' || drawing.status === 'processing'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-neutral-500 hover:underline">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {drawing.originalFilename}
          </h1>
        </div>
        <Badge tone={isProcessing ? 'amber' : drawing.status === 'failed' ? 'red' : 'green'}>
          {drawing.status.replace('_', ' ')}
        </Badge>
      </div>

      {isProcessing && (
        <Card>
          <CardContent className="p-6 text-sm text-neutral-500">
            Preprocessing and reading dimensions with OCR — this can take a few seconds…
          </CardContent>
        </Card>
      )}

      {drawing.errorMessage && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-400">
            {drawing.errorMessage}
          </CardContent>
        </Card>
      )}

      {!isProcessing && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Processed drawing</CardTitle>
            </CardHeader>
            <CardContent>
              <img src={previewUrl} alt="Processed drawing" className="w-full rounded border border-neutral-200 dark:border-neutral-800" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2D schematic (scaled to entered dimensions)</CardTitle>
            </CardHeader>
            <CardContent>
              <DrawingSchematic input={schematicInput} />
            </CardContent>
          </Card>
        </div>
      )}

      {!isProcessing && (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Extracted dimensions — review &amp; confirm</CardTitle>
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                Panel material
                <select
                  className="h-8 rounded border border-neutral-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  value={panelMaterial}
                  onChange={(e) => void savePanelMaterial(e.target.value as PanelMaterial)}
                >
                  {PANEL_MATERIAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_80px_60px_70px_24px] gap-2 text-xs font-medium text-neutral-500">
                <span>Kind / label</span>
                <span>Value</span>
                <span>Unit</span>
                <span>Confirm</span>
                <span />
              </div>
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_80px_60px_70px_24px] items-center gap-2">
                  <select
                    className="h-8 rounded border border-neutral-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    value={row.kind}
                    onChange={(e) => updateRow(row.id, { kind: e.target.value as ExtractedDimension['kind'] })}
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={row.value ?? ''}
                    onChange={(e) =>
                      updateRow(row.id, { value: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                  <select
                    className="h-8 rounded border border-neutral-300 bg-white px-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    value={row.unit ?? ''}
                    onChange={(e) =>
                      updateRow(row.id, { unit: (e.target.value || null) as ExtractedDimension['unit'] })
                    }
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <input
                    type="checkbox"
                    checked={row.confirmed}
                    onChange={(e) => updateRow(row.id, { confirmed: e.target.checked })}
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    className="text-xs text-neutral-400 hover:text-red-500"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addRow}>
                  + Add dimension
                </Button>
                <Button size="sm" onClick={saveDimensions} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Low-confidence guesses are unchecked by default — confirm or correct each value before
                generating a BOM.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Special features (manually tagged)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-xs text-neutral-400">
                For design elements the automatic pipeline can&apos;t detect — e.g. an arched fanlight
                from a hand sketch. Not auto-detected: add it here with its own cost, and it&apos;ll show
                up as a BOM line and an overlay on the schematic above.
              </p>
              {features.length > 0 && (
                <div className="grid grid-cols-[1fr_90px_90px_1fr_80px_24px] gap-2 text-xs font-medium text-neutral-500">
                  <span>Label</span>
                  <span>Shape</span>
                  <span>Position</span>
                  <span>Material / notes</span>
                  <span>Cost</span>
                  <span />
                </div>
              )}
              {features.map((f) => (
                <div key={f.id} className="grid grid-cols-[1fr_90px_90px_1fr_80px_24px] items-center gap-2">
                  <Input
                    className="h-8 text-xs"
                    value={f.label}
                    onChange={(e) => updateFeature(f.id, { label: e.target.value })}
                  />
                  <select
                    className="h-8 rounded border border-neutral-300 bg-white px-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    value={f.shape}
                    onChange={(e) => updateFeature(f.id, { shape: e.target.value as DrawingFeature['shape'] })}
                  >
                    <option value="arch">arch</option>
                    <option value="custom">custom</option>
                  </select>
                  <select
                    className="h-8 rounded border border-neutral-300 bg-white px-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    value={f.position}
                    onChange={(e) =>
                      updateFeature(f.id, { position: e.target.value as DrawingFeature['position'] })
                    }
                  >
                    <option value="top">top</option>
                    <option value="middle">middle</option>
                    <option value="bottom">bottom</option>
                  </select>
                  <Input
                    className="h-8 text-xs"
                    placeholder="e.g. frosted glass"
                    value={f.material}
                    onChange={(e) => updateFeature(f.id, { material: e.target.value })}
                  />
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={f.cost}
                    onChange={(e) => updateFeature(f.id, { cost: Number(e.target.value) || 0 })}
                  />
                  <button
                    onClick={() => removeFeature(f.id)}
                    className="text-xs text-neutral-400 hover:text-red-500"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addFeature}>
                  + Add feature
                </Button>
                <Button size="sm" onClick={saveFeatures} disabled={savingFeatures}>
                  {savingFeatures ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isProcessing && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Bill of Materials</CardTitle>
            <Button size="sm" onClick={generateBom}>
              Generate BOM
            </Button>
          </CardHeader>
          <CardContent>
            {genError && <p className="mb-2 text-sm text-red-600">{genError}</p>}
            {drawing.bom ? (
              <div className="flex flex-col gap-3">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
                      <th className="py-1">Category</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>Total</th>
                      <th>Formula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drawing.bom.lines.map((line, i) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                        <td className="py-1">{line.category}</td>
                        <td>{line.item}</td>
                        <td>
                          {line.quantity} {line.unit}
                        </td>
                        <td>{formatCurrency(line.unitCost, currency)}</td>
                        <td>{formatCurrency(line.totalCost, currency)}</td>
                        <td className="max-w-xs text-xs text-neutral-400">{line.formula}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-col items-end gap-1 text-sm">
                  <span>Material cost: {formatCurrency(drawing.bom.materialCost, currency)}</span>
                  <span>Waste: {formatCurrency(drawing.bom.wasteCost, currency)}</span>
                  <span>Labour: {formatCurrency(drawing.bom.labourCost, currency)}</span>
                  <span className="font-medium">
                    Total cost: {formatCurrency(drawing.bom.totalCost, currency)}
                  </span>
                  <span className="text-base font-semibold">
                    Selling price: {formatCurrency(drawing.bom.sellingPrice, currency)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Confirm Width and Height above, then generate the BOM.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
