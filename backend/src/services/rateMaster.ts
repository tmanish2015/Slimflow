import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

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

const DATA_DIR = path.resolve(import.meta.dirname, '../../data')
const RATE_FILE = path.join(DATA_DIR, 'rate-master.json')

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

export async function getRateMaster(): Promise<RateMaster> {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    const raw = await readFile(RATE_FILE, 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    await writeFile(RATE_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf-8')
    return DEFAULTS
  }
}

export async function saveRateMaster(patch: Partial<RateMaster>): Promise<RateMaster> {
  const current = await getRateMaster()
  const updated = { ...current, ...patch }
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(RATE_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
