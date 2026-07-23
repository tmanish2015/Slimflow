import { query, queryOne } from '../configurator/db.js'

export interface RateMaster {
  currency: string
  profileRatePerKg: number
  profileWeightPerMetreKg: number
  barLengthM: number
  glassRatePerSqft: number
  acpRatePerSqft: number
  wpcRatePerSqft: number
  hardwareSetRate: number
  hingeRate: number
  fastenerRatePerUnit: number
  fastenersPerMetre: number
  labourRatePerSqft: number
  wastePercent: number
  marginPercent: number
}

const DEFAULTS: RateMaster = {
  currency: 'INR',
  profileRatePerKg: 320,
  profileWeightPerMetreKg: 1.6,
  barLengthM: 6,
  glassRatePerSqft: 85,
  acpRatePerSqft: 110,
  wpcRatePerSqft: 95,
  hardwareSetRate: 450,
  hingeRate: 60,
  fastenerRatePerUnit: 4,
  fastenersPerMetre: 3,
  labourRatePerSqft: 35,
  wastePercent: 5,
  marginPercent: 18,
}

// Single-row settings blob — was backend/data/rate-master.json, now one
// jsonb row in Postgres (id is always 1, a singleton table) since that file
// didn't survive Vercel's ephemeral filesystem either. Already seeded via
// migrations/002_seed.sql; getRateMaster's insert-if-missing branch is only
// a safety net for a database that somehow doesn't have it yet.
export async function getRateMaster(): Promise<RateMaster> {
  const row = await queryOne<{ data: RateMaster }>('SELECT data FROM rate_master WHERE id = 1')
  if (row) return { ...DEFAULTS, ...row.data }
  await query('INSERT INTO rate_master (id, data) VALUES (1, $1)', [JSON.stringify(DEFAULTS)])
  return DEFAULTS
}

export async function saveRateMaster(patch: Partial<RateMaster>): Promise<RateMaster> {
  const current = await getRateMaster()
  const updated = { ...current, ...patch }
  await query('UPDATE rate_master SET data = $1 WHERE id = 1', [JSON.stringify(updated)])
  return updated
}
