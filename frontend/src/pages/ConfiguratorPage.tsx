import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  configuratorApi,
  type CompatibilityRow,
  type ConfigurationResult,
  type ReferenceData,
} from '~/lib/configuratorApi'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { IdSelect } from '~/components/id-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

export function ConfiguratorPage() {
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [systemTypeId, setSystemTypeId] = useState<number | ''>('')
  const [doorArchitectureId, setDoorArchitectureId] = useState<number | ''>('')
  const [panelConfigurationId, setPanelConfigurationId] = useState<number | ''>('')
  const [profileSeriesId, setProfileSeriesId] = useState<number | ''>('')
  const [finishId, setFinishId] = useState<number | ''>('')
  const [glassId, setGlassId] = useState<number | ''>('')
  const [widthMm, setWidthMm] = useState(1800)
  const [heightMm, setHeightMm] = useState(2100)
  const [result, setResult] = useState<ConfigurationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [locks, setLocks] = useState<CompatibilityRow[]>([])
  const [handles, setHandles] = useState<CompatibilityRow[]>([])

  useEffect(() => {
    configuratorApi.getReference().then(setReference)
  }, [])

  // Live compatibility preview (Step 17) — recomputed on every relevant
  // selection change, so incompatible hardware is visibly flagged before the
  // user ever tries to generate a quotation with it.
  useEffect(() => {
    if (systemTypeId === '' && doorArchitectureId === '') {
      setLocks([])
      setHandles([])
      return
    }
    const query = { systemTypeId, doorArchitectureId, panelConfigurationId, profileSeriesId, finishId, glassId }
    configuratorApi.getCompatibility({ table: 'lock_master', ...query }).then(setLocks)
    configuratorApi.getCompatibility({ table: 'handle_master', ...query }).then(setHandles)
  }, [systemTypeId, doorArchitectureId, panelConfigurationId, profileSeriesId, finishId, glassId])

  if (!reference) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>

  const selectedArchitecture = reference.doorArchitectures.find((a) => a.id === doorArchitectureId)

  const canSubmit =
    systemTypeId !== '' &&
    doorArchitectureId !== '' &&
    panelConfigurationId !== '' &&
    profileSeriesId !== '' &&
    finishId !== '' &&
    widthMm > 0 &&
    heightMm > 0

  const submit = async () => {
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const created = await configuratorApi.createConfiguration({
        systemTypeId: systemTypeId as number,
        doorArchitectureId: doorArchitectureId as number,
        panelConfigurationId: panelConfigurationId as number,
        profileSeriesId: profileSeriesId as number,
        finishId: finishId as number,
        glassId: glassId === '' ? null : glassId,
        widthMm,
        heightMm,
      })
      setResult(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build configuration')
      setResult(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Aluminium System Configurator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a system — Track/Frame/Hinge selection and profile quantities are computed
          automatically from database-driven rules, not hardcoded.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. System &amp; architecture</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>System Type</Label>
            <IdSelect value={systemTypeId} onChange={setSystemTypeId} options={reference.systemTypes} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Door Architecture</Label>
            <IdSelect value={doorArchitectureId} onChange={setDoorArchitectureId} options={reference.doorArchitectures} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Panel Configuration</Label>
            <IdSelect
              value={panelConfigurationId}
              onChange={setPanelConfigurationId}
              options={reference.panelConfigurations}
              labelKey="label"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Profile Series</Label>
            <IdSelect value={profileSeriesId} onChange={setProfileSeriesId} options={reference.profileSeries} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Finish</Label>
            <IdSelect value={finishId} onChange={setFinishId} options={reference.profileFinishes} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Glass (optional)</Label>
            <Select
              items={Object.fromEntries(reference.glassOptions.map((g) => [String(g.id), g.name]))}
              value={String(glassId)}
              onValueChange={(v) => setGlassId(v ? Number(v) : '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {reference.glassOptions.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Width (mm)</Label>
            <Input type="number" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value) || 0)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Height (mm)</Label>
            <Input type="number" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value) || 0)} />
          </div>
        </CardContent>
      </Card>

      {(locks.length > 0 || handles.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Compatible hardware (live, Step 17)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Locks</div>
              <div className="flex flex-col gap-1">
                {locks.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={l.allowed ? '' : 'text-muted-foreground line-through'}>{l.name}</span>
                    {l.allowed ? (
                      <Badge variant="success">allowed</Badge>
                    ) : (
                      <span className="text-xs text-destructive" title={l.reasons.join('; ')}>
                        {l.reasons[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Handles</div>
              <div className="flex flex-col gap-1">
                {handles.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={h.allowed ? '' : 'text-muted-foreground line-through'}>{h.name}</span>
                    {h.allowed ? (
                      <Badge variant="success">allowed</Badge>
                    ) : (
                      <span className="text-xs text-destructive" title={h.reasons.join('; ')}>
                        {h.reasons[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!canSubmit || submitting}>
          {submitting ? 'Configuring…' : 'Configure'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Recommended components</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Estimated door weight</div>
                <div className="text-lg font-semibold">{result.estimatedDoorWeightKg} kg</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Track</div>
                {result.recommendedTrack ? (
                  <div className="text-sm font-medium">
                    {result.recommendedTrack.name}{' '}
                    <span className="text-xs text-muted-foreground">
                      (cap {String(result.recommendedTrack.max_capacity_kg)}kg)
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not applicable{selectedArchitecture ? ` — ${selectedArchitecture.name} doesn't run on a track` : ''}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Door Frame</div>
                {result.recommendedFrame ? (
                  <div className="text-sm font-medium">
                    {result.recommendedFrame.name}{' '}
                    <span className="text-xs text-muted-foreground">
                      (cap {String(result.recommendedFrame.max_capacity_kg)}kg)
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Hinges</div>
                {result.recommendedHinge ? (
                  <div className="text-sm font-medium">
                    {result.hingeQuantity} × {result.recommendedHinge.name}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not applicable{selectedArchitecture ? ` — ${selectedArchitecture.name} doesn't use hinges` : ''}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Floor Spring</div>
                {result.recommendedFloorSpring ? (
                  <div className="text-sm font-medium">{result.recommendedFloorSpring.name}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">Not applicable</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Handle</div>
                {result.recommendedHandle ? (
                  <div className="text-sm font-medium">{result.recommendedHandle.name}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">None compatible</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lock</div>
                {result.recommendedLock ? (
                  <div className="text-sm font-medium">{result.recommendedLock.name}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">None compatible</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frame profile quantities (auto-calculated)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Length</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.profileLines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>{line.role_name}</TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      <TableCell>{line.length_mm} mm</TableCell>
                      <TableCell>{line.weight_kg} kg</TableCell>
                      <TableCell>₹{line.cost.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complete BOM (Step 16)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
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
                  {result.bomLines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>{line.category}</TableCell>
                      <TableCell>{line.item}</TableCell>
                      <TableCell>
                        {line.quantity} {line.unit}
                      </TableCell>
                      <TableCell>₹{line.unit_cost.toLocaleString()}</TableCell>
                      <TableCell>₹{line.total_cost.toLocaleString()}</TableCell>
                      <TableCell className="max-w-xs text-xs whitespace-normal text-muted-foreground">
                        {line.formula}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col items-end gap-1 text-sm">
                <span>Material cost: ₹{result.materialCost.toLocaleString()}</span>
                <span>Waste: ₹{result.wasteCost.toLocaleString()}</span>
                <span className="font-medium">Total cost: ₹{result.totalCost.toLocaleString()}</span>
                <span className="text-base font-semibold">
                  Selling price: ₹{result.sellingPrice.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
