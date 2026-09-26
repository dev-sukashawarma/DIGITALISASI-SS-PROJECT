import { describe, it, expect } from 'vitest'
import { terapkanVoucher, kalimatSyarat, labelNilai, rpRingkas, rp, CATATAN_GRATIS, type Voucher, type KonteksVoucher } from './voucher'
import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'

const menu = (id: string, price: number, extra: Partial<MenuApp> = {}): MenuApp => ({
  id, name: `Menu ${id}`, description: null, price, image_url: null, is_available: true,
  category_id: 'kat-utama', sort_order: null, category_name: null, category_sort_order: null, ...extra,
})
const KATALOG = [menu('A', 30000), menu('B', 20000), menu('M', 10000, { category_id: 'kat-minum' })]
const item = (id: string, price: number, qty: number): ItemPesanan => ({ menu_item_id: id, name: `Menu ${id}`, unit_price: price, quantity: qty })

const dasar = (x: Partial<Voucher>): Voucher => ({
  id: 'v1', nama: 'Uji', deskripsi: null, kode: null, jenis: 'persen', nilai: 10, maks_potongan: null,
  menu_item_id: null, beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null,
  kuota_total: null, batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false,
  outlet_ids: null, hari: null, jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null,
  is_active: true, ...x,
})
// Kamis 2026-09-24 15:00 WIB = 08:00 UTC
const k = (x: Partial<KonteksVoucher> = {}): KonteksVoucher => ({
  outletId: 'o1', sekarang: new Date('2026-09-24T08:00:00Z'), jumlahLunasTotal: 0,
  jumlahLunasPelanggan: 0, pelangganSudahPernahBayar: false, katalog: KATALOG, ...x,
})

describe('terapkanVoucher: jenis', () => {
  it('persen dengan batas maks', () => {
    const h = terapkanVoucher(dasar({ nilai: 20, maks_potongan: 5000 }), [item('A', 30000, 2)], k())
    expect(h).toEqual({ berlaku: true, potongan: 5000, itemGratis: [] })
  })
  it('persen hanya dari item yang cocok kategori', () => {
    const h = terapkanVoucher(dasar({ nilai: 50, kategori_ids: ['kat-minum'] }), [item('A', 30000, 1), item('M', 10000, 2)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 10000 })
  })
  it('nominal tidak melebihi basis', () => {
    const h = terapkanVoucher(dasar({ jenis: 'nominal', nilai: 15000 }), [item('A', 30000, 1)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 15000 })
  })
  it('gratis_item menambah item harga normal dan nilainya jadi potongan', () => {
    const h = terapkanVoucher(dasar({ jenis: 'gratis_item', menu_item_id: 'M', gratis_qty: 1 }), [item('A', 30000, 1)], k())
    expect(h).toEqual({ berlaku: true, potongan: 10000,
      itemGratis: [{ menu_item_id: 'M', name: 'Menu M', unit_price: 10000, quantity: 1, note: CATATAN_GRATIS }] })
  })
  it('gratis_item ditolak bila menu gratis habis', () => {
    const katalog = [menu('A', 30000), menu('M', 10000, { is_available: false })]
    const h = terapkanVoucher(dasar({ jenis: 'gratis_item', menu_item_id: 'M' }), [item('A', 30000, 1)], k({ katalog }))
    expect(h).toEqual({ berlaku: false, alasan: 'Menu gratis sedang habis' })
  })
  it('beli 2 gratis 1 per kelipatan, Y = menu X termurah bila kosong', () => {
    const v = dasar({ jenis: 'beli_x_gratis_y', beli_qty: 2, gratis_qty: 1, menu_ids: ['A', 'B'] })
    const h = terapkanVoucher(v, [item('A', 30000, 3), item('B', 20000, 2)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 40000 })
    expect((h as { itemGratis: ItemPesanan[] }).itemGratis).toEqual([
      { menu_item_id: 'B', name: 'Menu B', unit_price: 20000, quantity: 2, note: CATATAN_GRATIS },
    ])
  })
  it('beli X kurang jumlah memberi alasan', () => {
    const v = dasar({ jenis: 'beli_x_gratis_y', beli_qty: 2, gratis_qty: 1, menu_ids: ['A'] })
    expect(terapkanVoucher(v, [item('A', 30000, 1)], k())).toEqual({ berlaku: false, alasan: 'Tambahkan 1 lagi menu promo ini' })
  })
  it('harga_spesial', () => {
    const v = dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 25000 })
    expect(terapkanVoucher(v, [item('A', 30000, 2)], k())).toMatchObject({ berlaku: true, potongan: 10000 })
  })
  it('harga_spesial tanpa menunya di keranjang', () => {
    const v = dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 25000 })
    expect(terapkanVoucher(v, [item('B', 20000, 1)], k())).toEqual({ berlaku: false, alasan: 'Tambahkan Menu A ke keranjang' })
  })
  it('potongan dijepit 50% subtotal', () => {
    const h = terapkanVoucher(dasar({ jenis: 'nominal', nilai: 25000 }), [item('A', 30000, 1)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 15000 })
  })
  it('item gratis di atas 50% juga dijepit', () => {
    const h = terapkanVoucher(dasar({ jenis: 'gratis_item', menu_item_id: 'A' }), [item('M', 10000, 1)], k())
    // subtotal = 10000 + 30000 gratis = 40000 → maks 20000
    expect(h).toMatchObject({ berlaku: true, potongan: 20000 })
  })
  it('potongan nominal pecahan dibulatkan ke bawah jadi rupiah bulat (I1)', () => {
    // nilai pecahan bisa lolos dari admin lama / data lama; jangan pernah kirim potongan pecahan ke Xendit
    const h = terapkanVoucher(dasar({ jenis: 'nominal', nilai: 10000.5 }), [item('A', 30000, 1)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 10000 })
  })
  it('potongan harga_spesial pecahan dibulatkan ke bawah jadi rupiah bulat (I1)', () => {
    const v = dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 24999.5 })
    // potongan mentah = 30000 - 24999.5 = 5000.5 -> harus jadi 5000, bukan 5000.5
    const h = terapkanVoucher(v, [item('A', 30000, 1)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 5000 })
  })
})

