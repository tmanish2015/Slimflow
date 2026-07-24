import { query } from '../db/engine'
import { listDrawings } from './drawing/store'
import { getCustomer, type Customer } from './customers'

export interface QuotationSummary {
  id: string
  sourceType: 'configurator' | 'drawing'
  label: string
  customerId: number | null
  customerName: string | null
  customerPhone: string | null
  totalCost: number | null
  sellingPrice: number | null
  createdAt: string
}

interface ConfigurationRow {
  id: string
  name: string
  total_cost: number | null
  selling_price: number | null
  customer_id: number | null
  created_at: string
}

/** Every saved quotation from both modules, newest first — a configurator
 * "configuration" and a drawing-recognition BOM are both priced quotes for
 * one opening, so they're listed side by side rather than in two separate
 * screens. Customer lookups are batched through a small in-memory cache
 * since the same customer can appear on many quotations. */
export async function listQuotations(): Promise<QuotationSummary[]> {
  const customerCache = new Map<number, Customer | undefined>()
  const resolveCustomer = async (id: number | null) => {
    if (id == null) return undefined
    if (!customerCache.has(id)) customerCache.set(id, await getCustomer(id))
    return customerCache.get(id)
  }

  const configRows = await query<ConfigurationRow>('SELECT id, name, total_cost, selling_price, customer_id, created_at FROM configurations ORDER BY created_at DESC')
  const configQuotations: QuotationSummary[] = []
  for (const row of configRows) {
    const customer = await resolveCustomer(row.customer_id)
    configQuotations.push({
      id: row.id,
      sourceType: 'configurator',
      label: row.name,
      customerId: row.customer_id,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      totalCost: row.total_cost,
      sellingPrice: row.selling_price,
      createdAt: row.created_at,
    })
  }

  const drawings = await listDrawings()
  const drawingQuotations: QuotationSummary[] = []
  for (const drawing of drawings) {
    if (!drawing.bom) continue // only priced (BOM-generated) drawings count as quotations
    const customer = await resolveCustomer(drawing.customerId)
    drawingQuotations.push({
      id: drawing.id,
      sourceType: 'drawing',
      label: drawing.originalFilename,
      customerId: drawing.customerId,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      totalCost: drawing.bom.totalCost,
      sellingPrice: drawing.bom.sellingPrice,
      createdAt: drawing.createdAt,
    })
  }

  return [...configQuotations, ...drawingQuotations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
