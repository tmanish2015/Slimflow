import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { X } from 'lucide-react'
import {
  api,
  type DrawingFeature,
  type DrawingRecord,
  type ExtractedDimension,
  type HardwareItem,
  type PanelMaterial,
} from '~/lib/api'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { SelectField } from '~/components/select-field'
import { DrawingSchematic, type SchematicInput } from '~/components/DrawingSchematic'
import { toMillimetres } from '~/lib/units'
import { downloadFile } from '~/services/drawing/storage'
import { CustomerPicker } from '~/components/customer-picker'
import type { Customer } from '~/lib/customersApi'

const UNIT_OPTIONS: NonNullable<ExtractedDimension['unit']>[] = ['mm', 'cm', 'in', 'ft']
const PANEL_MATERIAL_OPTIONS: PanelMaterial[] = ['glass', 'acp', 'wpc']

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
const SHAPE_OPTIONS: DrawingFeature['shape'][] = ['arch', 'custom']
const POSITION_OPTIONS: DrawingFeature['position'][] = ['top', 'middle', 'bottom']

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

function emptyHardwareItem(): HardwareItem {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: 'New item',
    quantity: 1,
    unitCost: 0,
    notes: '',
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

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={onClick}>
      <X className="size-3.5" />
    </Button>
  )
}