describe('terapkanVoucher: syarat', () => {
  const beli = [item('A', 30000, 1)]
  it('nonaktif', () => expect(terapkanVoucher(dasar({ is_active: false }), beli, k())).toEqual({ berlaku: false, alasan: 'Voucher sudah tidak aktif' }))
  it('belum mulai', () => expect(terapkanVoucher(dasar({ mulai: '2026-10-01T00:00:00+07:00' }), beli, k())).toEqual({ berlaku: false, alasan: 'Berlaku mulai 1 Okt' }))
  it('sudah berakhir', () => expect(terapkanVoucher(dasar({ selesai: '2026-09-24T07:00:00Z' }), beli, k())).toEqual({ berlaku: false, alasan: 'Voucher sudah berakhir' }))
  it('outlet lain', () => expect(terapkanVoucher(dasar({ outlet_ids: ['o2'] }), beli, k())).toEqual({ berlaku: false, alasan: 'Tidak berlaku di outlet ini' }))
  it('hari WIB', () => expect(terapkanVoucher(dasar({ hari: [6, 7] }), beli, k())).toEqual({ berlaku: false, alasan: 'Hanya berlaku hari Sab, Min' }))
  it('jam WIB', () => expect(terapkanVoucher(dasar({ jam_mulai: '17:00:00', jam_selesai: '20:00:00' }), beli, k())).toEqual({ berlaku: false, alasan: 'Hanya berlaku pukul 17.00–20.00' }))
  it('jam lewat tengah malam', () => {
    // 23.30 WIB Kamis = 16:30 UTC
    const v = dasar({ jam_mulai: '22:00:00', jam_selesai: '02:00:00' })
    expect(terapkanVoucher(v, beli, k({ sekarang: new Date('2026-09-24T16:30:00Z') }))).toMatchObject({ berlaku: true })
  })
  it('hari dihitung WIB, bukan UTC', () => {
    // Jumat 01.00 WIB = Kamis 18:00 UTC → harus terbaca Jumat (5)
    const v = dasar({ hari: [5] })
    expect(terapkanVoucher(v, beli, k({ sekarang: new Date('2026-09-24T18:00:00Z') }))).toMatchObject({ berlaku: true })
  })
  it('khusus pesanan pertama', () => expect(terapkanVoucher(dasar({ khusus_pesanan_pertama: true }), beli, k({ pelangganSudahPernahBayar: true }))).toEqual({ berlaku: false, alasan: 'Khusus pesanan pertama' }))
  it('batas per pelanggan', () => expect(terapkanVoucher(dasar({ batas_per_pelanggan: 1 }), beli, k({ jumlahLunasPelanggan: 1 }))).toEqual({ berlaku: false, alasan: 'Sudah kamu pakai' }))
  it('kuota habis', () => expect(terapkanVoucher(dasar({ kuota_total: 5 }), beli, k({ jumlahLunasTotal: 5 }))).toEqual({ berlaku: false, alasan: 'Kuota voucher sudah habis' }))
  it('min belanja', () => expect(terapkanVoucher(dasar({ min_belanja: 42000 }), beli, k())).toEqual({ berlaku: false, alasan: 'Kurang Rp12.000 lagi' }))
  it('menu tertentu tidak ada di keranjang', () => expect(terapkanVoucher(dasar({ menu_ids: ['B'] }), beli, k())).toEqual({ berlaku: false, alasan: 'Tambahkan menu yang termasuk promo ini' }))
  it('tanpa keranjang hanya cek syarat umum', () => {
    expect(terapkanVoucher(dasar({ min_belanja: 999999 }), null, k({ outletId: null, katalog: null }))).toEqual({ berlaku: true, potongan: 0, itemGratis: [] })
  })
  it('potongan nol tidak berlaku', () => {
    const v = dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 40000 })
    expect(terapkanVoucher(v, [item('A', 30000, 1)], k())).toEqual({ berlaku: false, alasan: 'Voucher ini tidak memberi potongan untuk keranjangmu' })
  })
  it('item gratis dari klien tidak dihitung sebagai belanja', () => {
    const v = dasar({ min_belanja: 30000 })
    const h = terapkanVoucher(v, [item('A', 20000, 1), { ...item('B', 20000, 1), note: CATATAN_GRATIS }], k())
    expect(h).toEqual({ berlaku: false, alasan: 'Kurang Rp10.000 lagi' })
  })
})

