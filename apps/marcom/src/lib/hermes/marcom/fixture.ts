import type {
  EndorsementData,
  KontenData,
  BudgetData,
  AdData,
  PromoData,
  KonteksMarcom,
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
  }
}
