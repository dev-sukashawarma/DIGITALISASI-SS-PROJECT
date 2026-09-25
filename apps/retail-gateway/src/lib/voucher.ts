/**
 * Aturan voucher aplikasi -- SATU sumber hitungan untuk validate, pembuatan
 * pesanan, dan daftar voucher. Murni: tanpa DB, tanpa jam sistem.
 *
 * `kalimatSyarat` punya salinan identik di
 * apps/admin-dashboard/src/lib/appRetail/voucher.ts -- ubah keduanya bersamaan.
 * Spec: docs/superpowers/specs/2026-09-25-app-retail-tahap3-voucher-design.md
 */
import { MAKS_POTONGAN_PERSEN, type ItemPesanan } from './pricing'
import type { MenuApp } from './catalog'

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
export type KonteksVoucher = {
  outletId: string | null
  sekarang: Date
  jumlahLunasTotal: number
  jumlahLunasPelanggan: number
  pelangganSudahPernahBayar: boolean
  katalog: MenuApp[] | null
}
export type HasilVoucher =
  | { berlaku: true; potongan: number; itemGratis: ItemPesanan[] }
  | { berlaku: false; alasan: string }

export const CATATAN_GRATIS = 'Gratis voucher'

const WIB_MS = 7 * 60 * 60 * 1000
const NAMA_HARI = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function rp(n: number): string {
  return 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function wib(d: Date): Date {
  return new Date(d.getTime() + WIB_MS)
}
/** 1 = Senin ... 7 = Minggu, dalam WIB. */
function hariWib(d: Date): number {
  return ((wib(d).getUTCDay() + 6) % 7) + 1
}
function menitWib(d: Date): number {
  const w = wib(d)
  return w.getUTCHours() * 60 + w.getUTCMinutes()
}
function keMenit(jam: string): number {
  const [h, m] = jam.split(':')
  return Number(h) * 60 + Number(m)
}
function jamTampil(jam: string): string {
  return jam.slice(0, 5).replace(':', '.')
}
function tanggalTampil(iso: string): string {
  const w = wib(new Date(iso))
  return `${w.getUTCDate()} ${NAMA_BULAN[w.getUTCMonth()]}`
}
function dalamJam(v: Voucher, sekarang: Date): boolean {
  if (!v.jam_mulai || !v.jam_selesai) return true
  const m = menitWib(sekarang)
  const a = keMenit(v.jam_mulai)
  const b = keMenit(v.jam_selesai)
  return a <= b ? m >= a && m < b : m >= a || m < b
}

/** Syarat yang tidak butuh keranjang. Urutan = urutan alasan yang ditampilkan. */
function cekSyaratUmum(v: Voucher, k: KonteksVoucher): string | null {
  if (!v.is_active) return 'Voucher sudah tidak aktif'
  const t = k.sekarang.getTime()
  if (v.mulai && t < new Date(v.mulai).getTime()) return `Berlaku mulai ${tanggalTampil(v.mulai)}`
  if (v.selesai && t >= new Date(v.selesai).getTime()) return 'Voucher sudah berakhir'
  if (k.outletId && v.outlet_ids && v.outlet_ids.length > 0 && !v.outlet_ids.includes(k.outletId))
    return 'Tidak berlaku di outlet ini'
  if (v.hari && v.hari.length > 0 && !v.hari.includes(hariWib(k.sekarang)))
    return `Hanya berlaku hari ${[...v.hari].sort().map((h) => NAMA_HARI[h]).join(', ')}`
  if (!dalamJam(v, k.sekarang))
    return `Hanya berlaku pukul ${jamTampil(v.jam_mulai!)}–${jamTampil(v.jam_selesai!)}`
  if (v.khusus_pesanan_pertama && k.pelangganSudahPernahBayar) return 'Khusus pesanan pertama'
  if (v.batas_per_pelanggan != null && k.jumlahLunasPelanggan >= v.batas_per_pelanggan)
    return v.batas_per_pelanggan === 1 ? 'Sudah kamu pakai' : `Sudah kamu pakai ${v.batas_per_pelanggan}×`
  if (v.kuota_total != null && k.jumlahLunasTotal >= v.kuota_total) return 'Kuota voucher sudah habis'
  return null
}

export function terapkanVoucher(v: Voucher, items: ItemPesanan[] | null, k: KonteksVoucher): HasilVoucher {
  const umum = cekSyaratUmum(v, k)
  if (umum) return { berlaku: false, alasan: umum }
  if (items === null || k.katalog === null) return { berlaku: true, potongan: 0, itemGratis: [] }

  // Item gratis selalu disusun ulang oleh server -- yang dikirim klien diabaikan.
  const belanja = items.filter((it) => it.note !== CATATAN_GRATIS)
  const peta = new Map(k.katalog.map((m) => [m.id, m]))
  const subtotalBelanja = belanja.reduce((s, it) => s + it.unit_price * it.quantity, 0)

  if (v.min_belanja != null && subtotalBelanja < v.min_belanja)
    return { berlaku: false, alasan: `Kurang ${rp(v.min_belanja - subtotalBelanja)} lagi` }

  const adaFilter = (v.menu_ids?.length ?? 0) > 0 || (v.kategori_ids?.length ?? 0) > 0
  const cocok = (it: ItemPesanan) =>
    !adaFilter ||
    (v.menu_ids ?? []).includes(it.menu_item_id) ||
    (v.kategori_ids ?? []).includes(peta.get(it.menu_item_id)?.category_id ?? '')
  const itemCocok = belanja.filter(cocok)
  if (adaFilter && itemCocok.length === 0 && v.jenis !== 'gratis_item' && v.jenis !== 'harga_spesial')
    return { berlaku: false, alasan: 'Tambahkan menu yang termasuk promo ini' }

  let potongan = 0
  let itemGratis: ItemPesanan[] = []
  const gratis = (menuId: string, qty: number): ItemPesanan[] | null => {
    const m = peta.get(menuId)
    if (!m || !m.is_available) return null
    return [{ menu_item_id: m.id, name: m.name, unit_price: m.price, quantity: qty, note: CATATAN_GRATIS }]
  }

  switch (v.jenis) {
    case 'persen': {
      const basis = itemCocok.reduce((s, it) => s + it.unit_price * it.quantity, 0)
      potongan = Math.round((basis * (v.nilai ?? 0)) / 100)
      if (v.maks_potongan != null) potongan = Math.min(potongan, v.maks_potongan)
      break
    }
    case 'nominal': {
      const basis = itemCocok.reduce((s, it) => s + it.unit_price * it.quantity, 0)
      potongan = Math.min(v.nilai ?? 0, basis)
      break
    }
    case 'gratis_item': {
      const g = gratis(v.menu_item_id!, v.gratis_qty ?? 1)
      if (!g) return { berlaku: false, alasan: 'Menu gratis sedang habis' }
      itemGratis = g
      potongan = g[0].unit_price * g[0].quantity
      break
    }
    case 'beli_x_gratis_y': {
      const beliX = v.beli_qty ?? 1
      const jumlahX = itemCocok.reduce((s, it) => s + it.quantity, 0)
      const kelipatan = Math.floor(jumlahX / beliX)
      if (kelipatan === 0) return { berlaku: false, alasan: `Tambahkan ${beliX - jumlahX} lagi menu promo ini` }
      const idY = v.menu_item_id ?? [...itemCocok].sort((a, b) => a.unit_price - b.unit_price)[0].menu_item_id
      const g = gratis(idY, kelipatan * (v.gratis_qty ?? 1))
      if (!g) return { berlaku: false, alasan: 'Menu gratis sedang habis' }
      itemGratis = g
      potongan = g[0].unit_price * g[0].quantity
      break
    }
    case 'harga_spesial': {
      const target = belanja.filter((it) => it.menu_item_id === v.menu_item_id)
      if (target.length === 0) {
        const nama = peta.get(v.menu_item_id!)?.name ?? 'menu promo'
        return { berlaku: false, alasan: `Tambahkan ${nama} ke keranjang` }
      }
      potongan = target.reduce((s, it) => s + Math.max(0, it.unit_price - (v.harga_spesial ?? 0)) * it.quantity, 0)
      break
    }
  }

  const subtotal = subtotalBelanja + itemGratis.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  potongan = Math.min(potongan, subtotal, Math.floor((subtotal * MAKS_POTONGAN_PERSEN) / 100))
  // Selalu bilangan bulat rupiah -- nilai/maks_potongan/harga_spesial pecahan (input admin lama
  // atau data lama) tak boleh lolos ke Xendit (buatQris/buatTagihan menolak nominal non-integer).
  potongan = Math.floor(potongan)
  if (potongan <= 0) return { berlaku: false, alasan: 'Voucher ini tidak memberi potongan untuk keranjangmu' }
  return { berlaku: true, potongan, itemGratis }
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
