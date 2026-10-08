import type { ExpenseRow } from '@/lib/expenseRow'

export interface OutletNama { id: string; name: string; type: string }
export interface PoBaris {
  nomorPo: string
  supplier: string
  tanggalPo: string
  status: string
  nilaiPesan: number
  nilaiTerima: number
  jatuhTempo: string | null
  statusBayar: string
}
/** Setoran tercatat (cash_transaction source_type='cash_deposit'). Tanpa proof_url/note. */
export interface SetoranBaris { outletId: string | null; nominal: number; tanggalJual: string | null; occurredAt: string; jenis: string | null }
export interface ShiftBaris { outletId: string; mulai: string; status: string; seharusnya: number; fisik: number; selisih: number; kasir: string | null }

export interface KonteksFinance {
  hariIni: string
  outlets(): Promise<OutletNama[]>
  purchaseOrders(): Promise<PoBaris[]>
  pengeluaran(dari: string, sampai: string): Promise<ExpenseRow[]>
  setoran(dari: string, sampai: string): Promise<SetoranBaris[]>
  shift(dari: string, sampai: string): Promise<ShiftBaris[]>
}
