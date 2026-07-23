import { Router } from 'express'
import { db } from './db.js'
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

function getColumns(table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as unknown as ColumnInfo[]
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
    res.json(getColumns(req.params.table))
  }),
)

adminRouter.get(
  '/:table',
  asyncHandler(async (req, res) => {
    if (!ADMIN_TABLE_SET.has(req.params.table)) {
      res.status(400).json({ error: `Unknown table "${req.params.table}"` })
      return
    }
    res.json(db.prepare(`SELECT * FROM ${req.params.table} ORDER BY id`).all())
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
    const columns = getColumns(table).filter((c) => c.pk === 0)
    const body = req.body ?? {}
    const names = columns.filter((c) => c.name in body).map((c) => c.name)
    if (names.length === 0) {
      res.status(400).json({ error: 'No recognized columns in request body' })
      return
    }
    const placeholders = names.map(() => '?').join(', ')
    const info = db
      .prepare(`INSERT INTO ${table} (${names.join(', ')}) VALUES (${placeholders})`)
      .run(...names.map((n) => body[n]))
    const created = db.prepare(`SELECT * FROM ${table} WHERE rowid = ?`).get(info.lastInsertRowid)
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
    const columns = getColumns(table).filter((c) => c.pk === 0)
    const body = req.body ?? {}
    const names = columns.filter((c) => c.name in body).map((c) => c.name)
    if (names.length === 0) {
      res.status(400).json({ error: 'No recognized columns in request body' })
      return
    }
    const setClause = names.map((n) => `${n} = ?`).join(', ')
    db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...names.map((n) => body[n]), req.params.id)
    const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id)
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
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id)
    res.status(204).end()
  }),
)
