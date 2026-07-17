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

export interface ProfileRole {
  id: number
  name: string
  orientation: 'horizontal' | 'vertical'
  scaling_rule: 'fixed' | 'per_divider'
  fixed_qty: number
}

export interface Profile {
  id: number
  series_id: number
  role_id: number
  name: string
  weight_per_metre_kg: number
  rate_per_kg: number
}

export interface TrackMaster {
  id: number
  name: string
  duty_class: 'light' | 'medium' | 'heavy' | 'ultra_heavy' | 'soft_close'
  max_capacity_kg: number
  max_span_mm: number
  rate_per_metre: number
}

export interface FrameMaster {
  id: number
  name: string
  duty_class: 'light' | 'medium' | 'heavy' | 'extra_heavy'
  max_capacity_kg: number
  rate_per_metre: number
}

export interface HingeMaster {
  id: number
  name: string
  hinge_type: string
  max_capacity_kg: number
  rate_per_unit: number
}

export interface GlassMaster {
  id: number
  name: string
  glass_type: string
  thickness_mm: number
  weight_per_sqft_kg: number
  rate_per_sqft: number
}

export interface ConfigurationProfileLine {
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
  profileLines: ConfigurationProfileLine[]
  estimatedDoorWeightKg: number
  recommendedTrack: TrackMaster | null
  recommendedFrame: FrameMaster | null
  recommendedHinge: HingeMaster | null
  hingeQuantity: number
  createdAt: string
  updatedAt: string
}
