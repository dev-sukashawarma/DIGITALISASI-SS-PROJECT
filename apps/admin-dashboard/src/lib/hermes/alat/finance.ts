import { z } from 'zod'
import { resolvePeriode, type KodePeriode } from '@/lib/sukaBot/periode'
import type { DefinisiAlat, KonteksHermes } from '../registry'
import { pilihOutlet } from '../absensi/outlet'
import { hitungUtang, ringkasPengeluaran, ringkasSelisihKasir, ringkasSetoran } from '../finance/hitung'

// Domain finance (spec 2026-10-08 Finance 1). Angka = layar sumber; tanpa keterangan bebas,
// nota/bukti, atau nomor rekening (dijaga gerbang pengecualian.ts).

const TGL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format YYYY-MM-DD')
const PERIODE = z
  .enum(['hari_ini', 'kemarin', 'minggu_ini', 'minggu_lalu', 'bulan_ini', 'bulan_lalu', 'rentang'])
  .describe('Periode. Pakai "rentang" + dari/sampai untuk tanggal tertentu.')
const OUTLET = z.string().min(1).max(60).describe('Nama outlet (sebagian nama boleh). Kosongkan untuk semua.')
const zPeriode = { periode: PERIODE, dari: TGL.optional(), sampai: TGL.optional() }

const galat = (pesan: string) => ({ status: 'galat', pesan })

function periode(ctx: KonteksHermes, a: { periode: KodePeriode; dari?: string; sampai?: string }) {
  try {
    const p = resolvePeriode(a.periode, ctx.finance.hariIni, { dari: a.dari, sampai: a.sampai })
    return { ok: true as const, p, keluaran: { dari: p.dari, sampai: p.sampai, label: p.label } }
  } catch (e) {
    return { ok: false as const, pesan: e instanceof Error ? e.message : String(e) }
  }
}

export const ALAT_FINANCE: DefinisiAlat[] = [
  {
    nama: 'utang_po',
    domain: 'finance',
    deskripsi:
      'Utang ke supplier: PO yang barangnya sudah diterima dan belum lunas (nilai terima), lewat jatuh tempo, per supplier, dan daftar PO. Komitmen (PO belum diterima, nilai pesan) dilaporkan terpisah — jangan dijumlahkan ke utang.',
    sumber: 'Pembelian (PO)',
    skema: z
      .object({ jatuh_tempo_dalam_hari: z.number().int().min(0).max(365).optional().describe('Hanya PO yang jatuh tempo paling lambat N hari lagi (termasuk yang sudah lewat).') })
      .strict(),
    contoh: {},
    jalankan: async (ctx, a: { jatuh_tempo_dalam_hari?: number }) => ({
      status: 'ok',
      per_tanggal: ctx.finance.hariIni,
      ...hitungUtang(await ctx.finance.purchaseOrders(), ctx.finance.hariIni, a.jatuh_tempo_dalam_hari),
    }),
  },
  {
    nama: 'pengeluaran_ringkasan',
    domain: 'finance',
    deskripsi: 'Total pengeluaran satu periode (biaya bulanan + kas kecil), dibagi outlet vs pusat, per kategori, dan per outlet. Angka = halaman Pengeluaran.',
    sumber: 'Pengeluaran (admin)',
    skema: z.object({ ...zPeriode, outlet: OUTLET.optional() }).strict(),
    contoh: { periode: 'bulan_ini' },
    jalankan: async (ctx, a) => {
      const per = periode(ctx, a)
      if (!per.ok) return galat(per.pesan)
      let ids: Set<string> | undefined
      if (a.outlet) {
        const pilih = pilihOutlet(await ctx.finance.outlets(), a.outlet)
        if (!pilih.ok) return galat(pilih.pesan)
        ids = new Set(pilih.outlets.map((o) => o.id))
      }
      const rows = await ctx.finance.pengeluaran(per.p.dari, per.p.sampai)
      return { status: 'ok', periode: per.keluaran, ...ringkasPengeluaran(rows, ids) }
    },
  },
  {
    nama: 'setoran_ringkasan',
    domain: 'finance',
    deskripsi:
      'Setoran kas outlet yang SUDAH DICATAT di app Finance, per tanggal jual. Data kosong berarti belum ada setoran yang dicatat — bukan bukti outlet belum setor.',
    sumber: 'Setoran (app Finance)',
    catatanMeta: 'Pencatatan setoran di sistem dimulai 2026-10-08; data kosong berarti belum dicatat, bukan pasti belum setor.',
    skema: z.object(zPeriode).strict(),
    contoh: { periode: 'minggu_ini' },
    jalankan: async (ctx, a) => {
      const per = periode(ctx, a)
      if (!per.ok) return galat(per.pesan)
      const [rows, outlets] = await Promise.all([ctx.finance.setoran(per.p.dari, per.p.sampai), ctx.finance.outlets()])
      return { status: 'ok', periode: per.keluaran, ...ringkasSetoran(rows, outlets, per.p.dari, per.p.sampai) }
    },
  },
  {
    nama: 'selisih_kasir',
    domain: 'finance',
    deskripsi:
      'Selisih uang fisik vs seharusnya saat tutup shift POS, per outlet dan per shift (dengan nama kasir), plus shift hari sebelumnya yang belum ditutup. Default kemarin.',
    sumber: 'Tutup shift POS',
    skema: z.object({ ...zPeriode, periode: PERIODE.optional() }).strict(),
    contoh: {},
    jalankan: async (ctx, a) => {
      const per = periode(ctx, { ...a, periode: a.periode ?? 'kemarin' })
      if (!per.ok) return galat(per.pesan)
      const [shifts, outlets] = await Promise.all([ctx.finance.shift(per.p.dari, per.p.sampai), ctx.finance.outlets()])
      return { status: 'ok', periode: per.keluaran, ...ringkasSelisihKasir(shifts, outlets, ctx.finance.hariIni) }
    },
  },
]
