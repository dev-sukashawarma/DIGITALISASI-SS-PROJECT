import type {
  EndorsementData,
  KontenData,
  BudgetData,
  AdData,
  PromoData,
  KonteksMarcom,
  KolData,
  PengeluaranData,
  IklanData,
  AnalisisVideoData,
  TargetOutletData,
  TipeKontenData,
  MenuData,
  PromoMenuData,
} from './tipe'

export const mockEndorsements: EndorsementData[] = [
  {
    id: 'end-1',
    kol_nama: 'Jessica Foodie',
    outlet_nama: 'SS Karanganyar',
    schedule_date: '2026-10-08',
    visit_status: 'VISITED',
    draft_status: 'PENDING',
    post_status: 'DRAFT',
    payment_status: 'UNPAID',
    rate_card: 1500000,
    tipe: 'VISIT',
    views: 0,
    likes: 0,
  },
  {
    id: 'end-2',
    kol_nama: 'Budi Kuliner',
    outlet_nama: 'SS Solo Baru',
    schedule_date: '2026-10-09',
    visit_status: 'PENDING',
    draft_status: 'PENDING',
    post_status: 'OFF',
    payment_status: 'DOWN_PAYMENT',
    rate_card: 2000000,
    tipe: 'VISIT',
    views: 0,
    likes: 0,
  },
  {
    id: 'end-3',
    kol_nama: 'Rina Mukbang',
    outlet_nama: 'SS Kartasura',
    schedule_date: '2026-10-05',
    visit_status: 'VISITED',
    draft_status: 'APPROVED',
    post_status: 'POSTED',
    payment_status: 'PAID',
    rate_card: 1000000,
    tipe: 'DELIVERY',
    post_url: 'https://tiktok.com/@rinamukbang/video/123456789',
    views: 45000,
    likes: 3200,
  },
  {
    id: 'end-4',
    kol_nama: 'Doni Makan',
    outlet_nama: 'SS Karanganyar',
    schedule_date: '2026-10-02',
    visit_status: 'VISITED',
    draft_status: 'REVISION',
    post_status: 'OFF',
    payment_status: 'UNPAID',
    rate_card: 800000,
    tipe: 'VISIT',
    views: 0,
    likes: 0,
  },
]

export const mockKonten: KontenData[] = [
  {
    id: 'konten-1',
    title: 'Sidak Dapur Sambal Bakar',
    platform: 'TIKTOK',
    pillar: 'Branding',
    contentType: 'Sidak Outlet',
    format: 'VIDEO',
    status: 'Sudah Posting',
    isAds: false,
    adsBudget: 0,
    creator: 'Dimas Tim Marcom',
    outletName: 'SS Solo Baru',
    postDate: '2026-10-08',
    postTime: '12:00',
    reach: 25000,
    views: 30000,
    likes: 2400,
    comments: 150,
    shares: 80,
    saves: 95,
    postUrl: 'https://tiktok.com/@sambalselera/video/111',
  },
  {
    id: 'konten-2',
    title: 'Promo Gajian Diskon 30%',
    platform: 'IG_REELS',
    pillar: 'Promo',
    contentType: 'Info promo',
    format: 'VIDEO',
    status: 'Sudah Posting',
    isAds: true,
    adsBudget: 500000,
    creator: 'Siti Marcom',
    outletName: 'SS Karanganyar',
    postDate: '2026-10-07',
    postTime: '17:00',
    reach: 18000,
    views: 22000,
    likes: 1200,
    comments: 60,
    shares: 40,
    saves: 110,
    postUrl: 'https://instagram.com/reel/222',
  },
  {
    id: 'konten-3',
    title: 'Sound Viral Cek Ombak Pedas',
    platform: 'TIKTOK',
    pillar: 'Join Trend',
    contentType: 'Asthetic menu',
    format: 'VIDEO',
    status: 'Siap Tayang',
    isAds: false,
    adsBudget: 0,
    creator: 'Dimas Tim Marcom',
    outletName: 'SS Karanganyar',
    postDate: '2026-10-08',
    postTime: '19:00',
    reach: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
  },
  {
    id: 'konten-4',
    title: 'Behind The Scene Bikin Bebek Goreng',
    platform: 'IG_REELS',
    pillar: 'Branding',
    contentType: 'Sidak Outlet',
    format: 'VIDEO',
    status: 'Draft',
    isAds: false,
    adsBudget: 0,
    creator: 'Siti Marcom',
    outletName: 'SS Kartasura',
    postDate: '2026-10-09',
    postTime: '15:00',
    reach: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
  },
]

