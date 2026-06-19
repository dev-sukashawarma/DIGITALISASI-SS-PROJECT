import type { Role, StaffStatus } from '@suka/auth'

export type { Role, StaffStatus }

export interface Outlet {
  id: string
  name: string
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
