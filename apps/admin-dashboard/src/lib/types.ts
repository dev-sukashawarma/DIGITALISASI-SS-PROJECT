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
  marquee_warning_threshold: number
}

export interface OutletFormValues {
  name: string
  slug: string
  address: string
  lat: number
  lng: number
  type: string
  is_active: boolean
  marquee_warning_threshold: number
  open_hour?: string
  close_hour?: string
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
  outlet_ids: string[] // dari staff_outlets (leader)
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

export type SalesSource = 'pos' | 'online' | 'gofood' | 'grabfood' | 'shopeefood' | 'tiktok'

export interface SalesSummaryRow {
  outlet_id: string
  outlet_name: string
  sales_source: SalesSource
  sales_date: string            // 'YYYY-MM-DD'
  omzet: number
  jumlah_order_completed: number
  jumlah_order_all: number
  total_deductions?: number
  platform_fee?: number
  promo_merchant?: number
  selisih_pencatatan?: number
}

export interface MenuSalesRow {
  outlet_id: string
  sales_source: SalesSource
  sales_date: string
  menu_key: string
  menu_name: string
  qty: number
  revenue: number
}

export interface PeriodFilterValue {
  from: string                  // 'YYYY-MM-DD' inklusif
  to: string                    // 'YYYY-MM-DD' inklusif
  outletId: string | 'all'
  source: SalesSource | 'all'
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
  created_at?: string
  updated_at?: string
  outlet_staff?: { name: string; role: string }
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
  outlet_staff?: { name: string; role: string; outlet_id: string; outlets: { name: string } | null }
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