export function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const [drawing, setDrawing] = useState<DrawingRecord | null>(null)
  const [rows, setRows] = useState<ExtractedDimension[]>([])
  const [features, setFeatures] = useState<DrawingFeature[]>([])
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([])
  const [panelMaterial, setPanelMaterial] = useState<PanelMaterial>('glass')
  const [saving, setSaving] = useState(false)
  const [savingFeatures, setSavingFeatures] = useState(false)
  const [savingHardware, setSavingHardware] = useState(false)
  const [suggestingHardware, setSuggestingHardware] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('INR')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    const d = await api.getDrawing(id)
    setDrawing(d)
    setRows(d.dimensions)
    setFeatures(d.features)
    setHardwareItems(d.hardwareItems)
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

  // The preview PNG lives as a BLOB in the local database, not at a server
  // URL — load it once processing has produced one and hand the browser an
  // object URL, revoking the previous one so blobs don't pile up as the
  // user navigates between drawings.
  useEffect(() => {
    if (!drawing?.previewPath) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    downloadFile(drawing.id, 'preview').then(({ data, contentType }) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(new Blob([data as BlobPart], { type: contentType }))
      setPreviewUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [drawing?.id, drawing?.previewPath])

  // Must run on every render (rows.length is defined even before `drawing`
  // loads) — placing this after the early returns below made the hook count
  // differ between the loading and loaded renders (React "Rules of Hooks" violation).
  const schematicInput = useMemo(
    () => deriveSchematicInput(rows, features, panelMaterial),
    [rows, features, panelMaterial],
  )

  if (!id) return null
  if (!drawing) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>

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

  const updateHardwareItem = (itemId: string, patch: Partial<HardwareItem>) => {
    setHardwareItems((prev) => prev.map((h) => (h.id === itemId ? { ...h, ...patch } : h)))
  }

  const addHardwareItem = () => {
    setHardwareItems((prev) => [...prev, emptyHardwareItem()])
  }

  const removeHardwareItem = (itemId: string) => {
    setHardwareItems((prev) => prev.filter((h) => h.id !== itemId))
  }

  const saveHardware = async () => {
    setSavingHardware(true)
    try {
      const cleaned = hardwareItems.map((h) => ({ ...h, id: h.id.startsWith('new-') ? undefined : h.id }))
      const updated = await api.updateHardware(id, cleaned as HardwareItem[])
      setDrawing(updated)
      setHardwareItems(updated.hardwareItems)
    } finally {
      setSavingHardware(false)
    }
  }

  const suggestHardwareList = async () => {
    setSuggestingHardware(true)
    try {
      const updated = await api.suggestHardware(id)
      setDrawing(updated)
      setHardwareItems(updated.hardwareItems)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to suggest hardware')
    } finally {
      setSuggestingHardware(false)
    }
  }

  const savePanelMaterial = async (next: PanelMaterial) => {
    setPanelMaterial(next)
    const updated = await api.updatePanelMaterial(id, next)
    setDrawing(updated)
  }

  const changeCustomer = async (nextCustomerId: number | null) => {
    const updated = await api.setCustomer(id, nextCustomerId)
    setDrawing(updated)
  }

  const generateBom = async () => {
    setGenError(null)
    await saveDimensions()
    await saveHardware()
    await saveFeatures()
    try {
      const updated = await api.generateBom(id)
      setDrawing(updated)
      setRows(updated.dimensions)
      setFeatures(updated.features)
      setHardwareItems(updated.hardwareItems)
      setPanelMaterial(updated.panelMaterial)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate BOM')
    }
  }

  const isProcessing = drawing.status === 'uploaded' || drawing.status === 'processing'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">{drawing.originalFilename}</h1>
        </div>
        <Badge variant={isProcessing ? 'warning' : drawing.status === 'failed' ? 'destructive' : 'success'}>
          {drawing.status.replace('_', ' ')}
        </Badge>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Customer (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerPicker customerId={drawing.customerId} onChange={changeCustomer} onCustomerLoaded={setCustomer} />
        </CardContent>
      </Card>

      {customer && (
        <Card>
          <CardHeader>
            <CardTitle>Quotation for</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Customer</div>
              <div className="font-medium">{customer.name}</div>
            </div>
            {customer.phone && (
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div>{customer.phone}</div>
              </div>
            )}
            {customer.gst_number && (
              <div>
                <div className="text-xs text-muted-foreground">GST</div>
                <div>{customer.gst_number}</div>
              </div>
            )}
            {customer.address && (
              <div>
                <div className="text-xs text-muted-foreground">Address</div>
                <div>{customer.address}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isProcessing && (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Preprocessing and reading dimensions with OCR — this can take a few seconds…
          </CardContent>
        </Card>
      )}

      {drawing.errorMessage && (
        <Card className="ring-amber-300 dark:ring-amber-700">
          <CardContent className="text-sm text-amber-700 dark:text-amber-400">{drawing.errorMessage}</CardContent>
        </Card>
      )}

      {!isProcessing && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Processed drawing</CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <img src={previewUrl} alt="Processed drawing" className="w-full rounded-lg ring-1 ring-border" />
              ) : (
                <div className="text-sm text-muted-foreground">Loading preview…</div>
              )}
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Panel material
                <SelectField value={panelMaterial} onValueChange={savePanelMaterial} options={PANEL_MATERIAL_OPTIONS} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind / label</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Confirm</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <SelectField
                          value={row.kind}
                          onValueChange={(v) => updateRow(row.id, { kind: v })}
                          options={KIND_OPTIONS}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-24 text-xs"
                          value={row.value ?? ''}
                          onChange={(e) =>
                            updateRow(row.id, { value: e.target.value === '' ? null : Number(e.target.value) })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <SelectField
                          value={row.unit ?? 'mm'}
                          onValueChange={(v) => updateRow(row.id, { unit: v })}
                          options={UNIT_OPTIONS}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={row.confirmed}
                          onChange={(e) => updateRow(row.id, { confirmed: e.target.checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <RemoveButton onClick={() => removeRow(row.id)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addRow}>
                  + Add dimension
                </Button>
                <Button size="sm" onClick={saveDimensions} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Low-confidence guesses are unchecked by default — confirm or correct each value before
                generating a BOM.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Hardware list</CardTitle>
              <Button variant="outline" size="sm" onClick={suggestHardwareList} disabled={suggestingHardware}>
                {suggestingHardware ? 'Suggesting…' : 'Suggest from height'}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Reviewed and confirmed before the cost roll-up below — quantities scale with the
                confirmed dimensions (e.g. hinge count from height), not a flat guessed count.
              </p>
              {hardwareItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit cost</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hardwareItems.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            value={h.label}
                            onChange={(e) => updateHardwareItem(h.id, { label: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-20 text-xs"
                            value={h.quantity}
                            onChange={(e) => updateHardwareItem(h.id, { quantity: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-24 text-xs"
                            value={h.unitCost}
                            onChange={(e) => updateHardwareItem(h.id, { unitCost: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            value={h.notes}
                            onChange={(e) => updateHardwareItem(h.id, { notes: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <RemoveButton onClick={() => removeHardwareItem(h.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addHardwareItem}>
                  + Add item
                </Button>
                <Button size="sm" onClick={saveHardware} disabled={savingHardware}>
                  {savingHardware ? 'Saving…' : 'Save'}
                </Button>
              </div>
              {hardwareItems.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Empty — click &quot;Suggest from height&quot; (needs confirmed Height) or add items
                  manually. If left empty, Generate BOM will auto-suggest before calculating.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Special features (manually tagged)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                For design elements the automatic pipeline can&apos;t detect — e.g. an arched fanlight
                from a hand sketch. Not auto-detected: add it here with its own cost, and it&apos;ll show
                up as a BOM line and an overlay on the schematic above.
              </p>
              {features.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Shape</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Material / notes</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {features.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            value={f.label}
                            onChange={(e) => updateFeature(f.id, { label: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <SelectField
                            value={f.shape}
                            onValueChange={(v) => updateFeature(f.id, { shape: v })}
                            options={SHAPE_OPTIONS}
                          />
                        </TableCell>
                        <TableCell>
                          <SelectField
                            value={f.position}
                            onValueChange={(v) => updateFeature(f.id, { position: v })}
                            options={POSITION_OPTIONS}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            placeholder="e.g. frosted glass"
                            value={f.material}
                            onChange={(e) => updateFeature(f.id, { material: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-20 text-xs"
                            value={f.cost}
                            onChange={(e) => updateFeature(f.id, { cost: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell>
                          <RemoveButton onClick={() => removeFeature(f.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex items-center gap-2">
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
            {genError && <p className="mb-2 text-sm text-destructive">{genError}</p>}
            {drawing.bom ? (
              <div className="flex flex-col gap-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit cost</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Formula</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drawing.bom.lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>{line.category}</TableCell>
                        <TableCell>{line.item}</TableCell>
                        <TableCell>
                          {line.quantity} {line.unit}
                        </TableCell>
                        <TableCell>{formatCurrency(line.unitCost, currency)}</TableCell>
                        <TableCell>{formatCurrency(line.totalCost, currency)}</TableCell>
                        <TableCell className="max-w-xs text-xs whitespace-normal text-muted-foreground">
                          {line.formula}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
              <p className="text-sm text-muted-foreground">Confirm Width and Height above, then generate the BOM.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
