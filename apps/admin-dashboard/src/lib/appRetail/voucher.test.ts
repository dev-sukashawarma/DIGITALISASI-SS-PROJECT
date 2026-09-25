import { describe, it, expect } from 'vitest'
import { kalimatSyarat, statusVoucher, periksaVoucher, rp, type Voucher } from './voucher'

const dasar = (x: Partial<Voucher> = {}): Voucher => ({
  id: 'v1', nama: 'Uji', deskripsi: null, kode: null, jenis: 'persen', nilai: 10, maks_potongan: null,
  menu_item_id: null, beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null,
  kuota_total: null, batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false,
  outlet_ids: null, hari: null, jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null,
  is_active: true, ...x,
})

describe('kalimatSyarat (WAJIB identik dengan retail-gateway/src/lib/voucher.test.ts)', () => {
  it('menggabungkan jenis dan syarat', () => {
    const v = dasar({ nilai: 20, maks_potongan: 15000, min_belanja: 50000, selesai: '2026-10-31T16:59:59Z', batas_per_pelanggan: 1 })
    expect(kalimatSyarat(v, {})).toBe('Potongan 20% maks Rp15.000 · min. belanja Rp50.000 · maks 1× per pelanggan · s.d. 31 Okt')
  })
  it('gratis item memakai nama menu', () => {
    expect(kalimatSyarat(dasar({ jenis: 'gratis_item', menu_item_id: 'M' }), { M: 'Es Teh' })).toBe('Gratis 1× Es Teh')
  })
  it('rp', () => expect(rp(1234567)).toBe('Rp1.234.567'))
})

describe('statusVoucher', () => {
  const t = new Date('2026-09-24T08:00:00Z')
  it('nonaktif menang', () => expect(statusVoucher(dasar({ is_active: false }), 0, t)).toBe('nonaktif'))
  it('terjadwal', () => expect(statusVoucher(dasar({ mulai: '2026-10-01T00:00:00Z' }), 0, t)).toBe('terjadwal'))
  it('berakhir', () => expect(statusVoucher(dasar({ selesai: '2026-09-01T00:00:00Z' }), 0, t)).toBe('berakhir'))
  it('kuota habis', () => expect(statusVoucher(dasar({ kuota_total: 3 }), 3, t)).toBe('kuota_habis'))
  it('aktif', () => expect(statusVoucher(dasar(), 0, t)).toBe('aktif'))
})

describe('periksaVoucher', () => {
  const { id: _id, ...i } = dasar()
  it('sah', () => expect(periksaVoucher(i)).toBeNull())
  it('nama kosong', () => expect(periksaVoucher({ ...i, nama: ' ' })).toBe('Nama voucher wajib diisi (maks 60 huruf).'))
  it('persen di luar 1–100', () => expect(periksaVoucher({ ...i, nilai: 120 })).toBe('Persen potongan harus 1–100.'))
  it('gratis item tanpa menu', () => expect(periksaVoucher({ ...i, jenis: 'gratis_item' })).toBe('Pilih menu yang digratiskan.'))
  it('beli x tanpa menu x', () => expect(periksaVoucher({ ...i, jenis: 'beli_x_gratis_y', beli_qty: 2, gratis_qty: 1 })).toBe('Pilih menu yang harus dibeli.'))
  it('harga spesial tanpa harga', () => expect(periksaVoucher({ ...i, jenis: 'harga_spesial', menu_item_id: 'A' })).toBe('Isi menu dan harga spesialnya.'))
  it('kode tidak sah', () => expect(periksaVoucher({ ...i, kode: 'ab' })).toBe('Kode 3–20 huruf/angka tanpa spasi.'))
  it('selesai sebelum mulai', () => expect(periksaVoucher({ ...i, mulai: '2026-10-02T00:00:00Z', selesai: '2026-10-01T00:00:00Z' })).toBe('Tanggal selesai harus setelah tanggal mulai.'))
  it('jam separuh', () => expect(periksaVoucher({ ...i, jam_mulai: '10:00' })).toBe('Isi jam mulai dan jam selesai, atau kosongkan keduanya.'))
})
