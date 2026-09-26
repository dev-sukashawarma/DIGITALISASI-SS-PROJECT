import type { EomChannel, CashOutletRow, EomOutlet } from '@/lib/eom/kasir'

export interface ShiftDetail {
  tanggal: string
  outlet: string
  kasir: string
  expected: number
  fisik: number
  selisih: number
  status: string
  catatan: string
}

/** Bentuk respons GET /api/eom-closing/kasir. */
export interface KasirResponse {
  period: { month: number; year: number; from: string; to: string }
  hppCutoff: string | null
  hppPerubahan: [string, number][]
  kpi: {
    grossRevenue: number
    netRevenue: number
    totalDeductions: number
    totalHPP: number
    grossProfit: number
    totalOrders: number
    totalCashVariance: number
  }
  channels: EomChannel[]
  cash: CashOutletRow[]
  shiftDetails: ShiftDetail[]
  /** Hanya ada bila diminta dengan ?detail=outlet (untuk PDF). */
  outletDetails?: EomOutlet[]
  fetchedAt: string
}

/** Mulai tanggal ini setoran kantor ikut dinilai (keputusan 2026-09-26). */
export const SETORAN_WAJIB_MULAI = '2026-10-01'
export const AMBANG_MERAH = 50_000

/**
 * Konfirmasi setoran di luar sistem untuk bulan sebelum pencatatan setoran
 * wajib (keputusan owner 2026-09-26): seluruh setoran s/d tanggal ini sudah
 * dikonfirmasi valid oleh Admin Finance.
 */
export const KONFIRMASI_SETORAN_MANUAL: Record<string, string> = {
  '2026-09': '26 Sep 2026',
}