export const mockBudgets: BudgetData[] = [
  {
    outlet_nama: 'SS Karanganyar',
    period_month: 10,
    period_year: 2026,
    target_budget: 10000000,
    target_kol_count: 5,
    spent: 4500000,
    kol_count: 3,
  },
  {
    outlet_nama: 'SS Solo Baru',
    period_month: 10,
    period_year: 2026,
    target_budget: 12000000,
    target_kol_count: 6,
    spent: 8000000,
    kol_count: 4,
  },
  {
    outlet_nama: 'SS Kartasura',
    period_month: 10,
    period_year: 2026,
    target_budget: 8000000,
    target_kol_count: 4,
    spent: 2000000,
    kol_count: 1,
  },
]

export const mockAds: AdData[] = [
  {
    id: 'ad-1',
    platform: 'TIKTOK',
    outlet_nama: 'SS Solo Baru',
    budget: 3000000,
    spent: 1850000,
    status: 'ON',
    schedule_date: '2026-10-08',
  },
  {
    id: 'ad-2',
    platform: 'INSTAGRAM',
    outlet_nama: 'SS Karanganyar',
    budget: 2500000,
    spent: 2400000,
    status: 'ON',
    schedule_date: '2026-10-08',
  },
  {
    id: 'ad-3',
    platform: 'TIKTOK',
    outlet_nama: 'SS Kartasura',
    budget: 2000000,
    spent: 2000000,
    status: 'OFF',
    schedule_date: '2026-10-01',
  },
]

export const mockPromos: PromoData[] = [
  {
    id: 'promo-1',
    title: 'Diskon 30% Paket Bebek Bakar',
    description: 'Khusus dine-in makan siang',
    outlet_nama: 'SS Karanganyar',
    start_date: '2026-10-01',
    end_date: '2026-10-15',
    type: 'DISCOUNT',
  },
  {
    id: 'promo-2',
    title: 'Beli 2 Gratis 1 Es Teh Jumbo',
    description: 'Semua menu paket pedas',
    outlet_nama: 'SS Solo Baru',
    start_date: '2026-10-05',
    end_date: '2026-10-10',
    type: 'FREE_ITEM',
  },
  {
    id: 'promo-3',
    title: 'Festival Sambal Nusantara',
    description: 'Menu spesial sambal mangga & matah',
    outlet_nama: 'SS Kartasura',
    start_date: '2026-10-20',
    end_date: '2026-10-31',
    type: 'EVENT',
  },
]

export function buatKonteksMarcomPalsu(
  sekarang: Date = new Date('2026-10-08T10:00:00+07:00')
): KonteksMarcom {
  return {
    sekarang,
    hariIni: '2026-10-08',
    async daftarEndorsement() {
      return [...mockEndorsements]
    },
    async daftarKonten(dari?: string, sampai?: string) {
      if (!dari && !sampai) return [...mockKonten]
      return mockKonten.filter((k) => {
        if (dari && k.postDate < dari) return false
        if (sampai && k.postDate > sampai) return false
        return true
      })
    },
    async daftarBudget(bulan: number, tahun: number) {
      return mockBudgets.filter(
        (b) => b.period_month === bulan && b.period_year === tahun
      )
    },
    async daftarAds() {
      return [...mockAds]
    },
    async daftarPromo(tanggal?: string) {
      if (!tanggal) return [...mockPromos]
      return mockPromos.filter(
        (p) => p.start_date <= tanggal && p.end_date >= tanggal
      )
    },
    async daftarKol() {
      return [...mockKol]
    },
    async daftarPengeluaran(dari: string, sampai: string) {
      return mockPengeluaran.filter((p) => p.tanggal >= dari && p.tanggal <= sampai)
    },
    async daftarIklan(dari: string, sampai: string) {
      return mockIklan.filter((a) => a.tanggal >= dari && a.tanggal <= sampai)
    },
    async daftarAnalisisVideo() {
      return [...mockAnalisisVideo]
    },
    async daftarTargetOutlet(bulan: number, tahun: number) {
      return mockTargetOutlet.filter((t) => t.bulan === bulan && t.tahun === tahun)
    },
    async daftarTipeKonten() {
      return [...mockTipeKonten]
    },
    async daftarMenu() {
      return { menu: [...mockMenu], promo: [...mockPromoMenu] }
    },
  }
}

