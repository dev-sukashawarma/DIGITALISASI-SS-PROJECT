export interface EndorsementData {
  id: string
  kol_nama: string
  outlet_nama: string
  schedule_date: string // YYYY-MM-DD
  visit_status: 'PENDING' | 'VISITED' | 'CANCELLED' | string
  draft_status: 'PENDING' | 'APPROVED' | 'REVISION' | 'NOT_REQUIRED' | string
  post_status: 'OFF' | 'POSTED' | 'DRAFT' | string
  payment_status: 'UNPAID' | 'PAID' | 'BARTER' | 'DOWN_PAYMENT' | string
  rate_card: number
  tipe: 'VISIT' | 'DELIVERY' | string
  post_url?: string | null
  views: number
  likes: number
}

export interface KontenData {
  id: string
  title: string
  platform: 'TIKTOK' | 'IG_REELS' | 'INSTAGRAM' | 'YOUTUBE_SHORTS' | string
  pillar: string // e.g. Promo, Branding, Join Trend, Edukasi Menu, etc.
  contentType: string | null // e.g. Sidak Outlet, Info promo, Asthetic menu, etc.
  format: 'VIDEO' | 'FEED' | string
  status: 'Sudah Posting' | 'Siap Tayang' | 'Draft' | 'Proses Produksi' | string
  isAds: boolean
  adsBudget: number
  creator: string | null
  outletName: string
  postDate: string // YYYY-MM-DD
  postTime: string | null // e.g. 17:00
  reach: number
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  postUrl?: string | null
}

export interface BudgetData {
  outlet_nama: string
  period_month: number
  period_year: number
  target_budget: number
  target_kol_count: number
  spent: number
  kol_count: number
}

export interface AdData {
  id: string
  platform: 'TIKTOK' | 'INSTAGRAM' | string
  outlet_nama: string
  budget: number
  spent: number
  status: 'ON' | 'OFF' | string
  schedule_date: string // YYYY-MM-DD
}

export interface PromoData {
  id: string
  title: string
  description: string | null
  outlet_nama: string
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  type: string
}

export interface KonteksMarcom {
  sekarang: Date
  hariIni: string // YYYY-MM-DD (WIB)
  daftarEndorsement(): Promise<EndorsementData[]>
  daftarKonten(dari?: string, sampai?: string): Promise<KontenData[]>
  daftarBudget(bulan: number, tahun: number): Promise<BudgetData[]>
  daftarAds(): Promise<AdData[]>
  daftarPromo(tanggal?: string): Promise<PromoData[]>
}
