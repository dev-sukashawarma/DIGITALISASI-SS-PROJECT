import { z } from 'zod'
import { alatOmzet, alatBandingkan, alatMenuTerlaris, alatRankingOutlet, type KonteksPenjualan } from './penjualan'
import { alatStokBahan, type KonteksStok } from './stok'

export interface DefinisiAlat { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface DepsAlat { penjualan: KonteksPenjualan; stok: KonteksStok; catatGagal: (alasan: string) => Promise<void> }

const KODE_PERIODE = ['hari_ini', 'kemarin', 'minggu_ini', 'minggu_lalu', 'bulan_ini', 'bulan_lalu', 'rentang'] as const
const KODE_KANAL = ['semua', 'kasir', 'gofood', 'grabfood', 'shopeefood', 'food_apps', 'tiktok_go', 'web'] as const
const TGL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const zPeriode = { periode: z.enum(KODE_PERIODE), dari: TGL.optional(), sampai: TGL.optional() }
const zOutlet = z.string().min(1).max(60).optional()
const zKanal = z.enum(KODE_KANAL).optional()

const SKEMA = {
  omzet: z.object({ ...zPeriode, outlet: zOutlet, kanal: zKanal }),
  bandingkan_periode: z.object({ ...zPeriode, pembanding: z.object(zPeriode).optional(), outlet: zOutlet, kanal: zKanal }),
  menu_terlaris: z.object({ ...zPeriode, outlet: zOutlet, kanal: zKanal, urutan: z.enum(['terlaris', 'tersepi']).optional(), jumlah: z.number().int().min(1).max(20).optional() }),
  ranking_outlet: z.object({ ...zPeriode, kanal: zKanal, bandingkan: z.boolean().optional() }),
  stok_bahan: z.object({ bahan: z.string().min(1).max(60), outlet: zOutlet }),
  catat_pertanyaan_gagal: z.object({ alasan: z.string().min(1).max(300) }),
} as const

const jsonPeriode = {
  periode: { type: 'string', enum: KODE_PERIODE, description: 'Kata waktu. Pakai "rentang" + dari/sampai hanya bila Bos menyebut tanggal persis.' },
  dari: { type: 'string', description: 'YYYY-MM-DD, hanya untuk periode "rentang"' },
  sampai: { type: 'string', description: 'YYYY-MM-DD, hanya untuk periode "rentang"' },
}
const jsonOutlet = { outlet: { type: 'string', description: 'Nama outlet seperti diucapkan Bos (mis. "beji", "cibubur"). Kosongkan untuk semua outlet.' } }
const jsonKanal = { kanal: { type: 'string', enum: KODE_KANAL, description: 'Kanal penjualan. Default semua.' } }

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]): DefinisiAlat =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } })

export const DEFINISI_ALAT: DefinisiAlat[] = [
  fn('omzet', 'Omzet kotor, omzet bersih, dan jumlah transaksi untuk satu periode, semua outlet atau satu outlet, opsional per kanal.', { ...jsonPeriode, ...jsonOutlet, ...jsonKanal }, ['periode']),
  fn('bandingkan_periode', 'Bandingkan omzet dua periode. Tanpa "pembanding", otomatis dibandingkan dengan rentang sama panjang sebelumnya (harian/mingguan: 7 hari sebelumnya).', { ...jsonPeriode, pembanding: { type: 'object', properties: jsonPeriode, required: ['periode'] }, ...jsonOutlet, ...jsonKanal }, ['periode']),
  fn('menu_terlaris', 'Menu paling laku atau paling sepi berdasarkan jumlah porsi terjual.', { ...jsonPeriode, ...jsonOutlet, ...jsonKanal, urutan: { type: 'string', enum: ['terlaris', 'tersepi'] }, jumlah: { type: 'integer', minimum: 1, maximum: 20 } }, ['periode']),
  fn('ranking_outlet', 'Peringkat semua outlet berdasarkan omzet kotor, beserta perubahan dibanding periode sebelumnya.', { ...jsonPeriode, ...jsonKanal, bandingkan: { type: 'boolean' } }, ['periode']),
  fn('stok_bahan', 'Saldo stok sistem satu bahan baku di semua lokasi atau satu lokasi, beserta tanggal opname terakhir.', { bahan: { type: 'string', description: 'Nama bahan seperti diucapkan Bos (mis. "sapi", "saos cabe")' }, ...jsonOutlet }, ['bahan']),
  fn('catat_pertanyaan_gagal', 'Panggil SEBELUM menjawab bila pertanyaan Bos tidak bisa dijawab dengan alat lain (mis. laba, HPP, gaji, absensi).', { alasan: { type: 'string', description: 'Ringkasan singkat apa yang ditanyakan dan kenapa tidak bisa' } }, ['alasan']),
]

export async function jalankanAlat(nama: string, argumenJson: string, deps: DepsAlat): Promise<Record<string, unknown>> {
  try {
    // Object.hasOwn, bukan `in`: "constructor"/"toString" tidak boleh lolos sebagai nama alat.
    if (!Object.hasOwn(SKEMA, nama)) return { status: 'galat', pesan: `Alat "${nama}" tidak ada` }
    let mentah: unknown
    try { mentah = JSON.parse(argumenJson || '{}') } catch { return { status: 'galat', pesan: 'Argumen alat bukan JSON yang valid' } }
    const hasil = SKEMA[nama as keyof typeof SKEMA].safeParse(mentah)
    if (!hasil.success) return { status: 'galat', pesan: `Argumen tidak valid: ${hasil.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}` }
    const a: any = hasil.data
    switch (nama) {
      case 'omzet': return await alatOmzet(deps.penjualan, a)
      case 'bandingkan_periode': return await alatBandingkan(deps.penjualan, a)
      case 'menu_terlaris': return await alatMenuTerlaris(deps.penjualan, a)
      case 'ranking_outlet': return await alatRankingOutlet(deps.penjualan, a)
      case 'stok_bahan': return await alatStokBahan(deps.stok, a)
      case 'catat_pertanyaan_gagal': await deps.catatGagal(a.alasan); return { status: 'ok' }
    }
    return { status: 'galat', pesan: `Alat "${nama}" tidak ada` }
  } catch (e: any) {
    return { status: 'galat', pesan: e?.message ?? 'Galat tak dikenal' }
  }
}
