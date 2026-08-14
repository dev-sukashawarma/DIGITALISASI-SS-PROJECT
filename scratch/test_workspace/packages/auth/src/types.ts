export type Role =
  | 'admin'
  | 'admin_hr'
  | 'owner'
  | 'spv'
  | 'regional_manager'
  | 'leader'
  | 'crew'
  | 'kiosk'
  | 'kitchen'
  | 'mitra'
  | 'staff_pusat'
  | 'admin_finance'
  | 'area_manager'
  | 'purchasing'
  | 'developer'

export type AppName =
  | 'pos-kasir'
  | 'absensi'
  | 'stok'
  | 'distribusi'
  | 'owner-dashboard'
  | 'admin-dashboard'
  | 'finance'
  | 'manager'

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
  allow_manual_button?: boolean
  // Personal & Contract details
  nik?: string | null
  email?: string | null
  phone?: string | null
  address_ktp?: string | null
  address_domicile?: string | null
  birth_place?: string | null
  birth_date?: string | null
  gender?: 'male' | 'female' | null
  religion?: string | null
  emergency_name?: string | null
  emergency_relationship?: string | null
  emergency_phone?: string | null
  nip?: string | null
  contract_type?: 'permanent' | 'contract' | 'intern' | 'daily' | null
  join_date?: string | null
  resign_date?: string | null
  leave_quota?: number | null
}

export type StaffFinancials = {
  staff_id: string
  basic_salary: number
  allowance_position: number
  allowance_presence: number
  bank_name: string
  bank_account_number: string
  bank_account_name: string
  npwp?: string | null
  bpjs_ketenagakerjaan?: string | null
  bpjs_kesehatan?: string | null
  updated_at?: string
}

export type StaffLeave = {
  id: string
  staff_id: string
  type: 'annual' | 'sick' | 'special' | 'other'
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string | null
  document_url?: string | null
  created_at?: string
}

export type StaffKpi = {
  id: string
  staff_id: string
  period: string // YYYY-MM
  kpi_score: number
  notes?: string | null
  created_at?: string
}

export type StaffWarning = {
  id: string
  staff_id: string
  warning_level: 1 | 2 | 3
  issue_date: string
  expiry_date: string
  reason: string
  created_by: string
  created_at?: string
}

