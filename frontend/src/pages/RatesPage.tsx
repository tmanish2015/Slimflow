import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type RateMaster } from '~/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

const FIELDS: { key: keyof RateMaster; label: string }[] = [
  { key: 'currency', label: 'Currency' },
  { key: 'profileRatePerKg', label: 'Profile rate (per kg)' },
  { key: 'profileWeightPerMetreKg', label: 'Profile weight (kg/metre)' },
  { key: 'barLengthM', label: 'Standard bar length (m)' },
  { key: 'glassRatePerSqft', label: 'Glass rate (per sqft)' },
  { key: 'acpRatePerSqft', label: 'ACP rate (per sqft)' },
  { key: 'wpcRatePerSqft', label: 'WPC rate (per sqft)' },
  { key: 'hardwareSetRate', label: 'Handle/lock set rate' },
  { key: 'hingeRate', label: 'Hinge rate (per pc)' },
  { key: 'fastenerRatePerUnit', label: 'Fastener rate (per pc)' },
  { key: 'fastenersPerMetre', label: 'Fasteners per metre' },
  { key: 'labourRatePerSqft', label: 'Labour rate (per sqft)' },
  { key: 'wastePercent', label: 'Waste %' },
  { key: 'marginPercent', label: 'Margin %' },
]

export function RatesPage() {
  const [rates, setRates] = useState<RateMaster | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getRateMaster().then(setRates)
  }, [])

  if (!rates) return <div className="p-6 text-sm text-neutral-500">Loading…</div>

  const save = async () => {
    const updated = await api.saveRateMaster(rates)
    setRates(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <Link to="/" className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Rate master</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{f.label}</span>
              <Input
                className="w-40"
                type={f.key === 'currency' ? 'text' : 'number'}
                value={rates[f.key]}
                onChange={(e) =>
                  setRates({
                    ...rates,
                    [f.key]: f.key === 'currency' ? e.target.value : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
          <Button onClick={save} className="mt-2 self-end">
            {saved ? 'Saved ✓' : 'Save rates'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
