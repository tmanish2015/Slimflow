import initSqlJs, { type Database } from 'sql.js'
import { get, set } from 'idb-keyval'
import { SCHEMA_SQL } from './schema'
import { seedIfEmpty } from './seed'

// Everything lives in this device's browser: sql.js runs SQLite compiled to
// wasm entirely in-memory, and the whole database file is persisted as one
// blob in IndexedDB. No server, no network — this is what makes the app work
// identically offline on a laptop and inside an Android WebView (Capacitor).
const IDB_KEY = 'slimflow-sqlite-db'

let db: Database | null = null
let dbReady: Promise<Database> | null = null

// Debounced rather than awaited inline on every write — a review-page dimension
// edit can fire several updates in quick succession, and serializing the whole
// DB (`db.export()`) on each one is wasted work when only the last matters.
let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    if (db) void set(IDB_KEY, db.export())
  }, 250)
}

export async function initDb(): Promise<void> {
  if (dbReady) {
    await dbReady
    return
  }
  dbReady = (async () => {
    const SQL = await initSqlJs({ locateFile: (file) => `/sqljs/${file}` })
    const saved = await get<Uint8Array>(IDB_KEY)
    const instance = saved ? new SQL.Database(saved) : new SQL.Database()
    instance.run(SCHEMA_SQL)
    db = instance
    seedIfEmpty()
    schedulePersist()
    return instance
  })()
  await dbReady
}

function requireDb(): Database {
  if (!db) throw new Error('Database not initialized — initDb() must resolve before any query runs')
  return db
}

function toParams(params: unknown[]): (string | number | Uint8Array | null)[] {
  return params.map((p) => {
    if (p === undefined) return null
    if (p instanceof Uint8Array || p === null || typeof p === 'string' || typeof p === 'number') return p
    return String(p)
  })
}

/** Row-returning query — mirrors the old Postgres `query<T>()` helper's
 * shape so every ported service file needed only its import path changed. */
export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const database = requireDb()
  const stmt = database.prepare(sql)
  const rows: T[] = []
  try {
    stmt.bind(toParams(params))
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T)
    }
  } finally {
    stmt.free()
  }
  return rows
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return query<T>(sql, params)[0]
}

/** Mutating statement — insert/update/delete. Returns the new/last rowid so
 * callers that used Postgres's `RETURNING *` can re-select instead. */
export function run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  const database = requireDb()
  database.run(sql, toParams(params))
  const changes = database.getRowsModified()
  const lastInsertRowid = query<{ id: number }>('SELECT last_insert_rowid() as id')[0]?.id ?? 0
  schedulePersist()
  return { changes, lastInsertRowid }
}

/** Forces an immediate save — used right before a large batch of reads that
 * shouldn't race the debounce, and in tests. */
export async function flushPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (db) await set(IDB_KEY, db.export())
}
