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