describe('kalimatSyarat', () => {
  it('menggabungkan jenis dan syarat', () => {
    const v = dasar({ nilai: 20, maks_potongan: 15000, min_belanja: 50000, selesai: '2026-10-31T16:59:59Z', batas_per_pelanggan: 1 })
    expect(kalimatSyarat(v, {})).toBe('Potongan 20% maks Rp15.000 · min. belanja Rp50.000 · maks 1× per pelanggan · s.d. 31 Okt')
  })
  it('gratis item memakai nama menu', () => {
    expect(kalimatSyarat(dasar({ jenis: 'gratis_item', menu_item_id: 'M' }), { M: 'Es Teh' })).toBe('Gratis 1× Es Teh')
  })
  it('rp', () => expect(rp(1234567)).toBe('Rp1.234.567'))
})

describe('labelNilai (potongan kiri kartu voucher)', () => {
  it('rpRingkas', () => {
    expect(rpRingkas(500)).toBe('Rp500')
    expect(rpRingkas(5000)).toBe('Rp5rb')
    expect(rpRingkas(12500)).toBe('Rp12,5rb')
    expect(rpRingkas(1500000)).toBe('Rp1,5jt')
  })
  it('nominal', () => expect(labelNilai(dasar({ jenis: 'nominal', nilai: 5000 }), {})).toEqual({ nilai: 'Rp5rb', sub: 'potongan' }))
  it('persen tanpa maks', () => expect(labelNilai(dasar({ nilai: 20 }), {})).toEqual({ nilai: '20%', sub: 'potongan' }))
  it('persen dengan maks', () => expect(labelNilai(dasar({ nilai: 20, maks_potongan: 15000 }), {})).toEqual({ nilai: '20%', sub: 'maks Rp15rb' }))
  it('gratis item', () => expect(labelNilai(dasar({ jenis: 'gratis_item', menu_item_id: 'M' }), { M: 'Ice Tea' })).toEqual({ nilai: 'Gratis', sub: 'Ice Tea' }))
  it('beli x gratis y', () => expect(labelNilai(dasar({ jenis: 'beli_x_gratis_y', beli_qty: 2, gratis_qty: 1, menu_ids: ['A'] }), {})).toEqual({ nilai: '2+1', sub: 'beli 2 gratis 1' }))
  it('harga spesial', () => expect(labelNilai(dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 25000 }), { A: 'Ayam Jumbo' })).toEqual({ nilai: 'Rp25rb', sub: 'Ayam Jumbo' }))
})
