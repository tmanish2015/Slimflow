import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type DrawingRecord, type ExtractedDimension } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

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

export function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const [drawing, setDrawing] = useState<DrawingRecord | null>(null)
  const [rows, setRows] = useState<ExtractedDimension[]>([])
  const [saving, setSaving] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('INR')

  const refresh = useCallback(async () => {
    if (!id) return
    const d = await api.getDrawing(id)
    setDrawing(d)
    setRows(d.dimensions)
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

  const generateBom = async () => {
    setGenError(null)
    await saveDimensions()
    try {
      const updated = await api.generateBom(id)
      setDrawing(updated)
      setRows(updated.dimensions)
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
              <CardTitle>Extracted dimensions — review &amp; confirm</CardTitle>
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
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="in">in</option>
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
