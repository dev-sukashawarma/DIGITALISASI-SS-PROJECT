import type { KonteksMarcom } from './tipe'
import { hitungEndorsement } from './endorsement'
import { hitungJadwalKonten } from './konten'
import { hitungAdsBudget } from './adsBudget'
import { hitungPromoAktif } from './promo'
import { hitungAnalisisKonten } from './analisisKonten'
import { hitungKol } from './kol'
import { hitungPengeluaran } from './pengeluaran'
import { hitungIklan } from './iklan'
import { hitungAnalisisVideo } from './analisisVideo'
import { hitungTargetOutlet } from './targetOutlet'
import { hitungMenu } from './menu'

const PARAM_PERIODE = {
  periode: {
    type: 'string',
    description: 'Periode: hari_ini, kemarin, minggu_ini, minggu_depan, bulan_ini (default), custom',
  },
  dari: { type: 'string', description: 'Tanggal awal YYYY-MM-DD (jika custom)' },
  sampai: { type: 'string', description: 'Tanggal akhir YYYY-MM-DD (jika custom)' },
}

export interface AlatDefinisi {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  jalankan: (konteks: KonteksMarcom, args: any) => Promise<any>
}

export const DAFTAR_ALAT_MARCOM: AlatDefinisi[] = [
  {
    name: 'marcom_endorsement',
    description:
      'Ringkasan dan daftar endorsement KOL: status visit, draft review video, jadwal posting, dan status bayar rate card.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description:
            'Filter status: PENDING_VISIT, PENDING_DRAFT, DRAFT_REVISION, PENDING_POST, UNPAID, DOWN_PAYMENT, PAID',
        },
        outlet: { type: 'string', description: 'Filter nama outlet (misal: "Solo Baru")' },
        kol_nama: { type: 'string', description: 'Filter nama KOL (misal: "Jessica")' },
        limit: { type: 'number', description: 'Batas maksimal item yang ditampilkan (default: 20)' },
      },
    },
    async jalankan(konteks, args) {
      return hitungEndorsement(konteks, args)
    },
  },
  {
    name: 'marcom_konten_jadwal',
    description:
      'Jadwal dan status posting konten internal TikTok/IG Reels/Feeds: judul, platform, pilar, jam posting, status tayang.',
    inputSchema: {
      type: 'object',
      properties: {
        periode: {
          type: 'string',
          description:
            'Periode jadwal: hari_ini (default), kemarin, minggu_ini, minggu_depan, bulan_ini, custom',
        },
        dari: { type: 'string', description: 'Tanggal awal format YYYY-MM-DD (jika custom)' },
        sampai: { type: 'string', description: 'Tanggal akhir format YYYY-MM-DD (jika custom)' },
        platform: { type: 'string', description: 'Filter platform: TIKTOK, IG_REELS, INSTAGRAM, YOUTUBE_SHORTS' },
        outlet: { type: 'string', description: 'Filter nama outlet terkait konten' },
        status: {
          type: 'string',
          description: 'Filter status: sudah_posting, belum_posting, siap_tayang, draft',
        },
        limit: { type: 'number', description: 'Batas maksimal item yang ditampilkan' },
      },
    },
    async jalankan(konteks, args) {
      return hitungJadwalKonten(konteks, args)
    },
  },
  {
    name: 'marcom_ads_budget',
    description:
      'Realisasi biaya iklan/marketing vs target budget per outlet, sisa budget, dan daftar iklan aktif yang sedang ON.',
    inputSchema: {
      type: 'object',
      properties: {
        bulan: { type: 'number', description: 'Bulan (1-12, default bulan ini)' },
        tahun: { type: 'number', description: 'Tahun (misal 2026, default tahun ini)' },
        outlet: { type: 'string', description: 'Filter nama outlet' },
      },
    },
    async jalankan(konteks, args) {
      return hitungAdsBudget(konteks, args)
    },
  },
  {
    name: 'marcom_promo_aktif',
    description:
      'Daftar promo dan event yang sedang berjalan aktif atau promo yang akan datang per outlet.',
    inputSchema: {
      type: 'object',
      properties: {
        tanggal: { type: 'string', description: 'Tanggal acuan YYYY-MM-DD (default hari ini)' },
        outlet: { type: 'string', description: 'Filter nama outlet' },
      },
    },
    async jalankan(konteks, args) {
      return hitungPromoAktif(konteks, args)
    },
  },
  {
    name: 'marcom_analisis_konten',
    description:
      'Analisis metrik performa konten marcom: total views, reach, total engagement, avg ER%, video terbaik (top views), breakdown pilar & tipe konten, serta perbandingan organik vs ads (rumus persis layar Content Metrics).',
    inputSchema: {
      type: 'object',
      properties: {
        periode: {
          type: 'string',
          description:
            'Periode analisis: hari_ini, kemarin, minggu_ini, minggu_depan, bulan_ini, custom',
        },
        dari: { type: 'string', description: 'Tanggal awal YYYY-MM-DD (jika custom)' },
        sampai: { type: 'string', description: 'Tanggal akhir YYYY-MM-DD (jika custom)' },
        platform: { type: 'string', description: 'Filter platform: TIKTOK, IG_REELS, INSTAGRAM' },
        outlet: { type: 'string', description: 'Filter nama outlet' },
        limit_top: { type: 'number', description: 'Banyaknya video teratas yang ditampilkan (default: 5)' },
      },
    },
    async jalankan(konteks, args) {
      return hitungAnalisisKonten(konteks, args)
    },
  },
  {
    name: 'marcom_kol',
    description:
      'Database KOL/influencer: akun sosmed, jumlah kerja sama, jumlah sudah posting, total rate card, total views, tanggal kerja sama terakhir, outlet yang pernah dikunjungi. Nomor HP & rekening TIDAK tersedia (hanya penanda ada/belum).',
    inputSchema: {
      type: 'object',
      properties: {
        nama: { type: 'string', description: 'Filter nama KOL' },
        outlet: { type: 'string', description: 'Hanya KOL yang pernah kerja sama dengan outlet ini' },
        limit: { type: 'number', description: 'Batas item (default 20, maks 100)' },
      },
    },
    async jalankan(konteks, args) {
      return hitungKol(konteks, args)
    },
  },
  {
    name: 'marcom_pengeluaran',
    description:
      'Biaya operasional marcom (OPEX Marketing): total, rincian per kategori (CETAK_BRANDING, PRODUKSI_KONTEN, SOFTWARE_TOOLS, EVENT_AKTIVASI, OPERASIONAL_TRANSPORT, LAINNYA), per outlet, per sumber dana, dan daftar transaksinya.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PARAM_PERIODE,
        outlet: { type: 'string', description: 'Filter nama outlet ("Pusat" untuk biaya brand)' },
        kategori: { type: 'string', description: 'Filter kategori, mis. CETAK_BRANDING' },
        limit: { type: 'number', description: 'Batas item daftar (default 50)' },
      },
    },
    async jalankan(konteks, args) {
      return hitungPengeluaran(konteks, args)
    },
  },
  {
    name: 'marcom_iklan',
    description:
      'Semua iklan berbayar (TikTok/Instagram) pada suatu periode: akun, kategori INTERNAL/MITRA, budget vs spent, views awal/akhir, status ON/OFF, biaya per 1.000 views, rekap per platform/akun/kategori.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PARAM_PERIODE,
        outlet: { type: 'string', description: 'Filter nama outlet atau nama akun iklan' },
        platform: { type: 'string', description: 'TIKTOK atau INSTAGRAM' },
        kategori: { type: 'string', description: 'INTERNAL atau MITRA' },
        status: { type: 'string', description: 'ON atau OFF' },
        limit: { type: 'number', description: 'Batas item daftar (default 30)' },
      },
    },
    async jalankan(konteks, args) {
      return hitungIklan(konteks, args)
    },
  },
  {
    name: 'marcom_analisis_video',
    description:
      'Hasil review AI video konten (halaman Analisis Video): skor total & skor hook/food appeal/audio/pacing/CTA, verdict (READY/REVISION/BOOSTER/REVIEW), kelebihan, kekurangan, saran perbaikan.',
    inputSchema: {
      type: 'object',
      properties: {
        verdict: { type: 'string', description: 'Filter verdict: READY, REVISION, BOOSTER, REVIEW' },
        cari: { type: 'string', description: 'Cari judul video / judul konten terkait' },
        limit: { type: 'number', description: 'Batas item (default 10, maks 50)' },
      },
    },
    async jalankan(konteks, args) {
      return hitungAnalisisVideo(konteks, args)
    },
  },
  {
    name: 'marcom_target_outlet',
    description:
      'Target budget marketing & target jumlah KOL per outlet untuk satu bulan, beserta catatannya. (Realisasinya pakai marcom_ads_budget.)',
    inputSchema: {
      type: 'object',
      properties: {
        bulan: { type: 'number', description: 'Bulan 1-12 (default bulan ini)' },
        tahun: { type: 'number', description: 'Tahun (default tahun ini)' },
        outlet: { type: 'string', description: 'Filter nama outlet' },
      },
    },
    async jalankan(konteks, args) {
      return hitungTargetOutlet(konteks, args)
    },
  },
  {
    name: 'marcom_menu',
    description:
      'Daftar menu (sama dengan halaman Menu Marcom): nama, kategori, harga kasir, harga coret, harga per kanal food apps, harga & status kampanye, tersedia/habis, tampil di aplikasi, paket; plus promo outlet yang berlaku hari ini. Tidak memuat HPP maupun data penjualan.',
    inputSchema: {
      type: 'object',
      properties: {
        cari: { type: 'string', description: 'Cari nama menu' },
        kategori: { type: 'string', description: 'Filter kategori menu' },
        hanya_tersedia: { type: 'boolean', description: 'true = hanya menu yang sedang tersedia' },
        limit: { type: 'number', description: 'Batas item (default 50, maks 200)' },
      },
    },
    async jalankan(konteks, args) {
      return hitungMenu(konteks, args)
    },
  },
]
