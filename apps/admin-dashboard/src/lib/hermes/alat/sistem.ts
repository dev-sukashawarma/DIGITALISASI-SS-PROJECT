import { z } from 'zod'
import type { DefinisiAlat } from '../registry'

export const ALAT_SISTEM: DefinisiAlat[] = [
  {
    nama: 'sistem_status',
    domain: 'sistem',
    deskripsi: 'Status operasional infrastruktur sistem pusat Suka Shawarma, konektivitas database Supabase, waktu server (WIB), dan kesiapan modul.',
    sumber: 'Infrastruktur Sistem',
    skema: z.object({}).strict(),
    contoh: {},
    jalankan: async (ctx) => {
      const dbInfo = await ctx.sistem.database()
      return {
        status: 'ok',
        waktu_server_wib: ctx.sekarang.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        database: dbInfo.status,
        telemetri_database: dbInfo,
        modul_aktif: [
          'penjualan',
          'absensi',
          'finance',
          'stok',
          'marcom',
          'review',
        ],
        pesan: dbInfo.status === 'terhubung'
          ? 'Sistem operasional dan database Supabase beroperasi normal.'
          : 'Peringatan: Database terdeteksi kendala koneksi.',
      }
    },
  },
]
