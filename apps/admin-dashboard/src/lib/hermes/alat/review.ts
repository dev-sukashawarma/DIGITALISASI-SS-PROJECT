import { z } from 'zod'
import type { DefinisiAlat } from '../registry'
import {
  agregasiSentimen,
  hitungRankingOutlet,
  saringAlertAktif,
  saringReviewNegatif,
} from '../review/hitung'

export const ALAT_REVIEW: DefinisiAlat[] = [
  {
    nama: 'review_ranking_outlet',
    domain: 'review',
    deskripsi:
      'Peringkat rating Google Maps semua cabang Suka Shawarma, total ulasan pelanggan, dan status operasional ulasan (good, watch, attention, critical).',
    sumber: 'SukaReview (Google Maps)',
    catatanMeta: 'Rating dan ulasan bersumber dari Google Business Profile yang disinkronkan oleh SukaReview.',
    skema: z
      .object({
        urutkan: z
          .enum(['tertinggi', 'terendah', 'ulasan_terbanyak'])
          .optional()
          .describe('Urutan peringkat cabang. Default tertinggi.'),
        status: z
          .enum(['good', 'watch', 'attention', 'critical'])
          .optional()
          .describe('Filter status operasional ulasan cabang.'),
      })
      .strict(),
    contoh: {},
    jalankan: async (ctx, a: { urutkan?: 'tertinggi' | 'terendah' | 'ulasan_terbanyak'; status?: string }) => ({
      status: 'ok',
      per_tanggal: ctx.review.hariIni,
      ...hitungRankingOutlet(await ctx.review.outlets(), a),
    }),
  },
  {
    nama: 'review_negatif_terbaru',
    domain: 'review',
    deskripsi:
      'Daftar ulasan negatif (rating bintang 1-2 atau sentimen negatif) terbaru dari pelanggan di Google Maps beserta ringkasan AI dan tingkat urgensi komplain.',
    sumber: 'SukaReview (Google Maps)',
    skema: z
      .object({
        outlet: z.string().min(1).max(60).optional().describe('Nama cabang (sebagian nama boleh). Kosongkan untuk semua cabang.'),
        limit: z.number().int().min(1).max(50).optional().describe('Batas jumlah ulasan negatif yang ditampilkan. Default 10.'),
        hanya_urgensi_tinggi: z.boolean().optional().describe('Jika true, hanya tampilkan komplain berurgensi tinggi.'),
      })
      .strict(),
    contoh: { limit: 10 },
    jalankan: async (ctx, a: { outlet?: string; limit?: number; hanya_urgensi_tinggi?: boolean }) => {
      let outletId: string | undefined
      if (a.outlet) {
        const semua = await ctx.review.outlets()
        const target = a.outlet.trim().toLowerCase()
        const cocok = semua.find((o) => o.nama.toLowerCase().includes(target) || o.slug.toLowerCase().includes(target))
        if (cocok) {
          outletId = cocok.id
        } else {
          return { status: 'galat', pesan: `Cabang "${a.outlet}" tidak ditemukan.` }
        }
      }
      const reviews = await ctx.review.reviews({ outletId, limit: 50 })
      return {
        status: 'ok',
        ...saringReviewNegatif(reviews, { limit: a.limit, hanyaUrgensiTinggi: a.hanya_urgensi_tinggi }),
      }
    },
  },
  {
    nama: 'review_sentimen_ringkasan',
    domain: 'review',
    deskripsi:
      'Ringkasan sentimen ulasan Google Maps (persentase positif, netral, negatif), distribusi rating bintang 1-5, dan daftar topik komplain pelanggan terbanyak.',
    sumber: 'SukaReview (Google Maps)',
    skema: z
      .object({
        outlet: z.string().min(1).max(60).optional().describe('Nama cabang untuk analisis spesifik. Kosongkan untuk seluruh cabang.'),
        rentang_hari: z.number().int().min(1).max(365).optional().describe('Rentang hari ulasan (misal 7, 30, 90). Kosongkan untuk seluruh riwayat.'),
      })
      .strict(),
    contoh: { rentang_hari: 30 },
    jalankan: async (ctx, a: { outlet?: string; rentang_hari?: number }) => {
      let outletId: string | undefined
      let namaCabang = 'Semua Cabang'
      if (a.outlet) {
        const semua = await ctx.review.outlets()
        const target = a.outlet.trim().toLowerCase()
        const cocok = semua.find((o) => o.nama.toLowerCase().includes(target) || o.slug.toLowerCase().includes(target))
        if (cocok) {
          outletId = cocok.id
          namaCabang = cocok.nama
        } else {
          return { status: 'galat', pesan: `Cabang "${a.outlet}" tidak ditemukan.` }
        }
      }
      const reviews = await ctx.review.reviews({ outletId, limit: 100 })
      return {
        status: 'ok',
        cabang: namaCabang,
        rentang_hari: a.rentang_hari ?? 'seluruh_riwayat',
        ...agregasiSentimen(reviews, { rentangHari: a.rentang_hari, sekarang: ctx.sekarang }),
      }
    },
  },
  {
    nama: 'review_alert_aktif',
    domain: 'review',
    deskripsi:
      'Daftar alert ulasan yang sedang aktif (ulasan bintang 1-2 baru, lonjakan ulasan negatif, atau rating cabang turun) yang memerlukan tindakan tim operasional.',
    sumber: 'SukaReview Alerts',
    skema: z
      .object({
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter tingkat keparahan alert.'),
        outlet: z.string().min(1).max(60).optional().describe('Filter nama cabang.'),
        limit: z.number().int().min(1).max(50).optional().describe('Batas jumlah alert. Default 20.'),
      })
      .strict(),
    contoh: {},
    jalankan: async (ctx, a: { severity?: 'low' | 'medium' | 'high' | 'critical'; outlet?: string; limit?: number }) => {
      let outletId: string | undefined
      if (a.outlet) {
        const semua = await ctx.review.outlets()
        const target = a.outlet.trim().toLowerCase()
        const cocok = semua.find((o) => o.nama.toLowerCase().includes(target) || o.slug.toLowerCase().includes(target))
        if (cocok) {
          outletId = cocok.id
        } else {
          return { status: 'galat', pesan: `Cabang "${a.outlet}" tidak ditemukan.` }
        }
      }
      const alerts = await ctx.review.alerts({ status: 'active', severity: a.severity, outletId, limit: a.limit })
      return {
        status: 'ok',
        ...saringAlertAktif(alerts, { severity: a.severity, outletId, limit: a.limit }),
      }
    },
  },
]
