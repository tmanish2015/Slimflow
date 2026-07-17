import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { configuratorApi, type ConfigurationResult, type ReferenceData } from '@/lib/configuratorApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function Select<T extends { id: number }>({
  value,
  onChange,
  options,
  labelKey = 'name' as keyof T,
}: {
  value: number | ''
  onChange: (v: number) => void
  options: T[]
  labelKey?: keyof T
}) {
  return (
    <select
      className="h-9 w-full rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="" disabled>
        Select…
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {String(o[labelKey])}
        </option>
      ))}
    </select>
  )
}

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

  useEffect(() => {
    configuratorApi.getReference().then(setReference)
  }, [])

  if (!reference) return <div className="p-6 text-sm text-neutral-500">Loading…</div>

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
        <Link to="/" className="text-sm text-neutral-500 hover:underline">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Aluminium System Configurator
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a system — Track/Frame/Hinge selection and profile quantities are computed
          automatically from database-driven rules, not hardcoded.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. System &amp; architecture</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            System Type
            <Select value={systemTypeId} onChange={setSystemTypeId} options={reference.systemTypes} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Door Architecture
            <Select
              value={doorArchitectureId}
              onChange={setDoorArchitectureId}
              options={reference.doorArchitectures}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Panel Configuration
            <Select
              value={panelConfigurationId}
              onChange={setPanelConfigurationId}
              options={reference.panelConfigurations}
              labelKey="label"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Profile Series
            <Select value={profileSeriesId} onChange={setProfileSeriesId} options={reference.profileSeries} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Finish
            <Select value={finishId} onChange={setFinishId} options={reference.profileFinishes} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Glass (optional)
            <select
              className="h-9 w-full rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={glassId}
              onChange={(e) => setGlassId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">None</option>
              {reference.glassOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Width (mm)
            <Input type="number" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value) || 0)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Height (mm)
            <Input type="number" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value) || 0)} />
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!canSubmit || submitting}>
          {submitting ? 'Configuring…' : 'Configure'}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Recommended components</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-neutral-500">Estimated door weight</div>
                <div className="text-lg font-semibold">{result.estimatedDoorWeightKg} kg</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Track</div>
                {result.recommendedTrack ? (
                  <div className="text-sm font-medium">
                    {result.recommendedTrack.name}{' '}
                    <span className="text-xs text-neutral-400">
                      (cap {String(result.recommendedTrack.max_capacity_kg)}kg)
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">
                    Not applicable{selectedArchitecture ? ` — ${selectedArchitecture.name} doesn't run on a track` : ''}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-neutral-500">Door Frame</div>
                {result.recommendedFrame ? (
                  <div className="text-sm font-medium">
                    {result.recommendedFrame.name}{' '}
                    <span className="text-xs text-neutral-400">
                      (cap {String(result.recommendedFrame.max_capacity_kg)}kg)
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">—</div>
                )}
              </div>
              <div>
                <div className="text-xs text-neutral-500">Hinges</div>
                {result.recommendedHinge ? (
                  <div className="text-sm font-medium">
                    {result.hingeQuantity} × {result.recommendedHinge.name}
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">
                    Not applicable{selectedArchitecture ? ` — ${selectedArchitecture.name} doesn't use hinges` : ''}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frame profile quantities (auto-calculated)</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
                    <th className="py-1">Role</th>
                    <th>Qty</th>
                    <th>Length</th>
                    <th>Weight</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {result.profileLines.map((line, i) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-1">{line.role_name}</td>
                      <td>{line.quantity}</td>
                      <td>{line.length_mm} mm</td>
                      <td>{line.weight_kg} kg</td>
                      <td>₹{line.cost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
