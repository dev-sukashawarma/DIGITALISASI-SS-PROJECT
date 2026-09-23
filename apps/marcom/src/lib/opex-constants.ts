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
