import type { BudgetStatus } from '@/lib/stok/budget'
export type { PeriodType } from '@/lib/stok/budget'

export interface OutletBudgetSummaryItem extends BudgetStatus {
  outletName: string
  region: string
  percentage: number
  updatedByStaffName: string | null
  updatedAt: string | null
}

export interface SpendingItemDetail {
  id: string
  bahanBakuId: string
  namaBahan: string
  kategori: string
  satuanDistribusi: string
  qtyDimintaDistribusi: number
  qtyDisetujuiDistribusi: number
  hargaSnapshot: number
  subtotal: number
}

export interface OutletSpendingTransaction {
  id: string
  kodePermintaan: string
  outletId: string
  status: string
  createdAt: string
  approvedAt: string
  requesterName: string
  totalNilai: number
  totalItems: number
  items: SpendingItemDetail[]
}

export interface BudgetConfigHistoryItem {
  id: string
  outletId: string
  nominalLama: number | null
  nominalBaru: number
  periodTypeLama: string | null
  periodTypeBaru: string
  customDaysLama: number | null
  customDaysBaru: number | null
  changedByName: string | null
  changedAt: string
  catatan: string | null
}
