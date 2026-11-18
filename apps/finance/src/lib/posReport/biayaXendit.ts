/* Biaya Xendit pesanan website untuk kartu Admin Fee Rangkuman Penjualan
 * (spec 2026-11-18-biaya-xendit-rangkuman-penjualan). Dihitung di luar cache hari laporan:
 * biaya asli baru ada setelah file Balance History diunggah, dan hak baca data Xendit
 * berbeda per pemanggil. Pesanan/pembayaran yang biayanya belum diketahui diestimasi. */
import { isPesananWebsite } from '@/lib/xendit/website'
import { estimasiBiayaXendit } from '@/lib/xendit/tarif'

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

/** Objek analytics BARU (yang lama milik cache laporan dan dipakai bersama antar pemanggil). Rumus = compute.ts. */
export function terapkanBiayaKeAnalytics<A extends { grossRevenue: number; totalHPP: number; totalAdminFee: number }>(
  a: A,
  h: HasilBiayaXendit,
): A & { biayaXendit: number; biayaXenditEstimasi: number; jumlahPesananEstimasiXendit: number; netDisbursement: number; realGrossProfit: number } {
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
  }
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
