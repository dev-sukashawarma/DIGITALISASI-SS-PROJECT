import type { KonteksMarcom } from './tipe'
import { hitungEndorsement } from './endorsement'
import { hitungJadwalKonten } from './konten'
import { hitungAdsBudget } from './adsBudget'
import { hitungPromoAktif } from './promo'
import { hitungAnalisisKonten } from './analisisKonten'

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
]