const akunKosong = { tiktok: null, instagram: null, youtube: null, facebook: null, threads: null }

export const mockKol: KolData[] = [
  {
    id: 'kol-1',
    nama: 'Jessica Foodie',
    akun: { ...akunKosong, tiktok: 'https://tiktok.com/@jessica' },
    punya_kontak: true,
    punya_rekening: true,
    endorsement: { total: 2, sudah_posting: 1, total_rate_card: 3000000, total_views: 40000, terakhir: '2026-10-08', outlet: ['SS Karanganyar'] },
  },
  {
    id: 'kol-2',
    nama: 'Budi Kuliner',
    akun: { ...akunKosong, instagram: 'https://instagram.com/budi' },
    punya_kontak: false,
    punya_rekening: false,
    endorsement: { total: 0, sudah_posting: 0, total_rate_card: 0, total_views: 0, terakhir: null, outlet: [] },
  },
  {
    id: 'kol-3',
    nama: 'Rina Mukbang',
    akun: akunKosong,
    punya_kontak: true,
    punya_rekening: false,
    endorsement: { total: 3, sudah_posting: 3, total_rate_card: 1500000, total_views: 90000, terakhir: '2026-10-05', outlet: ['SS Kartasura', 'SS Solo Baru'] },
  },
]

export const mockPengeluaran: PengeluaranData[] = [
  { id: 'exp-1', outlet_nama: 'SS Karanganyar', kategori: 'CETAK_BRANDING', jumlah: 500000, keterangan: 'Banner promo', tanggal: '2026-10-02', sumber_dana: 'transfer_pusat', ada_kuitansi: true },
  { id: 'exp-2', outlet_nama: 'Pusat (Brand)', kategori: 'PRODUKSI_KONTEN', jumlah: 1200000, keterangan: 'Sewa lighting', tanggal: '2026-10-05', sumber_dana: 'reimburse', ada_kuitansi: false },
  { id: 'exp-3', outlet_nama: 'SS Karanganyar', kategori: 'CETAK_BRANDING', jumlah: 300000, keterangan: 'Stiker', tanggal: '2026-10-07', sumber_dana: 'petty_cash', ada_kuitansi: true },
  { id: 'exp-4', outlet_nama: 'SS Solo Baru', kategori: 'EVENT_AKTIVASI', jumlah: 900000, keterangan: 'Bazar September', tanggal: '2026-09-20', sumber_dana: 'transfer_pusat', ada_kuitansi: true },
]

export const mockIklan: IklanData[] = [
  { id: 'ad-1', kategori: 'INTERNAL', platform: 'TIKTOK', akun: 'OFC TIKTOK', outlet_nama: 'Pusat (Brand)', tanggal: '2026-10-03', budget: 1000000, spent: 800000, views_awal: 1000, views_akhir: 40000, status: 'ON', ad_url: null },
  { id: 'ad-2', kategori: 'MITRA', platform: 'INSTAGRAM', akun: 'EMPANG', outlet_nama: 'SS Empang', tanggal: '2026-10-06', budget: 500000, spent: 200000, views_awal: null, views_akhir: null, status: 'OFF', ad_url: null },
  { id: 'ad-3', kategori: 'INTERNAL', platform: 'TIKTOK', akun: 'OFC TIKTOK', outlet_nama: 'Pusat (Brand)', tanggal: '2026-09-28', budget: 700000, spent: 700000, views_awal: 500, views_akhir: 10000, status: 'OFF', ad_url: null },
]

