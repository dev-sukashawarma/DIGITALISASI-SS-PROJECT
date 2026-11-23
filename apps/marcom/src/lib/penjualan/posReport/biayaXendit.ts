/* Biaya Xendit pesanan website untuk kartu Admin Fee Rangkuman Penjualan
 * (spec 2026-11-18-biaya-xendit-rangkuman-penjualan). Dihitung di luar cache hari laporan:
 * biaya asli baru ada setelah file Balance History diunggah, dan hak baca data Xendit
 * berbeda per pemanggil. Pesanan/pembayaran yang biayanya belum diketahui diestimasi. */
import { isPesananWebsite } from '@/lib/penjualan/xendit/website'
import { estimasiBiayaXendit } from '@/lib/penjualan/xendit/tarif'

export type BiayaPembayaran = {
  externalOrderId: string
  nominal: number
  channel: string | null
  dibayarAt: string
  biayaMdr: number | null
  biayaProses: number | null
  bukanPenjualan: boolean
}

export type HasilBiayaXendit = { total: number; estimasi: number; jumlahPesananEstimasi: number }

export const BIAYA_XENDIT_NOL: HasilBiayaXendit = { total: 0, estimasi: 0, jumlahPesananEstimasi: 0 }

type PesananBiaya = { sales_source?: string | null; external_order_id?: string | null; total_amount: number | string; created_at: string }

/** bayar === null = pemanggil tak berhak membaca data Xendit / gagal memuat → semua estimasi. */
export function hitungBiayaXendit(pesanan: PesananBiaya[], bayar: BiayaPembayaran[] | null): HasilBiayaXendit {
  const perPesanan = new Map<string, BiayaPembayaran[]>()
  for (const b of bayar ?? []) {
    if (b.bukanPenjualan) continue
    const arr = perPesanan.get(b.externalOrderId) ?? []
    arr.push(b)
    perPesanan.set(b.externalOrderId, arr)
  }

  let total = 0
  let estimasi = 0
  let jumlahPesananEstimasi = 0
  for (const o of pesanan) {
    if (!isPesananWebsite(o)) continue
    const daftar = perPesanan.get(o.external_order_id!) ?? []
    let estimasiPesanan = 0
    if (daftar.length === 0) {
      estimasiPesanan = estimasiBiayaXendit(Number(o.total_amount), null, o.created_at)
    } else {
      for (const b of daftar) {
        if (b.biayaMdr != null && b.biayaProses != null) total += Number(b.biayaMdr) + Number(b.biayaProses)
        else estimasiPesanan += estimasiBiayaXendit(b.nominal, b.channel, b.dibayarAt)
      }
    }
    if (estimasiPesanan > 0) {
      total += estimasiPesanan
      estimasi += estimasiPesanan
      jumlahPesananEstimasi++
    }
  }
  return { total, estimasi, jumlahPesananEstimasi }
}

/** Rentang data Xendit yang biayanya sudah dari file Balance History (seperti "Periode" settlement food apps). */
export type CakupanXendit = { periode: string; diunggah: string }

export const CAKUPAN_XENDIT_KOSONG: CakupanXendit = { periode: '', diunggah: '' }

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const keWib = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000)
const tanggalWib = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`

/** Periode = tanggal bayar (WIB) pertama s.d. terakhir; diunggah = waktu impor file terakhir. */
export function ringkasCakupanXendit(rows: { dibayarAt: string; diimporAt: string | null }[]): CakupanXendit {
  if (rows.length === 0) return CAKUPAN_XENDIT_KOSONG
  const bayar = rows.map((r) => Date.parse(r.dibayarAt)).sort((x, y) => x - y)
  const dari = tanggalWib(keWib(new Date(bayar[0]).toISOString()))
  const sampai = tanggalWib(keWib(new Date(bayar[bayar.length - 1]).toISOString()))
  const impor = rows.map((r) => (r.diimporAt ? Date.parse(r.diimporAt) : NaN)).filter((x) => !Number.isNaN(x))
  let diunggah = ''
  if (impor.length) {
    const d = keWib(new Date(Math.max(...impor)).toISOString())
    diunggah = `${tanggalWib(d)}, ${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')} WIB`
  }
  return { periode: dari === sampai ? dari : `${dari} - ${sampai}`, diunggah }
}

