import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve(import.meta.dirname, '../../data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_FILE = path.join(DATA_DIR, 'configurator.sqlite')

// node:sqlite is built into Node 22.5+ (no native compile toolchain needed —
// this machine has no Python/build tools, which ruled out better-sqlite3
// earlier in this project). Real relational storage with foreign keys and
// joins, which flat JSON files can't give the admin-editable master-table
// architecture this configurator needs.
export const db = new DatabaseSync(DB_FILE)

const schema = readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf-8')
db.exec(schema)

// Lightweight migrations for columns added after a table already existed —
// `CREATE TABLE IF NOT EXISTS` in schema.sql only helps for brand-new
// tables, not new columns on ones a running dev DB already created.
function addColumnIfMissing(table: string, column: string, definition: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (columns.some((c) => c.name === column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

const addedTrackFlag = addColumnIfMissing('door_architectures', 'uses_track', 'INTEGER NOT NULL DEFAULT 0')
const addedHingesFlag = addColumnIfMissing('door_architectures', 'uses_hinges', 'INTEGER NOT NULL DEFAULT 0')

// Freshly-added columns default to 0 for existing rows — backfill the real
// values once, by name, matching seed.ts's intent. Only runs the one time
// the column is actually new, so it never clobbers a later admin edit.
if (addedTrackFlag || addedHingesFlag) {
  const backfill: Record<string, { uses_track: number; uses_hinges: number }> = {
    Openable: { uses_track: 0, uses_hinges: 1 },
    Sliding: { uses_track: 1, uses_hinges: 0 },
    Fixed: { uses_track: 0, uses_hinges: 0 },
    'Bi-Fold': { uses_track: 1, uses_hinges: 1 },
    Pivot: { uses_track: 0, uses_hinges: 1 },
    French: { uses_track: 0, uses_hinges: 1 },
    'Pocket Door': { uses_track: 1, uses_hinges: 0 },
  }
  const update = db.prepare('UPDATE door_architectures SET uses_track = ?, uses_hinges = ? WHERE name = ?')
  for (const [name, flags] of Object.entries(backfill)) {
    update.run(flags.uses_track, flags.uses_hinges, name)
  }
}
