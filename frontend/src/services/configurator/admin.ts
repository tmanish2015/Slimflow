import { query, queryOne, run } from '../../db/engine'

// Whitelisted so a table name coming from the UI can never drive an
// arbitrary `SELECT/INSERT/UPDATE/DELETE ... <injected>` — this is the
// generic "admins add new systems/finishes/profiles/rules without a code
// change" mechanism: one generic CRUD screen over any of these, rather than
// 15+ bespoke admin pages.
const ADMIN_TABLES = [
  'system_types',
  'door_architectures',
  'panel_configurations',
  'finish_price_groups',
  'profile_finishes',
  'profile_series',
  'profile_roles',
  'profiles',
  'track_master',
  'frame_master',
  'hinge_master',
  'handle_master',
  'lock_master',
  'connector_master',
  'seal_master',
  'tape_master',
  'glass_master',
  'glass_bead_master',
  'accessory_master',
  'floor_spring_master',
  'hardware_set_master',
  'pricing_rules',
  'track_recommendation_rules',
  'frame_recommendation_rules',
  'hinge_recommendation_rules',
  'floor_spring_recommendation_rules',
  'hardware_set_recommendation_rules',
  'compatibility_rules',
]
const ADMIN_TABLE_SET = new Set(ADMIN_TABLES)

export interface ColumnInfo {
  name: string
  type: string
  notnull: number
  pk: number
}

async function getColumns(table: string): Promise<ColumnInfo[]> {
  const rows = await query<{ name: string; type: string; notnull: number; pk: number }>(`PRAGMA table_info(${table})`)
  return rows.map((r) => ({ name: r.name, type: r.type, notnull: r.notnull, pk: r.pk }))
}

function assertKnownTable(table: string) {
  if (!ADMIN_TABLE_SET.has(table)) throw new Error(`Unknown table "${table}"`)
}

export async function getTables(): Promise<string[]> {
  return ADMIN_TABLES
}

export async function getSchema(table: string): Promise<ColumnInfo[]> {
  assertKnownTable(table)
  return getColumns(table)
}

export async function getRows(table: string): Promise<Record<string, unknown>[]> {
  assertKnownTable(table)
  return query(`SELECT * FROM ${table} ORDER BY id`)
}

export async function createRow(table: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertKnownTable(table)
  const columns = (await getColumns(table)).filter((c) => c.pk === 0)
  const names = columns.filter((c) => c.name in body).map((c) => c.name)
  if (names.length === 0) throw new Error('No recognized columns in request body')
  const placeholders = names.map(() => '?').join(', ')
  const { lastInsertRowid } = run(
    `INSERT INTO ${table} (${names.join(', ')}) VALUES (${placeholders})`,
    names.map((n) => body[n]),
  )
  const created = await queryOne(`SELECT * FROM ${table} WHERE rowid = ?`, [lastInsertRowid])
  if (!created) throw new Error('Row created but could not be re-read')
  return created
}

export async function updateRow(table: string, id: number, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertKnownTable(table)
  const columns = (await getColumns(table)).filter((c) => c.pk === 0)
  const names = columns.filter((c) => c.name in body).map((c) => c.name)
  if (names.length === 0) throw new Error('No recognized columns in request body')
  const setClause = names.map((n) => `${n} = ?`).join(', ')
  run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...names.map((n) => body[n]), id])
  const updated = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [id])
  if (!updated) throw new Error('Row not found')
  return updated
}

export async function deleteRow(table: string, id: number): Promise<void> {
  assertKnownTable(table)
  run(`DELETE FROM ${table} WHERE id = ?`, [id])
}
