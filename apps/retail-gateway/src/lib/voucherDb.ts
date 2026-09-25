import type { createRetailClient } from './supabase'
import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'
import { terapkanVoucher, type Voucher, type KonteksVoucher, type HasilVoucher, type JenisVoucher } from './voucher'

type RetailClient = ReturnType<typeof createRetailClient>

export const KOLOM_VOUCHER =
  'id, nama, deskripsi, kode, jenis, nilai, maks_potongan, menu_item_id, beli_qty, gratis_qty, harga_spesial, ' +
  'mulai, selesai, kuota_total, batas_per_pelanggan, min_belanja, khusus_pesanan_pertama, outlet_ids, hari, ' +
  'jam_mulai, jam_selesai, menu_ids, kategori_ids, is_active'

const angka = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x))
const teks = (x: unknown): string | null => (typeof x === 'string' ? x : null)
const daftar = <T>(x: unknown): T[] | null => (Array.isArray(x) ? (x as T[]) : null)

export function normalisasiVoucher(b: Record<string, unknown>): Voucher {
  return {
    id: String(b.id), nama: String(b.nama), deskripsi: teks(b.deskripsi), kode: teks(b.kode),
    jenis: b.jenis as JenisVoucher,
    nilai: angka(b.nilai), maks_potongan: angka(b.maks_potongan), menu_item_id: teks(b.menu_item_id),
    beli_qty: angka(b.beli_qty), gratis_qty: angka(b.gratis_qty), harga_spesial: angka(b.harga_spesial),
    mulai: teks(b.mulai), selesai: teks(b.selesai),
    kuota_total: angka(b.kuota_total), batas_per_pelanggan: angka(b.batas_per_pelanggan), min_belanja: angka(b.min_belanja),
    khusus_pesanan_pertama: b.khusus_pesanan_pertama === true, outlet_ids: daftar<string>(b.outlet_ids),
    hari: daftar<number>(b.hari)?.map(Number) ?? null, jam_mulai: teks(b.jam_mulai), jam_selesai: teks(b.jam_selesai),
    menu_ids: daftar<string>(b.menu_ids), kategori_ids: daftar<string>(b.kategori_ids), is_active: b.is_active === true,
  }
}

export function normalisasiKode(kode: string): string {
  return kode.trim().toUpperCase()
}

export type PilihVoucher = { voucherId?: string | null; kodeVoucher?: string | null }

export async function ambilVoucher(retail: RetailClient, pilih: PilihVoucher): Promise<Voucher | null> {
  let q = retail.from('vouchers').select(KOLOM_VOUCHER)
  q = pilih.voucherId ? q.eq('id', pilih.voucherId) : q.eq('kode', normalisasiKode(pilih.kodeVoucher ?? ''))
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? normalisasiVoucher(data as unknown as Record<string, unknown>) : null
}

async function hitung(p: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await p
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function konteksPelanggan(retail: RetailClient, voucherId: string, customerId: string) {
  const [jumlahLunasTotal, jumlahLunasPelanggan, sudahBayar] = await Promise.all([
    hitung(retail.from('voucher_pemakaian').select('id', { count: 'exact', head: true })
      .eq('voucher_id', voucherId).not('lunas_at', 'is', null)),
    hitung(retail.from('voucher_pemakaian').select('id', { count: 'exact', head: true })
      .eq('voucher_id', voucherId).eq('customer_id', customerId).not('lunas_at', 'is', null)),
    hitung(retail.from('order_drafts').select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('status', 'dibayar')),
  ])
  return { jumlahLunasTotal, jumlahLunasPelanggan, pelangganSudahPernahBayar: sudahBayar > 0 }
}

export type NilaiVoucher =
  | { ada: false }
  | { ada: true; voucher: Voucher | null; hasil: HasilVoucher }

export async function nilaiVoucher(input: {
  retail: RetailClient; pilih: PilihVoucher; customerId: string; outletId: string
  items: ItemPesanan[]; katalog: MenuApp[]; sekarang: Date
}): Promise<NilaiVoucher> {
  const { retail, pilih } = input
  if (!pilih.voucherId && !(pilih.kodeVoucher && pilih.kodeVoucher.trim())) return { ada: false }
  const voucher = await ambilVoucher(retail, pilih)
  if (!voucher) return { ada: true, voucher: null, hasil: { berlaku: false, alasan: 'Kode voucher tidak ditemukan' } }
  const kp = await konteksPelanggan(retail, voucher.id, input.customerId)
  const konteks: KonteksVoucher = { outletId: input.outletId, sekarang: input.sekarang, katalog: input.katalog, ...kp }
  return { ada: true, voucher, hasil: terapkanVoucher(voucher, input.items, konteks) }
}
