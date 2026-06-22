export type Role =
  | 'admin'
  | 'admin_hr'
  | 'owner'
  | 'spv'
  | 'leader'
  | 'kasir'
  | 'crew'
  | 'kiosk'

export type AppName =
  | 'pos-kasir'
  | 'absensi'
  | 'stok'
  | 'distribusi'
  | 'owner-dashboard'
  | 'admin-dashboard'

export type StaffStatus = 'active' | 'inactive' | 'on_leave'

export type OutletStaffProfile = {
  id: string
  outlet_id: string | null
  name: string
  role: Role
  status: StaffStatus
  username: string | null
  ref_photo_url: string | null
  outlets: { name: string } | null
}
