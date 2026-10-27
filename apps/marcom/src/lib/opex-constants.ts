export type OpexItemSource = 'ENDORSEMENT' | 'ADS' | 'MANUAL'

export interface OpexItem {
  id: string
  source: OpexItemSource
  sourceId: string
  date: string
  category: string
  categoryLabel: string
  description: string
  outletId: string | null
  outletName: string
  amount: number
  paymentSource: string
  paymentStatus: string
  receiptUrl?: string | null
  isEditable: boolean
}

export interface OpexSummary {
  periodMonth: number
  periodYear: number
  totalOpex: number
  totalEndorsement: number
  totalAds: number
  totalManual: number
  totalHppMenu: number
  totalBudget: number
  remainingBudget: number
  items: OpexItem[]
}

export type ActionState = {
  success?: boolean
  error?: string
}

export const MARCOM_EXPENSE_CATEGORIES: Record<string, string> = {
  CETAK_BRANDING: 'Cetak & Branding (Banner/Spanduk/Stiker)',
  PRODUKSI_KONTEN: 'Produksi Konten (Photoshoot/Video/Talent)',
  SOFTWARE_TOOLS: 'Software & Tools (AI/Canva/Domain/Hosting)',
  EVENT_AKTIVASI: 'Event & Aktivasi (Bazaar/Merchandise)',
  OPERASIONAL_TRANSPORT: 'Transport & Operasional Lapangan',
  HPP_MENU: 'HPP Menu (Complimentary KOL)',
  LAINNYA: 'Pengeluaran Marcom Lainnya',
}


/**
 * Mengurai string receipt_url (bisa URL tunggal, JSON array string, atau pemisah koma/newline)
 * menjadi array URL string yang bersih.
 */
export function parseReceiptUrls(raw?: string | null): string[] {
  if (!raw || typeof raw !== 'string') return []
  const trimmed = raw.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          .map((u) => u.trim())
      }
    } catch {
      // fallback
    }
  }

  if (trimmed.includes('\n')) {
    return trimmed.split('\n').map((u) => u.trim()).filter(Boolean)
  }
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((u) => u.trim()).filter(Boolean)
  }

  return [trimmed]
}

/**
 * Menyimpan array URL ke bentuk string.
 * Jika kosong: null
 * Jika 1 URL: simpan sebagai string URL langsung (kompatibel penuh dengan sistem lama)
 * Jika > 1 URL: simpan sebagai JSON string array: ["url1", "url2"]
 */
export function serializeReceiptUrls(urls: string[]): string | null {
  const cleaned = urls.map((u) => u?.trim()).filter((u): u is string => !!u)
  if (cleaned.length === 0) return null
  if (cleaned.length === 1) return cleaned[0]
  return JSON.stringify(cleaned)
}
