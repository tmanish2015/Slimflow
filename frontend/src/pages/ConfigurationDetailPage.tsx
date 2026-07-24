import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { configuratorApi, type BomLine, type ProfileLine, type SavedConfiguration } from '~/lib/configuratorApi'
import { customersApi, type Customer } from '~/lib/customersApi'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

type Detail = SavedConfiguration & { profileLines: ProfileLine[]; bomLines: BomLine[] }

function formatCurrency(n: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/** Read-only view of a previously-saved configurator quotation — reached
 * from the Quotations list for "find this again later". The wizard itself
 * (ConfiguratorPage) only ever builds new ones; this is the counterpart
 * that displays an existing saved one, customer block included. */
export function ConfigurationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    configuratorApi
      .getConfiguration(id)
      .then((d) => {
        setDetail(d)
        if (d.customer_id != null) customersApi.get(d.customer_id).then((c) => setCustomer(c ?? null))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load configuration'))
  }, [id])

  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>
  if (!detail) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link to="/quotations" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Quotations
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">{detail.name}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          Print
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opening</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Width</div>
            <div className="font-medium">{detail.width_mm} mm</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Height</div>
            <div className="font-medium">{detail.height_mm} mm</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Est. door weight</div>
            <div className="font-medium">{detail.estimated_door_weight_kg ?? '—'} kg</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Saved</div>
            <div className="font-medium">{new Date(detail.created_at).toLocaleString()}</div>
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Frame profile quantities</CardTitle>
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
              {detail.profileLines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell>{line.role_name}</TableCell>
                  <TableCell>{line.quantity}</TableCell>
                  <TableCell>{line.length_mm} mm</TableCell>
                  <TableCell>{line.weight_kg} kg</TableCell>
                  <TableCell>{formatCurrency(line.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Complete BOM</CardTitle>
          <CardAction className="print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Print
            </Button>
          </CardAction>
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
              {detail.bomLines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell>{line.category}</TableCell>
                  <TableCell>{line.item}</TableCell>
                  <TableCell>
                    {line.quantity} {line.unit}
                  </TableCell>
                  <TableCell>{formatCurrency(line.unit_cost)}</TableCell>
                  <TableCell>{formatCurrency(line.total_cost)}</TableCell>
                  <TableCell className="max-w-xs text-xs whitespace-normal text-muted-foreground">
                    {line.formula}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col items-end gap-1 text-sm">
            <span>Material cost: {formatCurrency(detail.material_cost)}</span>
            <span>Waste: {formatCurrency(detail.waste_cost)}</span>
            <span className="font-medium">Total cost: {formatCurrency(detail.total_cost)}</span>
            <span className="text-base font-semibold">Selling price: {formatCurrency(detail.selling_price)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
