import * as configurations from '~/services/configurator/configurations'
import * as admin from '~/services/configurator/admin'

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
  group_id: number
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
  recommendedHardwareSet: MasterRow | null
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

export interface SavedConfiguration {
  id: string
  name: string
  system_type_id: number
  door_architecture_id: number
  panel_configuration_id: number
  profile_series_id: number
  finish_id: number
  glass_id: number | null
  width_mm: number
  height_mm: number
  estimated_door_weight_kg: number | null
  material_cost: number | null
  waste_cost: number | null
  total_cost: number | null
  selling_price: number | null
  created_at: string
  updated_at: string
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

export const configuratorApi = {
  getReference(): Promise<ReferenceData> {
    return configurations.getReference() as unknown as Promise<ReferenceData>
  },
  getConfigurations(): Promise<SavedConfiguration[]> {
    return configurations.listConfigurations() as unknown as Promise<SavedConfiguration[]>
  },
  createConfiguration(input: CreateConfigurationInput): Promise<ConfigurationResult> {
    return configurations.createConfiguration(input) as unknown as Promise<ConfigurationResult>
  },
  getCompatibility(query: CompatibilityQuery): Promise<CompatibilityRow[]> {
    return configurations.getCompatibility({
      table: query.table,
      systemTypeId: query.systemTypeId || null,
      doorArchitectureId: query.doorArchitectureId || null,
      panelConfigurationId: query.panelConfigurationId || null,
      profileSeriesId: query.profileSeriesId || null,
      finishId: query.finishId || null,
      glassId: query.glassId || null,
    }) as unknown as Promise<CompatibilityRow[]>
  },
}

export const adminApi = {
  getTables(): Promise<string[]> {
    return admin.getTables()
  },
  getSchema(table: string): Promise<AdminColumn[]> {
    return admin.getSchema(table)
  },
  getRows(table: string): Promise<AdminRow[]> {
    return admin.getRows(table) as unknown as Promise<AdminRow[]>
  },
  createRow(table: string, data: AdminRow): Promise<AdminRow> {
    return admin.createRow(table, data) as unknown as Promise<AdminRow>
  },
  updateRow(table: string, id: number, data: AdminRow): Promise<AdminRow> {
    return admin.updateRow(table, id, data) as unknown as Promise<AdminRow>
  },
  async deleteRow(table: string, id: number): Promise<void> {
    await admin.deleteRow(table, id)
  },
}
