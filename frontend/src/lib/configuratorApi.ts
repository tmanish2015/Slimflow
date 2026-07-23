const BASE = '/api/configurator'

export interface SystemType {
  id: number
  name: string
  description: string
}

export interface DoorArchitecture {
  id: number
  name: string
  description: string
  uses_track: number
  uses_hinges: number
}

export interface PanelConfiguration {
  id: number
  code: string
  label: string
  total_panels: number
  track_count: number
  is_heavy_duty: number
}

export interface ProfileFinish {
  id: number
  name: string
  price_multiplier: number
  swatch_hex: string
}

export interface ProfileSeries {
  id: number
  name: string
  system_type_id: number | null
  description: string
}

export interface GlassOption {
  id: number
  name: string
  glass_type: string
  thickness_mm: number
  weight_per_sqft_kg: number
  rate_per_sqft: number
}

export interface ReferenceData {
  systemTypes: SystemType[]
  doorArchitectures: DoorArchitecture[]
  panelConfigurations: PanelConfiguration[]
  profileFinishes: ProfileFinish[]
  profileSeries: ProfileSeries[]
  glassOptions: GlassOption[]
}

export interface MasterRow {
  id: number
  name: string
  [key: string]: unknown
}

export interface ProfileLine {
  profile_id: number
  role_name: string
  quantity: number
  length_mm: number
  weight_kg: number
  cost: number
}

export interface BomLine {
  category: string
  item: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  formula: string
}

export interface ConfigurationResult {
  id: string
  name: string
  systemTypeId: number
  doorArchitectureId: number
  panelConfigurationId: number
  profileSeriesId: number
  finishId: number
  glassId: number | null
  widthMm: number
  heightMm: number
  profileLines: ProfileLine[]
  estimatedDoorWeightKg: number
  recommendedTrack: MasterRow | null
  recommendedFrame: MasterRow | null
  recommendedHinge: MasterRow | null
  hingeQuantity: number
  recommendedFloorSpring: MasterRow | null
  recommendedHandle: MasterRow | null
  recommendedLock: MasterRow | null
  bomLines: BomLine[]
  materialCost: number
  wasteCost: number
  totalCost: number
  sellingPrice: number
  createdAt: string
  updatedAt: string
}

export interface CompatibilityRow {
  id: number
  name: string
  allowed: boolean
  reasons: string[]
  [key: string]: unknown
}

export interface CompatibilityQuery {
  table: 'lock_master' | 'handle_master' | 'hinge_master' | 'track_master' | 'connector_master'
  systemTypeId?: number | ''
  doorArchitectureId?: number | ''
  panelConfigurationId?: number | ''
  profileSeriesId?: number | ''
  finishId?: number | ''
  glassId?: number | ''
}

export interface AdminColumn {
  name: string
  type: string
  notnull: number
  pk: number
}

export type AdminRow = Record<string, string | number | null>

export interface CreateConfigurationInput {
  name?: string
  systemTypeId: number
  doorArchitectureId: number
  panelConfigurationId: number
  profileSeriesId: number
  finishId: number
  glassId?: number | null
  widthMm: number
  heightMm: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const configuratorApi = {
  getReference() {
    return fetch(`${BASE}/reference`).then((r) => json<ReferenceData>(r))
  },
  createConfiguration(input: CreateConfigurationInput) {
    return fetch(`${BASE}/configurations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<ConfigurationResult>(r))
  },
  getCompatibility(query: CompatibilityQuery) {
    const params = new URLSearchParams()
    params.set('table', query.table)
    if (query.systemTypeId) params.set('systemTypeId', String(query.systemTypeId))
    if (query.doorArchitectureId) params.set('doorArchitectureId', String(query.doorArchitectureId))
    if (query.panelConfigurationId) params.set('panelConfigurationId', String(query.panelConfigurationId))
    if (query.profileSeriesId) params.set('profileSeriesId', String(query.profileSeriesId))
    if (query.finishId) params.set('finishId', String(query.finishId))
    if (query.glassId) params.set('glassId', String(query.glassId))
    return fetch(`${BASE}/compatibility?${params.toString()}`).then((r) => json<CompatibilityRow[]>(r))
  },
}

const ADMIN_BASE = `${BASE}/admin`

export const adminApi = {
  getTables() {
    return fetch(`${ADMIN_BASE}/tables`).then((r) => json<string[]>(r))
  },
  getSchema(table: string) {
    return fetch(`${ADMIN_BASE}/${table}/schema`).then((r) => json<AdminColumn[]>(r))
  },
  getRows(table: string) {
    return fetch(`${ADMIN_BASE}/${table}`).then((r) => json<AdminRow[]>(r))
  },
  createRow(table: string, data: AdminRow) {
    return fetch(`${ADMIN_BASE}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => json<AdminRow>(r))
  },
  updateRow(table: string, id: number, data: AdminRow) {
    return fetch(`${ADMIN_BASE}/${table}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => json<AdminRow>(r))
  },
  deleteRow(table: string, id: number) {
    return fetch(`${ADMIN_BASE}/${table}/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error(`Delete failed: ${r.status}`)
    })
  },
}
