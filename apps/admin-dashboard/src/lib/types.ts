import type { Role, StaffStatus } from '@suka/auth'

export type { Role, StaffStatus }

export interface Outlet {
  id: string
  slug: string
  name: string
  address: string | null
  lat: number
  lng: number
  type: string
  is_active: boolean
}

export interface OutletFormValues {
  name: string
  slug: string
  address: string
  lat: number
  lng: number
  type: string
  is_active: boolean
}

export interface OutletFilterValues {
  search: string
  status: string // '' = semua, 'active', 'inactive'
}

export interface StaffRow {
  id: string
  name: string
  role: Role
  status: StaffStatus
  username: string | null
  outlet_id: string | null
  outlets: { name: string } | null
  outlet_ids: string[] // dari staff_outlets (kepala_outlet)
}

export interface StaffFormValues {
  name: string
  username: string
  password: string
  role: Role
  outlet_id: string
  outlet_ids: string[]
}

export interface StaffFilterValues {
  search: string
  outletId: string // '' = semua
  role: string // '' = semua
  status: string // '' = semua
}

export type HealthTargetType = 'app' | 'supabase' | 'cpanel'
export type HealthStatus = 'up' | 'degraded' | 'down' | 'unconfigured'

export interface SystemHealthLogRow {
  id: number
  target_type: HealthTargetType
  target_name: string
  status: HealthStatus
  db_status: 'ok' | 'error' | null
  last_activity_at: string | null
  response_time_ms: number | null
  detail: Record<string, unknown> | null
  checked_at: string
}
