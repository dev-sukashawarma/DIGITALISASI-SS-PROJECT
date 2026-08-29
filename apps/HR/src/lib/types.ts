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
  region?: string | null
}

export interface StaffRow {
  id: string
  name: string
  role: Role
  status: StaffStatus
  username: string | null
  outlet_id: string | null
  outlets: { name: string } | null
  outlet_ids: string[]
  is_bonus_eligible?: boolean
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
  financials?: {
    basic_salary: number
    allowance_position: number
    allowance_presence: number
    bank_name: string
    bank_account_number: string
    bank_account_name: string
    npwp?: string | null
    bpjs_ketenagakerjaan?: string | null
    bpjs_kesehatan?: string | null
  } | null
}

export interface StaffFormValues {
  name: string
  username: string
  password?: string
  role: Role
  outlet_id: string
  outlet_ids: string[]
  is_bonus_eligible?: boolean
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
  basic_salary?: number
  allowance_position?: number
  allowance_presence?: number
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
  npwp?: string | null
  bpjs_ketenagakerjaan?: string | null
  bpjs_kesehatan?: string | null
}

export interface StaffFilterValues {
  search: string
  outletId: string
  role: string
  status: string
}

// ── Attendance ──────────────────────────────────────────────
export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa' | 'cuti' | 'libur'

export interface AttendanceLog {
  id: string
  staff_id: string
  outlet_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  status: AttendanceStatus
  late_minutes: number
  notes: string | null
  photo_url?: string | null
  clock_out_photo_url?: string | null
  lat?: number | null
  lng?: number | null
  is_mock_location?: boolean | null
  created_at?: string
  updated_at?: string
  outlet_staff?: { name: string; role: string; username?: string | null }
  outlets?: { name: string }
}

export interface AttendanceFilterValues {
  dateFrom: string
  dateTo: string
  outletId: string
  status: string
}

// ── Leave ───────────────────────────────────────────────────
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  staff_id: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: LeaveStatus
  approved_by: string | null
  approved_at: string | null
  rejection_note: string | null
  attachment_url?: string | null
  created_at: string
  outlet_staff?: { name: string; role: string; leave_quota: number | null }
}

// ── Payroll ─────────────────────────────────────────────────
export type PayrollStatus = 'draft' | 'finalized'

export interface PayrollRecord {
  id: string
  staff_id: string
  period_month: number
  period_year: number
  basic_salary: number
  allowance_position: number
  allowance_presence: number
  bonus: number
  bonus_note: string | null
  deductions: number
  deduction_note: string | null
  total_salary: number
  status: PayrollStatus
  created_at?: string
  updated_at?: string
  outlet_staff?: { 
    name: string
    role: string
    outlet_id: string
    phone?: string | null
    outlets: { name: string } | null
    financials?: {
      bank_name: string
      bank_account_number: string
      bank_account_name: string
    } | null
  }
}

// ── Cash Advance ────────────────────────────────────────────
export type CashAdvanceStatus = 'active' | 'paid_off' | 'pending' | 'rejected'

export interface CashAdvance {
  id: string
  staff_id: string
  amount: number
  remaining: number
  reason: string | null
  status: CashAdvanceStatus
  approved_by: string | null
  created_at: string
  outlet_staff?: { name: string }
  cash_advance_payments?: CashAdvancePayment[]
}

export interface CashAdvancePayment {
  id: string
  cash_advance_id: string
  amount: number
  payment_date: string
  note: string | null
  created_at?: string
}

// ── Contract Monitoring ─────────────────────────────────────
export interface StaffContract {
  id: string
  staff_id: string
  contract_number?: string | null
  contract_type: 'PKWT' | 'Probation' | 'Tetap' | 'Internship' | 'Harian' | string
  start_date: string
  end_date: string | null
  status: 'active' | 'expiring_soon' | 'expired' | 'renewed'
  notes?: string | null
  document_url?: string | null
  created_at?: string
  outlet_staff?: { name: string; role: string; outlets?: { name: string } | null; phone?: string | null }
}

// ── Shift Roster ────────────────────────────────────
export type ShiftType = 'Pagi' | 'Siang' | 'Sore' | 'Malam' | 'Middle' | 'Full' | 'Off'

export interface ShiftRosterItem {
  id: string
  staff_id: string
  outlet_id: string
  date: string // YYYY-MM-DD
  shift: ShiftType
  notes?: string | null
  outlet_staff?: { name: string; role: string }
}

// ── Discipline & Warning ────────────────────────────────────
export type WarningLevel = 'Teguran' | 'Teguran Lisan' | 'SP1' | 'SP2' | 'SP3' | 'Skorsing'

export interface DisciplineRecord {
  id: string
  staff_id: string
  warning_level: WarningLevel
  incident_date?: string
  issue_date?: string
  expiry_date?: string | null
  expires_at?: string
  reason: string
  action_plan?: string
  issued_by?: string
  issued_at?: string
  created_by?: string | null
  document_url?: string | null
  status: 'active' | 'resolved' | 'expired'
  outlet_staff?: { name: string; role: string; outlets?: { name: string } | null }
}

// ── Performance & KPI ───────────────────────────────────────
export interface PerformanceRecord {
  staff_id: string
  staff_name: string
  role: string
  outlet_name: string
  period: string // YYYY-MM
  attendance_rate: number // %
  punctuality_rate: number // %
  total_working_days: number
  total_late_minutes: number
  crew_bonus: number
  kpi_score: number
  grade: 'A' | 'B' | 'C' | 'D'
}
