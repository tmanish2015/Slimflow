import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quotationsApi, type QuotationSummary } from '~/lib/quotationsApi'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

function formatCurrency(n: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function QuotationsPage() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState<QuotationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    quotationsApi.list().then((q) => {
      setQuotations(q)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return quotations
    return quotations.filter(
      (q) =>
        (q.customerName?.toLowerCase().includes(term) ?? false) ||
        (q.customerPhone?.toLowerCase().includes(term) ?? false) ||
        q.label.toLowerCase().includes(term),
    )
  }, [quotations, search])

  const openQuotation = (q: QuotationSummary) => {
    navigate(q.sourceType === 'configurator' ? `/configurations/${q.id}` : `/drawings/${q.id}`)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Quotations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every saved quotation from the Configurator and drawing BOMs, in one place — search by
          customer name or phone to find one for future reference.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by customer name, phone, or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {quotations.length === 0 ? 'No quotations saved yet.' : 'No quotations match that search.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Selling price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow
                    key={`${q.sourceType}-${q.id}`}
                    className="cursor-pointer"
                    onClick={() => openQuotation(q)}
                  >
                    <TableCell className="whitespace-nowrap">{new Date(q.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{q.customerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{q.customerPhone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{q.sourceType === 'configurator' ? 'Configurator' : 'Drawing'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">{q.label}</TableCell>
                    <TableCell>{formatCurrency(q.totalCost)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(q.sellingPrice)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
