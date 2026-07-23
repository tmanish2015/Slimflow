import pg from 'pg'

// Postgres (Supabase) replaces node:sqlite for the Vercel migration —
// node:sqlite's file-backed DB doesn't survive Vercel's ephemeral/
// serverless filesystem. DATABASE_URL is the Supabase connection string
// (see backend/.env.example); pooled via `pg.Pool` since a serverless
// function may spin up many concurrent instances, each needing its own
// short-lived connection rather than one long-lived one.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/** Thin query helper — every call site used to be synchronous
 * (node:sqlite's DatabaseSync), so this is now async everywhere; callers
 * were already inside asyncHandler-wrapped Express routes, so `await`
 * slots in without changing the route signatures. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params)
  return rows[0]
}
