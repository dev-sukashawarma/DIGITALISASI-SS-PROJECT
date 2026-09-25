/**
 * Salinan identik dari apps/retail-gateway/src/lib/voucher.ts (kalimatSyarat)
 * -- ubah keduanya bersamaan.
 * Spec: docs/superpowers/specs/2026-09-25-app-retail-tahap3-voucher-design.md
 */

export type JenisVoucher = 'persen' | 'nominal' | 'gratis_item' | 'beli_x_gratis_y' | 'harga_spesial'
export type Voucher = {
  id: string; nama: string; deskripsi: string | null; kode: string | null; jenis: JenisVoucher
  nilai: number | null; maks_potongan: number | null; menu_item_id: string | null
  beli_qty: number | null; gratis_qty: number | null; harga_spesial: number | null
  mulai: string | null; selesai: string | null
  kuota_total: number | null; batas_per_pelanggan: number | null; min_belanja: number | null
  khusus_pesanan_pertama: boolean; outlet_ids: string[] | null
  hari: number[] | null; jam_mulai: string | null; jam_selesai: string | null
  menu_ids: string[] | null; kategori_ids: string[] | null; is_active: boolean
}

const WIB_MS = 7 * 60 * 60 * 1000
const NAMA_HARI = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function rp(n: number): string {
  return 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function wib(d: Date): Date {
  return new Date(d.getTime() + WIB_MS)
}

function jamTampil(jam: string): string {
  return jam.slice(0, 5).replace(':', '.')
}

function tanggalTampil(iso: string): string {
  const w = wib(new Date(iso))
  return `${w.getUTCDate()} ${NAMA_BULAN[w.getUTCMonth()]}`
}

/** Kalimat syarat untuk pelanggan & pratinjau admin. Salinan identik di admin. */
export function kalimatSyarat(v: Voucher, namaMenu: Record<string, string>): string {
  const nama = (id: string | null) => (id && namaMenu[id]) || 'menu promo'
  const bagian: string[] = []
  switch (v.jenis) {
    case 'persen':
      bagian.push(`Potongan ${v.nilai}%` + (v.maks_potongan != null ? ` maks ${rp(v.maks_potongan)}` : ''))
      break
    case 'nominal':
      bagian.push(`Potongan ${rp(v.nilai ?? 0)}`)
      break
    case 'gratis_item':
      bagian.push(`Gratis ${v.gratis_qty ?? 1}× ${nama(v.menu_item_id)}`)
      break
    case 'beli_x_gratis_y':
      bagian.push(`Beli ${v.beli_qty} gratis ${v.gratis_qty}` + (v.menu_item_id ? ` ${nama(v.menu_item_id)}` : ''))
      break
    case 'harga_spesial':
      bagian.push(`${nama(v.menu_item_id)} jadi ${rp(v.harga_spesial ?? 0)}`)
      break
  }
  if (v.min_belanja != null) bagian.push(`min. belanja ${rp(v.min_belanja)}`)
  if ((v.menu_ids?.length ?? 0) > 0 || (v.kategori_ids?.length ?? 0) > 0) bagian.push('menu tertentu')
  if (v.khusus_pesanan_pertama) bagian.push('khusus pesanan pertama')
  if (v.batas_per_pelanggan != null) bagian.push(`maks ${v.batas_per_pelanggan}× per pelanggan`)
  if (v.hari && v.hari.length > 0) bagian.push(`hari ${[...v.hari].sort().map((h) => NAMA_HARI[h]).join(', ')}`)
  if (v.jam_mulai && v.jam_selesai) bagian.push(`pukul ${jamTampil(v.jam_mulai)}–${jamTampil(v.jam_selesai)}`)
  if ((v.outlet_ids?.length ?? 0) > 0) bagian.push('outlet tertentu')
  if (v.selesai) bagian.push(`s.d. ${tanggalTampil(v.selesai)}`)
  return bagian.join(' · ')
}

// Admin-specific types and functions

export type StatusVoucher = 'aktif' | 'terjadwal' | 'berakhir' | 'nonaktif' | 'kuota_habis'

export const LABEL_JENIS: Record<JenisVoucher, string> = {
  persen: 'Potongan persen', nominal: 'Potongan Rupiah', gratis_item: 'Gratis item',
  beli_x_gratis_y: 'Beli X gratis Y', harga_spesial: 'Harga spesial menu',
}
export const LABEL_STATUS: Record<StatusVoucher, string> = {
  aktif: 'Aktif', terjadwal: 'Terjadwal', berakhir: 'Berakhir', nonaktif: 'Nonaktif', kuota_habis: 'Kuota habis',
}

export function statusVoucher(v: Voucher, terpakai: number, sekarang: Date): StatusVoucher {
  if (!v.is_active) return 'nonaktif'
  const t = sekarang.getTime()
  if (v.selesai && t >= new Date(v.selesai).getTime()) return 'berakhir'
  if (v.mulai && t < new Date(v.mulai).getTime()) return 'terjadwal'
  if (v.kuota_total != null && terpakai >= v.kuota_total) return 'kuota_habis'
  return 'aktif'
}

export type InputVoucher = Omit<Voucher, 'id'>

/** Cermin CHECK migration 20260925100000 -- ubah keduanya bersamaan. */
export function periksaVoucher(i: InputVoucher): string | null {
  const nama = i.nama.trim()
  if (nama.length < 1 || nama.length > 60) return 'Nama voucher wajib diisi (maks 60 huruf).'
  if (i.deskripsi && i.deskripsi.length > 200) return 'Deskripsi maksimal 200 huruf.'
  if (i.kode !== null && !/^[A-Z0-9]{3,20}$/.test(i.kode)) return 'Kode 3–20 huruf/angka tanpa spasi.'
  switch (i.jenis) {
    case 'persen':
      if (i.nilai == null || i.nilai <= 0 || i.nilai > 100) return 'Persen potongan harus 1–100.'
      break
    case 'nominal':
      if (i.nilai == null || i.nilai <= 0) return 'Nilai potongan harus lebih dari 0.'
      break
    case 'gratis_item':
      if (!i.menu_item_id) return 'Pilih menu yang digratiskan.'
      break
    case 'beli_x_gratis_y':
      if (!i.menu_ids || i.menu_ids.length === 0) return 'Pilih menu yang harus dibeli.'
      if (!i.beli_qty || i.beli_qty < 1 || !i.gratis_qty || i.gratis_qty < 1) return 'Isi jumlah beli dan jumlah gratis (minimal 1).'
      break
    case 'harga_spesial':
      if (!i.menu_item_id || i.harga_spesial == null || i.harga_spesial < 0) return 'Isi menu dan harga spesialnya.'
      break
  }
  if (i.maks_potongan != null && i.maks_potongan <= 0) return 'Maksimal potongan harus lebih dari 0.'
  // Validasi kolom-level CHECK (berlaku untuk semua jenis saat non-null)
  if (i.beli_qty != null && (!Number.isInteger(i.beli_qty) || i.beli_qty < 1)) return 'Jumlah beli minimal 1.'
  if (i.gratis_qty != null && (!Number.isInteger(i.gratis_qty) || i.gratis_qty < 1)) return 'Jumlah gratis minimal 1.'
  if (i.harga_spesial != null && i.harga_spesial < 0) return 'Harga spesial tidak boleh negatif.'
  if (i.hari && i.hari.length > 0) {
    if (!i.hari.every((h) => Number.isInteger(h) && h >= 1 && h <= 7)) return 'Hari tidak sah.'
  }
  if (i.mulai && i.selesai && new Date(i.selesai) <= new Date(i.mulai)) return 'Tanggal selesai harus setelah tanggal mulai.'
  if ((i.jam_mulai === null) !== (i.jam_selesai === null)) return 'Isi jam mulai dan jam selesai, atau kosongkan keduanya.'
  for (const [n, pesan] of [[i.kuota_total, 'Kuota'], [i.batas_per_pelanggan, 'Batas per pelanggan']] as const) {
    if (n != null && (!Number.isInteger(n) || n < 1)) return `${pesan} minimal 1.`
  }
  if (i.min_belanja != null && i.min_belanja < 0) return 'Minimal belanja tidak boleh negatif.'
  return null
}
