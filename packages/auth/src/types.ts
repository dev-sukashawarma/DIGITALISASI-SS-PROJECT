export type Role =
  | 'admin'
  | 'owner'
  | 'spv'
  | 'kepala_outlet'
  | 'kasir'
  | 'crew'
  | 'kiosk'

export type AppName =
  | 'pos-kasir'
  | 'absensi'
  | 'stok'
  | 'distribusi'
  | 'owner-dashboard'

export type StaffStatus = 'active' | 'inactive' | 'on_leave'

export interface OutletStaffProfile {
  id: string
  outlet_id: string | null
  name: string
  role: Role
  status: StaffStatus
  outlets?: { name: string } | null
}
