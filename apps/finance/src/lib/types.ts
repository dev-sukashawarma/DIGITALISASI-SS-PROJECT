export type CashKind = 'bank' | 'cash'
export type CashScope = 'pusat' | 'outlet'
export type CashDirection = 'in' | 'out'
export type CashSourceType =
  | 'payroll' | 'supplier_po' | 'expense_pusat' | 'kasbon'
  | 'cash_deposit' | 'manual' | 'transfer'
export type CashTxStatus =
  | 'draft' | 'pending_approval' | 'approved'
  | 'paid' | 'reconciled' | 'rejected' | 'void'

export interface CashLocation {
  id: string
  label: string
  kind: CashKind
  bank_name: string | null
  account_no: string | null
  holder_name: string | null
  scope: CashScope
  outlet_id: string | null
  is_active: boolean
  opening_balance: number
  opening_date: string
  created_at: string
}

export interface CashBalance {
  cash_location_id: string
  saldo: number
  updated_at: string
}

export interface CashTransaction {
  id: string
  cash_location_id: string
  direction: CashDirection
  amount: number
  signed_amount: number
  category: string | null
  occurred_at: string
  note: string | null
  source_type: CashSourceType
  source_id: string | null
  counter_transaction_id: string | null
  status: CashTxStatus
  proof_url: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  reconciled_at: string | null
  created_at: string
  // joined (optional)
  cash_location?: Pick<CashLocation, 'label' | 'kind'> | null
  outlet?: { name: string } | null
}

/** Lokasi kas + saldo tergabung untuk tampilan dashboard. */
export interface LocationWithBalance extends CashLocation {
  saldo: number
}

export type PettyCashStatus = 'pending' | 'forwarded_to_korlap' | 'forwarded_to_finance' | 'approved' | 'rejected'
export type DisbursementMethod = 'potong_setoran' | 'transfer' | 'tunai'

export interface PettyCashTopup {
  id: string
  shift_id: string
  amount: number
  reason: string
  status: PettyCashStatus
  disbursement_method: DisbursementMethod | null
  disbursed_from_cash_location_id: string | null
  created_at: string
  approved_by: string | null
  finance_approved_by: string | null
  approved_at: string | null
  // Joins
  outlet_staff?: { name: string } | null
  outlet?: { id: string, name: string } | null
}
