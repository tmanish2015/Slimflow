import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts'
import { configuratorApi, type ReferenceData, type SavedConfiguration } from '~/lib/configuratorApi'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = '',
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  valuePrefix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-semibold text-popover-foreground">
        {valuePrefix}
        {payload[0].value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function DashboardPage() {
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [configurations, setConfigurations] = useState<SavedConfiguration[] | null>(null)

  useEffect(() => {
    configuratorApi.getReference().then(setReference)
    configuratorApi.getConfigurations().then(setConfigurations)
  }, [])

  if (!reference || !configurations) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  const totalConfigs = configurations.length
  const totalValue = configurations.reduce((sum, c) => sum + (c.selling_price ?? 0), 0)
  const avgSellingPrice = totalConfigs > 0 ? totalValue / totalConfigs : 0
  const totalMaterialCost = configurations.reduce((sum, c) => sum + (c.material_cost ?? 0), 0)

  const systemTypeNameById = new Map(reference.systemTypes.map((s) => [s.id, s.name]))
  const valueBySystemType = new Map<string, number>()
  for (const c of configurations) {
    const name = systemTypeNameById.get(c.system_type_id) ?? 'Unknown'
    valueBySystemType.set(name, (valueBySystemType.get(name) ?? 0) + (c.selling_price ?? 0))
  }
  const systemTypeChartData = Array.from(valueBySystemType, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  )

  const countByDate = new Map<string, number>()
  for (const c of configurations) {
    const day = c.created_at.slice(0, 10)
    countByDate.set(day, (countByDate.get(day) ?? 0) + 1)
  }
  const timelineChartData = Array.from(countByDate, ([date, count]) => ({ date, count })).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregated from every saved configuration — no separate schema, computed client-side from
          data the API already returns.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatTile label="Total configurations" value={totalConfigs.toLocaleString()} />
        <StatTile label="Total value" value={`₹${formatCompact(totalValue)}`} />
        <StatTile label="Avg selling price" value={`₹${formatCompact(avgSellingPrice)}`} />
        <StatTile label="Total material cost" value={`₹${formatCompact(totalMaterialCost)}`} />
      </div>

      {totalConfigs === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No configurations saved yet — build one in the Configurator to see it here.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Selling price by system type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={systemTypeChartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={<ChartTooltip valuePrefix="₹" />}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurations created over time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={timelineChartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="var(--chart-1)"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
