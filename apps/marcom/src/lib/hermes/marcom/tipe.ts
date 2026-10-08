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

export interface KonteksMarcom extends KonteksMarcomLanjutan {
  sekarang: Date
  hariIni: string // YYYY-MM-DD (WIB)
  daftarEndorsement(): Promise<EndorsementData[]>
  daftarKonten(dari?: string, sampai?: string): Promise<KontenData[]>
  daftarBudget(bulan: number, tahun: number): Promise<BudgetData[]>
  daftarAds(): Promise<AdData[]>
  daftarPromo(tanggal?: string): Promise<PromoData[]>
}

// ── Data lanjutan (alat tambahan 2026-10-08) ──────────────────────────────
// Sengaja TIDAK membawa nomor HP, rekening bank, email staf, URL kuitansi,
// atau HPP menu: bot hanya diberi penanda "ada/belum".

export interface KolData {
  id: string
  nama: string
  akun: {
    tiktok: string | null
    instagram: string | null
    youtube: string | null
    facebook: string | null
    threads: string | null
  }
  punya_kontak: boolean
  punya_rekening: boolean
  endorsement: {
    total: number
    sudah_posting: number
    total_rate_card: number
    total_views: number
    terakhir: string | null // YYYY-MM-DD
    outlet: string[]
  }
}

export interface PengeluaranData {
  id: string
  outlet_nama: string
  kategori: string
  jumlah: number
  keterangan: string
  tanggal: string // YYYY-MM-DD
  sumber_dana: string
  ada_kuitansi: boolean
}

export interface IklanData {
  id: string
  kategori: string // INTERNAL | MITRA
  platform: string
  akun: string | null
  outlet_nama: string
  tanggal: string // YYYY-MM-DD
  budget: number
  spent: number
  views_awal: number | null
  views_akhir: number | null
  status: string
  ad_url: string | null
}

export interface AnalisisVideoData {
  id: string
  judul: string
  sumber_video: string
  video_url: string | null
  konten_terkait: string | null
  skor_total: number
  verdict: string
  skor: { hook: number; food_appeal: number; audio: number; pacing: number; cta: number }
  kelebihan: string[]
  kekurangan: string[]
  saran: string[]
  catatan: string | null
  dibuat: string // YYYY-MM-DD
}

export interface TargetOutletData {
  outlet_nama: string
  bulan: number
  tahun: number
  target_budget: number
  target_kol: number
  catatan: string | null
}

export interface TipeKontenData {
  nama: string
  jumlah_konten: number
}

export interface MenuData {
  id: string
  nama: string
  kategori: string
  deskripsi: string | null
  harga: number
  harga_coret: number | null
  harga_kanal: Record<string, number>
  harga_kampanye: number | null
  kampanye_aktif: boolean
  tersedia: boolean
  tersedia_online: boolean
  tampil_di_app: boolean
  paket: boolean
}

export interface PromoMenuData {
  cakupan: 'global' | 'item' | string
  menu_nama: string | null
  outlet_nama: string
  mulai: string | null
  selesai: string | null
  jam_mulai: string | null
  jam_selesai: string | null
}

export interface KonteksMarcomLanjutan {
  daftarKol(): Promise<KolData[]>
  daftarPengeluaran(dari: string, sampai: string): Promise<PengeluaranData[]>
  daftarIklan(dari: string, sampai: string): Promise<IklanData[]>
  daftarAnalisisVideo(): Promise<AnalisisVideoData[]>
  daftarTargetOutlet(bulan: number, tahun: number): Promise<TargetOutletData[]>
  daftarTipeKonten(): Promise<TipeKontenData[]>
  daftarMenu(): Promise<{ menu: MenuData[]; promo: PromoMenuData[] }>
}
