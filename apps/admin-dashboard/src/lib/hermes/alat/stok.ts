import { z } from 'zod'
import type { DefinisiAlat } from '../registry'
import { alatStokBahan } from '@/lib/sukaBot/alat/stok'

export const ALAT_STOK: DefinisiAlat[] = [
  {
    nama: 'stok_bahan',
    domain: 'stok',
    deskripsi: 'Cek saldo sistem bahan baku di cabang atau Gudang Pusat (misal: SAPI, ROTI, SAOS CABE). Sumber: App Stok (Monitoring).',
    sumber: 'App Stok (Monitoring)',
    skema: z.object({ bahan: z.string().min(1, 'Nama bahan wajib diisi'), outlet: z.string().optional() }).strict(),
    contoh: { bahan: 'sapi' },
    jalankan: async (ctx, a: { bahan: string; outlet?: string }) => {
      const res: any = await alatStokBahan(ctx.stok, a)
      if (res.status === 'tidak_ditemukan') return { status: 'galat', pesan: res.pesan }
      return res
    },
  },
  {
    nama: 'stok_surat_jalan',
    domain: 'stok',
    deskripsi: 'Daftar surat jalan pengiriman bahan baku ke outlet: status draft, dikirim, diterima sebagian/lengkap, rincian barang, jumlah kirim vs terima, dan selisihnya.',
    sumber: 'Distribusi (Surat Jalan)',
    skema: z
      .object({
        status: z.enum(['draft', 'dikirim', 'diterima_sebagian', 'diterima_lengkap', 'semua']).optional().describe('Filter status surat jalan'),
        limit: z.number().int().min(1).max(50).optional().describe('Jumlah maksimal data yang diambil (default 10)'),
      })
      .strict(),
    contoh: { status: 'dikirim', limit: 5 },
    jalankan: async (ctx, a: { status?: string; limit?: number }) => {
      const daftar = await ctx.stok.suratJalan(a)
      return {
        status: 'ok',
        total: daftar.length,
        daftar,
      }
    },
  },
  {
    nama: 'stok_opname',
    domain: 'stok',
    deskripsi: 'Riwayat opname stok terbaru per outlet untuk periode terbatas. Hanya data status, tipe, tanggal, dan outlet; tanpa identitas staf.',
    sumber: 'App Stok (Opname)',
    skema: z.object({
      outlet: z.string().min(1).optional().describe('Nama atau slug outlet yang persis; kosong berarti semua outlet.'),
      hari: z.number().int().min(1).max(90).default(30).describe('Rentang riwayat dalam hari (maksimal 90).'),
      limit: z.number().int().min(1).max(50).default(20).describe('Jumlah maksimal baris.'),
    }).strict(),
    contoh: { hari: 30, limit: 20 },
    jalankan: async (ctx, a: { outlet?: string; hari: number; limit: number }) => ({
      status: 'ok',
      rentang_hari: a.hari,
      daftar: await ctx.stok.opname(a),
    }),
  },
  {
    nama: 'stok_permintaan_bahan',
    domain: 'stok',
    deskripsi: 'Riwayat permintaan bahan terbaru per outlet untuk periode terbatas. Hanya status, tanggal, dan outlet; tanpa catatan bebas atau identitas staf.',
    sumber: 'App Stok (Permintaan Bahan)',
    skema: z.object({
      outlet: z.string().min(1).optional().describe('Nama atau slug outlet yang persis; kosong berarti semua outlet.'),
      hari: z.number().int().min(1).max(90).default(30).describe('Rentang riwayat dalam hari (maksimal 90).'),
      limit: z.number().int().min(1).max(50).default(20).describe('Jumlah maksimal baris.'),
    }).strict(),
    contoh: { hari: 30, limit: 20 },
    jalankan: async (ctx, a: { outlet?: string; hari: number; limit: number }) => ({
      status: 'ok',
      rentang_hari: a.hari,
      daftar: await ctx.stok.permintaanBahan(a),
    }),
  },
]