const skor = (n: number) => ({ hook: n, food_appeal: n, audio: n, pacing: n, cta: n })

export const mockAnalisisVideo: AnalisisVideoData[] = [
  { id: 'va-1', judul: 'Promo Jumbo', sumber_video: 'URL', video_url: 'https://tiktok.com/v/1', konten_terkait: 'Promo Jumbo Oktober', skor_total: 82, verdict: 'READY', skor: skor(8), kelebihan: ['Hook kuat'], kekurangan: [], saran: ['Tambah CTA'], catatan: null, dibuat: '2026-10-07' },
  { id: 'va-2', judul: 'Sidak Outlet Empang', sumber_video: 'FILE', video_url: null, konten_terkait: null, skor_total: 55, verdict: 'REVISION', skor: skor(5), kelebihan: [], kekurangan: ['Audio pelan'], saran: ['Rekam ulang suara'], catatan: 'Ulang besok', dibuat: '2026-10-05' },
  { id: 'va-3', judul: 'Asthetic menu', sumber_video: 'DRIVE', video_url: 'https://drive/x', konten_terkait: null, skor_total: 70, verdict: 'READY', skor: skor(7), kelebihan: [], kekurangan: [], saran: [], catatan: null, dibuat: '2026-10-08' },
]

export const mockTargetOutlet: TargetOutletData[] = [
  { outlet_nama: 'SS Karanganyar', bulan: 10, tahun: 2026, target_budget: 3000000, target_kol: 4, catatan: null },
  { outlet_nama: 'SS Solo Baru', bulan: 10, tahun: 2026, target_budget: 2000000, target_kol: 2, catatan: 'Fokus TikTok' },
  { outlet_nama: 'SS Karanganyar', bulan: 9, tahun: 2026, target_budget: 1000000, target_kol: 1, catatan: null },
]

export const mockTipeKonten: TipeKontenData[] = [
  { nama: 'Info promo', jumlah_konten: 3 },
  { nama: 'Sidak Outlet', jumlah_konten: 1 },
]

export const mockMenu: MenuData[] = [
  { id: 'm-1', nama: 'Original Ayam Jumbo', kategori: 'Shawarma', deskripsi: null, harga: 35000, harga_coret: null, harga_kanal: { gofood: 42000 }, harga_kampanye: null, kampanye_aktif: false, tersedia: true, tersedia_online: true, tampil_di_app: true, paket: false },
  { id: 'm-2', nama: 'Original Sapi Jumbo', kategori: 'Shawarma', deskripsi: null, harga: 38000, harga_coret: 40000, harga_kanal: {}, harga_kampanye: 30000, kampanye_aktif: true, tersedia: false, tersedia_online: false, tampil_di_app: false, paket: false },
  { id: 'm-3', nama: 'Paket Duo', kategori: 'Paket', deskripsi: 'Dua shawarma', harga: 65000, harga_coret: null, harga_kanal: {}, harga_kampanye: null, kampanye_aktif: false, tersedia: true, tersedia_online: true, tampil_di_app: true, paket: true },
]

export const mockPromoMenu: PromoMenuData[] = [
  { cakupan: 'item', menu_nama: 'Original Ayam Jumbo', outlet_nama: 'SS Empang', mulai: '2026-10-01', selesai: '2026-10-31', jam_mulai: null, jam_selesai: null },
  { cakupan: 'global', menu_nama: null, outlet_nama: 'SS Beji', mulai: '2026-10-01', selesai: '2026-10-05', jam_mulai: null, jam_selesai: null },
  { cakupan: 'item', menu_nama: 'Paket Duo', outlet_nama: 'SS Beji', mulai: null, selesai: null, jam_mulai: '14:00', jam_selesai: '16:00' },
]
