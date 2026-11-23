export type EtollIssuer =
  | 'mandiri_emoney'
  | 'bca_flazz'
  | 'bni_tapcash'
  | 'bri_brizzi'

export type EtollCardStatus = 'active' | 'inactive' | 'lost'

export type EtollTxType = 'debit' | 'topup'

export type EtollTxSource = 'chip' | 'untracked_gap' | 'manual'

export type EtollCategory =
  | 'belum_dikategorikan'
  | 'tol'
  | 'parkir'
  | 'bbm_merchant'
  | 'operasional_lain'
  | 'pribadi_anomali'
  | 'topup'
  | 'untracked_gap'

export type EtollTopupStatus = 'waiting_scan' | 'matched' | 'mismatch' | 'void'

export const ETOLL_ISSUER_LABELS: Record<EtollIssuer, string> = {
  mandiri_emoney: 'Mandiri e-Money',
  bca_flazz: 'BCA Flazz',
  bni_tapcash: 'BNI TapCash',
  bri_brizzi: 'BRI Brizzi',
}

export const ETOLL_ISSUER_BADGE_COLORS: Record<EtollIssuer, string> = {
  mandiri_emoney: 'bg-amber-100 text-amber-800 border-amber-200',
  bca_flazz: 'bg-blue-100 text-blue-800 border-blue-200',
  bni_tapcash: 'bg-orange-100 text-orange-800 border-orange-200',
  bri_brizzi: 'bg-sky-100 text-sky-800 border-sky-200',
}

export const ETOLL_CATEGORY_LABELS: Record<EtollCategory, string> = {
  belum_dikategorikan: 'Belum Dikategorikan',
  tol: 'Tol',
  parkir: 'Parkir',
  bbm_merchant: 'BBM / Merchant',
  operasional_lain: 'Operasional Lain',
  pribadi_anomali: 'Pribadi / Anomali',
  topup: 'Top-Up',
  untracked_gap: 'Selisih Tak Terlacak',
}

export const ETOLL_TAGGABLE_CATEGORIES: EtollCategory[] = [
  'tol',
  'parkir',
  'bbm_merchant',
  'operasional_lain',
  'pribadi_anomali',
]

export const ETOLL_TOPUP_STATUS_LABELS: Record<EtollTopupStatus, string> = {
  waiting_scan: 'Menunggu Scan',
  matched: 'Cocok di Chip',
  mismatch: 'Selisih / Perlu Cek',
  void: 'Dibatalkan',
}

export interface EtollCard {
  id: string
  card_number: string
  issuer: EtollIssuer
  label: string
  holder_staff_id: string | null
  outlet_id: string | null
  division: string | null
  vehicle_plate: string | null
  status: EtollCardStatus
  last_balance: number
  last_scanned_at: string | null
  last_scanned_by: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  holder?: { id: string; name: string; role: string } | null
  outlet?: { id: string; name: string } | null
  last_scanner?: { id: string; name: string } | null
}

export interface EtollCardAssignment {
  id: string
  card_id: string
  from_staff_id: string | null
  to_staff_id: string | null
  from_vehicle_plate: string | null
  to_vehicle_plate: string | null
  balance_at_handover: number | null
  note: string | null
  assigned_by: string | null
  assigned_at: string
  from_staff?: { id: string; name: string } | null
  to_staff?: { id: string; name: string } | null
  assigner?: { id: string; name: string } | null
}

export interface EtollScan {
  id: string
  card_id: string
  scanned_by: string | null
  scanned_at: string
  balance_before: number | null
  balance_after: number
  chip_records_found: number
  new_transactions_count: number
  untracked_gap_amount: number
  gps_lat: number | null
  gps_lng: number | null
  device_info: string | null
  raw_diagnostics: Record<string, unknown>
  scanner?: { id: string; name: string } | null
  card?: { id: string; label: string; card_number: string; issuer: EtollIssuer } | null
}

export interface EtollTerminalEntry {
  id: string
  issuer: EtollIssuer | 'all'
  terminal_code: string
  merchant_name: string
  default_category: Exclude<EtollCategory, 'belum_dikategorikan' | 'untracked_gap'>
  notes: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface EtollTransaction {
  id: string
  card_id: string
  scan_id: string | null
  holder_staff_id: string | null
  source: EtollTxSource
  tx_type: EtollTxType
  dedup_key: string
  occurred_at: string
  amount: number
  balance_after: number | null
  terminal_code: string | null
  merchant_label: string | null
  category: EtollCategory
  note: string | null
  tagged_by: string | null
  tagged_at: string | null
  raw_hex: string | null
  created_at: string
  // Joined
  card?: { id: string; label: string; card_number: string; issuer: EtollIssuer; vehicle_plate?: string | null } | null
  holder?: { id: string; name: string } | null
  tagger?: { id: string; name: string } | null
}

export interface EtollTopup {
  id: string
  card_id: string
  topup_date: string
  amount: number
  funding_source: string | null
  reference_no: string | null
  note: string | null
  status: EtollTopupStatus
  matched_transaction_id: string | null
  matched_scan_id: string | null
  matched_at: string | null
  mismatch_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  card?: { id: string; label: string; card_number: string; issuer: EtollIssuer } | null
  creator?: { id: string; name: string } | null
}

export interface IncomingChipTransaction {
  tx_type: EtollTxType
  occurred_at: string
  amount: number
  balance_after?: number | null
  terminal_code?: string | null
  raw_hex?: string | null
}

export interface IncomingScanPayload {
  card_number: string
  issuer: EtollIssuer
  balance: number
  scanned_at?: string
  gps_lat?: number | null
  gps_lng?: number | null
  device_info?: string | null
  transactions?: IncomingChipTransaction[]
  raw_diagnostics?: Record<string, unknown>
}
