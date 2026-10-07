import { z } from 'zod'
import { alatOmzet, alatBandingkan, alatMenuTerlaris, alatRankingOutlet } from '@/lib/sukaBot/alat/penjualan'
import { hitungRekap, tanggalRekapUntuk } from '@/lib/sukaBot/rekap'
import { teksLaporanPagiCeo } from '../laporanPagi'
import type { DefinisiAlat } from '../registry'

// Domain penjualan. Semua alat membungkus fungsi SUKA Bot yang sudah teruji (rumus =
// Rangkuman Penjualan, outlet terhitung = internal + mitra) — tidak ada rumus baru di sini.

const TGL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format YYYY-MM-DD')
const PERIODE = z
  .enum(['hari_ini', 'kemarin', 'minggu_ini', 'minggu_lalu', 'bulan_ini', 'bulan_lalu', 'rentang'])
  .describe('Periode. Pakai "rentang" + dari/sampai untuk tanggal tertentu.')
const KANAL = z
  .enum(['semua', 'kasir', 'gofood', 'grabfood', 'shopeefood', 'food_apps', 'tiktok_go', 'web'])
  .describe('Kanal penjualan. Default semua.')
const OUTLET = z.string().min(1).max(60).describe('Nama outlet (sebagian nama boleh). Kosongkan untuk semua outlet.')

const zPeriode = { periode: PERIODE, dari: TGL.optional(), sampai: TGL.optional() }

export const ALAT_PENJUALAN: DefinisiAlat[] = [
  {
    nama: 'penjualan_ringkasan',
    domain: 'penjualan',
    deskripsi: 'Omzet kotor, omzet bersih, dan jumlah transaksi untuk satu periode, semua outlet atau satu outlet. Angka = Rangkuman Penjualan.',
    skema: z.object({ ...zPeriode, outlet: OUTLET.optional(), kanal: KANAL.optional() }).strict(),
    contoh: { periode: 'kemarin' },
    jalankan: (ctx, a) => alatOmzet(ctx.penjualan, a),
  },
  {
    nama: 'penjualan_bandingkan',
    domain: 'penjualan',
    deskripsi: 'Bandingkan omzet satu periode dengan periode pembanding (default: periode sebelumnya yang setara). Hasil dalam rupiah, tanpa persen.',
    skema: z
      .object({ ...zPeriode, pembanding: z.object(zPeriode).strict().optional(), outlet: OUTLET.optional(), kanal: KANAL.optional() })
      .strict(),
    contoh: { periode: 'minggu_lalu' },
    jalankan: (ctx, a) => alatBandingkan(ctx.penjualan, a),
  },
  {
    nama: 'penjualan_menu_terlaris',
    domain: 'penjualan',
    deskripsi: 'Daftar menu terlaris (atau tersepi) berdasarkan jumlah porsi untuk satu periode.',
    skema: z
      .object({
        ...zPeriode,
        outlet: OUTLET.optional(),
        kanal: KANAL.optional(),
        urutan: z.enum(['terlaris', 'tersepi']).optional(),
        jumlah: z.number().int().min(1).max(20).optional(),
      })
      .strict(),
    contoh: { periode: 'kemarin', jumlah: 3 },
    jalankan: (ctx, a) => alatMenuTerlaris(ctx.penjualan, a),
  },
  {
    nama: 'penjualan_peringkat_outlet',
    domain: 'penjualan',
    deskripsi: 'Peringkat semua outlet terhitung (internal + mitra, tanpa outlet tes & SS Online) berdasarkan omzet kotor.',
    skema: z.object({ ...zPeriode, kanal: KANAL.optional() }).strict(),
    contoh: { periode: 'kemarin' },
    jalankan: (ctx, a) => alatRankingOutlet(ctx.penjualan, a),
  },
  {
    nama: 'laporan_pagi_ceo',
    domain: 'penjualan',
    deskripsi: 'Laporan pagi CEO siap kirim (teks) + datanya. Tanggal default = kemarin (sebelum 05:00 WIB = lusa). Kirim field "teks" apa adanya.',
    skema: z.object({ tanggal: TGL.optional() }).strict(),
    contoh: {},
    jalankan: async (ctx, a: { tanggal?: string }) => {
      const tanggal = a.tanggal ?? tanggalRekapUntuk(ctx.sekarang)
      const d = await hitungRekap(ctx.penjualan, tanggal)
      return {
        status: 'ok',
        tanggal,
        teks: teksLaporanPagiCeo(d),
        data: {
          omzet_kotor: d.omzet,
          omzet_minggu_lalu: d.omzetPembanding,
          transaksi: d.transaksi,
          peringkat: d.ranking,
          menu_teratas: d.menuTeratas,
        },
        sumber: 'Rangkuman Penjualan',
      }
    },
  },
]
