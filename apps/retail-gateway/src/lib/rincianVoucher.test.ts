import { describe, it, expect } from 'vitest'
import { rincianDenganVoucher } from './rincianVoucher'

const A = { menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1 }
const G = { menu_item_id: 'M', name: 'M', unit_price: 10000, quantity: 1, note: 'Gratis voucher' }
const v = { id: 'v1', nama: 'Uji' } as any

describe('rincianDenganVoucher', () => {
  it('tanpa voucher = hitungTotal tanpa diskon', () => {
    expect(rincianDenganVoucher([A], { ada: false })).toEqual({
      itemsAkhir: [A], rincian: { subtotal: 30000, discountAmount: 0, total: 30000 }, blok: null })
  })
  it('berlaku: item gratis ditambahkan, potongan jadi discount', () => {
    const r = rincianDenganVoucher([A], { ada: true, voucher: v, hasil: { berlaku: true, potongan: 10000, itemGratis: [G] } })
    expect(r.itemsAkhir).toEqual([A, G])
    expect(r.rincian).toEqual({ subtotal: 40000, discountAmount: 10000, total: 30000 })
    expect(r.blok).toEqual({ id: 'v1', nama: 'Uji', status: 'berlaku', potongan: 10000, item_gratis: [G] })
  })
  it('belum berlaku: harga normal, blok membawa alasan', () => {
    const r = rincianDenganVoucher([A], { ada: true, voucher: v, hasil: { berlaku: false, alasan: 'Kuota voucher sudah habis' } })
    expect(r.rincian.discountAmount).toBe(0)
    expect(r.blok).toEqual({ id: 'v1', nama: 'Uji', status: 'belum', alasan: 'Kuota voucher sudah habis', potongan: 0, item_gratis: [] })
  })
  it('kode tak dikenal', () => {
    const r = rincianDenganVoucher([A], { ada: true, voucher: null, hasil: { berlaku: false, alasan: 'Kode voucher tidak ditemukan' } })
    expect(r.blok).toMatchObject({ id: null, nama: null, status: 'tidak_ada' })
  })
  it('item gratis kiriman klien dibuang', () => {
    expect(rincianDenganVoucher([A, G], { ada: false }).itemsAkhir).toEqual([A])
  })
})
