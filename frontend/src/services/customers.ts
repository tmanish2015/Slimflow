import { query, queryOne, run } from '../db/engine'

export interface Customer {
  id: number
  name: string
  phone: string
  gst_number: string
  address: string
  created_at: string
}

export interface CreateCustomerInput {
  name: string
  phone?: string
  gstNumber?: string
  address?: string
}

/** Name-or-phone search, most-recently-added first — the picker's dropdown
 * list. Empty query returns the most recent customers rather than nothing,
 * so the list isn't blank the moment the picker opens. */
export async function searchCustomers(searchTerm: string, limit = 20): Promise<Customer[]> {
  const term = searchTerm.trim()
  if (!term) {
    return query<Customer>('SELECT * FROM customers ORDER BY id DESC LIMIT ?', [limit])
  }
  return query<Customer>(
    `SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT ?`,
    [`%${term}%`, `%${term}%`, limit],
  )
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  return queryOne<Customer>('SELECT * FROM customers WHERE id = ?', [id])
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  if (!input.name.trim()) throw new Error('Customer name is required')
  const now = new Date().toISOString()
  const { lastInsertRowid } = run(
    'INSERT INTO customers (name, phone, gst_number, address, created_at) VALUES (?, ?, ?, ?, ?)',
    [input.name.trim(), input.phone?.trim() ?? '', input.gstNumber?.trim() ?? '', input.address?.trim() ?? '', now],
  )
  const created = await queryOne<Customer>('SELECT * FROM customers WHERE rowid = ?', [lastInsertRowid])
  if (!created) throw new Error('Customer created but could not be re-read')
  return created
}