/** Objek analytics BARU (yang lama milik cache laporan dan dipakai bersama antar pemanggil). Rumus = compute.ts. */
export function terapkanBiayaKeAnalytics<A extends { grossRevenue: number; totalHPP: number; totalAdminFee: number }>(
  a: A,
  h: HasilBiayaXendit,
  cakupan: CakupanXendit = CAKUPAN_XENDIT_KOSONG,
): A & {
  biayaXendit: number; biayaXenditEstimasi: number; jumlahPesananEstimasiXendit: number
  biayaXenditPeriode: string; biayaXenditDiunggah: string
  netDisbursement: number; realGrossProfit: number
} {
  const totalAdminFee = a.totalAdminFee + h.total
  const netDisbursement = Math.max(0, a.grossRevenue - totalAdminFee)
  return {
    ...a,
    totalAdminFee,
    netDisbursement,
    realGrossProfit: Math.max(0, netDisbursement - a.totalHPP),
    biayaXendit: h.total,
    biayaXenditEstimasi: h.estimasi,
    jumlahPesananEstimasiXendit: h.jumlahPesananEstimasi,
    biayaXenditPeriode: cakupan.periode,
    biayaXenditDiunggah: cakupan.diunggah,
  }
}

/**
 * Pembayaran penjualan pada rentang laporan yang biayanya sudah terisi dari file (biaya_proses
 * bukan NULL). Dipanggil hanya sesudah muatBiayaPembayaran memastikan hak baca.
 */
export async function muatCakupanXendit(supabase: any, from: string, to: string): Promise<CakupanXendit> {
  const dari = new Date(Date.parse(`${from}T00:00:00+07:00`)).toISOString()
  const sampai = new Date(Date.parse(`${to}T23:59:59+07:00`)).toISOString()
  const rows: { dibayarAt: string; diimporAt: string | null }[] = []
  for (let mulai = 0; ; mulai += 1000) {
    const { data, error } = await supabase.from('xendit_pembayaran')
      .select('xendit_id, dibayar_at, diimpor_at')
      .not('biaya_proses', 'is', null).eq('bukan_penjualan', false)
      .gte('dibayar_at', dari).lte('dibayar_at', sampai)
      .order('xendit_id', { ascending: true }).range(mulai, mulai + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) rows.push({ dibayarAt: r.dibayar_at, diimporAt: r.diimpor_at })
    if (!data || data.length < 1000) break
  }
  return ringkasCakupanXendit(rows)
}

/**
 * Biaya pembayaran Xendit milik pesanan website tertentu, lewat klien pemanggil (aturan akses
 * database berlaku). null = pemanggil tidak berhak membaca data Xendit.
 */
export async function muatBiayaPembayaran(supabase: any, externalIds: string[]): Promise<BiayaPembayaran[] | null> {
  const { data: boleh, error: errBoleh } = await supabase.rpc('boleh_baca_xendit')
  if (errBoleh) throw new Error(errBoleh.message)
  if (!boleh) return null
  const hasil: BiayaPembayaran[] = []
  for (let i = 0; i < externalIds.length; i += 200) {
    const { data, error } = await supabase.from('xendit_pembayaran')
      .select('external_order_id, nominal, channel, dibayar_at, biaya_mdr, biaya_proses, bukan_penjualan')
      .in('external_order_id', externalIds.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      hasil.push({
        externalOrderId: r.external_order_id, nominal: Number(r.nominal), channel: r.channel, dibayarAt: r.dibayar_at,
        biayaMdr: r.biaya_mdr == null ? null : Number(r.biaya_mdr),
        biayaProses: r.biaya_proses == null ? null : Number(r.biaya_proses),
        bukanPenjualan: !!r.bukan_penjualan,
      })
    }
  }
  return hasil
}
