import { Router } from 'express'
import { query, queryOne } from './db.js'
import { asyncHandler } from '../asyncHandler.js'

// Whitelisted so `:table` in the URL can never drive an arbitrary
// `SELECT/INSERT/UPDATE/DELETE ... <injected>` — this is the actual "admins
// add new systems/finishes/profiles/rules without a code change" mechanism
// the spec asks for: one generic CRUD screen over any of these, rather than
// 15+ bespoke admin pages that would each need a code change to add a field.
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

interface ColumnInfo {
  name: string
  type: string
  notnull: number
  pk: number
}

// Postgres equivalent of SQLite's `PRAGMA table_info(table)` — same shape
// (name/type/notnull/pk) so admin.ts's callers (and the frontend's AdminRow
// typing) don't need to change at all.
async function getColumns(table: string): Promise<ColumnInfo[]> {
  const rows = await query<{ column_name: string; data_type: string; is_nullable: string }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  )
  const pkRows = await query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
    [table],
  )
  const pkNames = new Set(pkRows.map((r) => r.column_name))
  return rows.map((r) => ({
    name: r.column_name,
    type: r.data_type,
    notnull: r.is_nullable === 'NO' ? 1 : 0,
    pk: pkNames.has(r.column_name) ? 1 : 0,
  }))
}

export const adminRouter = Router()

adminRouter.get(
  '/tables',
  asyncHandler(async (_req, res) => {
    res.json(ADMIN_TABLES)
  }),
)

adminRouter.get(
  '/:table/schema',
  asyncHandler(async (req, res) => {
    if (!ADMIN_TABLE_SET.has(req.params.table)) {
      res.status(400).json({ error: `Unknown table "${req.params.table}"` })
      return
    }
    res.json(await getColumns(req.params.table))
  }),
)

adminRouter.get(
  '/:table',
  asyncHandler(async (req, res) => {
    if (!ADMIN_TABLE_SET.has(req.params.table)) {
      res.status(400).json({ error: `Unknown table "${req.params.table}"` })
      return
    }
    res.json(await query(`SELECT * FROM ${req.params.table} ORDER BY id`))
  }),
)

adminRouter.post(
  '/:table',
  asyncHandler(async (req, res) => {
    const table = req.params.table
    if (!ADMIN_TABLE_SET.has(table)) {
      res.status(400).json({ error: `Unknown table "${table}"` })
      return
    }
    const columns = (await getColumns(table)).filter((c) => c.pk === 0)
    const body = req.body ?? {}
    const names = columns.filter((c) => c.name in body).map((c) => c.name)
    if (names.length === 0) {
      res.status(400).json({ error: 'No recognized columns in request body' })
      return
    }
    const placeholders = names.map((_, i) => `$${i + 1}`).join(', ')
    const created = await queryOne(
      `INSERT INTO ${table} (${names.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      names.map((n) => body[n]),
    )
    res.status(201).json(created)
  }),
)

adminRouter.put(
  '/:table/:id',
  asyncHandler(async (req, res) => {
    const table = req.params.table
    if (!ADMIN_TABLE_SET.has(table)) {
      res.status(400).json({ error: `Unknown table "${table}"` })
      return
    }
    const columns = (await getColumns(table)).filter((c) => c.pk === 0)
    const body = req.body ?? {}
    const names = columns.filter((c) => c.name in body).map((c) => c.name)
    if (names.length === 0) {
      res.status(400).json({ error: 'No recognized columns in request body' })
      return
    }
    const setClause = names.map((n, i) => `${n} = $${i + 1}`).join(', ')
    const updated = await queryOne(
      `UPDATE ${table} SET ${setClause} WHERE id = $${names.length + 1} RETURNING *`,
      [...names.map((n) => body[n]), req.params.id],
    )
    if (!updated) {
      res.status(404).json({ error: 'Row not found' })
      return
    }
    res.json(updated)
  }),
)

adminRouter.delete(
  '/:table/:id',
  asyncHandler(async (req, res) => {
    const table = req.params.table
    if (!ADMIN_TABLE_SET.has(table)) {
      res.status(400).json({ error: `Unknown table "${table}"` })
      return
    }
    await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id])
    res.status(204).end()
  }),
)
