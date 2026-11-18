import { describe, it, expect } from 'vitest'
import { gabungXendit } from './xenditLoad'
import type { PembayaranRingkas } from './xenditStatus'

const WEB1 = '22a1629a-373f-4d3c-9c82-17e42740db59'
const WEB2 = '12be03a2-d796-49e3-8845-b1732fc44e65'
const BATAL = '3bd7eeb7-fd79-47a3-8832-07c7b97e92e8'

const pesanan = [
  { id: 'p1', status: 'completed', sales_source: 'online', external_order_id: WEB1, total_amount: 54324, outlet_id: 'cic' },
  { id: 'p2', status: 'completed', sales_source: 'online', external_order_id: WEB2, total_amount: 34204, outlet_id: 'cic' },
  { id: 'p3', status: 'completed', sales_source: 'pos', external_order_id: null, total_amount: 30000, outlet_id: 'cic' },
  { id: 'p4', status: 'cancelled', sales_source: 'online', external_order_id: BATAL, total_amount: 0, outlet_id: 'cic' },
]
const tableRows = pesanan.filter(p => p.status === 'completed')

const bayar = (p: Partial<PembayaranRingkas>): PembayaranRingkas => ({
  xenditId: 'x', refQris: null, nominal: 54324, dibayarAt: '2026-10-09T07:33:41.000Z', caraCocok: 'file_nominal_jam',
  externalOrderId: WEB1, outletId: 'cic', namaPelanggan: null, ringkasanItem: null, bukanPenjualan: false, ...p,
})
const semuaBayar = [
  bayar({ xenditId: 'a' }),
  bayar({ xenditId: 'b', externalOrderId: BATAL, nominal: 34204 }),
  bayar({ xenditId: 'c', externalOrderId: null, outletId: null, nominal: 60360 }),
  bayar({ xenditId: 'd', externalOrderId: 'lain-outlet', outletId: 'emp', nominal: 1 }),
  bayar({ xenditId: 'e', externalOrderId: null, outletId: null, dibayarAt: '2026-11-02T07:00:00.000Z' }), // di luar rentang
]
const dasar = {
  tableRows, semuaPesanan: pesanan, bayar: semuaBayar, from: '2026-10-01', to: '2026-10-31', tampilWebsite: true,
}

describe('gabungXendit', () => {
  it('filter all: semua baris tetap, pesanan website diberi status, non-website tanpa status', () => {
    const r = gabungXendit({ ...dasar, filter: 'all', outletDipilih: 'all', bolehTanpaOutlet: true })
    expect(r.rows).toHaveLength(3)
    expect(r.rows.map(x => x.xendit?.status ?? null)).toEqual(['terverifikasi', 'belum', null])
    expect(r.rows[0].xendit!.bayar.map(b => b.xenditId)).toEqual(['a'])
  })

  it('filter belum: hanya pesanan website ⏳, non-website dibuang', () => {
    const r = gabungXendit({ ...dasar, filter: 'belum', outletDipilih: 'all', bolehTanpaOutlet: true })
    expect(r.rows.map(x => x.id)).toEqual(['p2'])
  })

  it('filter hanya_xendit: tabel kosong, blok berisi batal & yatim dalam rentang', () => {
    const r = gabungXendit({ ...dasar, filter: 'hanya_xendit', outletDipilih: 'all', bolehTanpaOutlet: true })
    expect(r.rows).toHaveLength(0)
    // 'd' tertaut ke pesanan yang tak ada di data laporan → juga "hanya di Xendit"; 'e' di luar rentang.
    expect(r.xenditLain.map(x => [x.jenis, x.bayar.xenditId])).toEqual([['batal', 'b'], ['hanya_xendit', 'c'], ['hanya_xendit', 'd']])
  })

  it('cabang difilter: pembayaran tanpa outlet disembunyikan & dihitung; milik outlet lain dibuang', () => {
    const r = gabungXendit({ ...dasar, filter: 'all', outletDipilih: new Set(['cic']), bolehTanpaOutlet: false })
    expect(r.xenditLain.map(x => x.bayar.xenditId)).toEqual(['b'])
    expect(r.xenditTanpaOutletTersembunyi).toBe(1)
  })

  it('pembayaran tertaut ke pesanan selesai yang tercatat kasir (Pekayon #23) bukan "hanya di Xendit"', () => {
    const PEKAYON = '7e06c3da-3351-4d24-b3df-58c8a2ee3fde'
    const semua = [...pesanan, { id: 'p5', status: 'completed', sales_source: 'pos', external_order_id: PEKAYON, total_amount: 100600, outlet_id: 'cic' }]
    const r = gabungXendit({
      ...dasar, semuaPesanan: semua, bayar: [bayar({ xenditId: 'pk', externalOrderId: PEKAYON, nominal: 100600 })],
      filter: 'all', outletDipilih: 'all', bolehTanpaOutlet: true,
    })
    expect(r.xenditLain).toEqual([])
  })

  it('pesanan yang masih diproses (preparing) dianggap ada di POS, bukan "hanya di Xendit"', () => {
    const PREP = 'aaaaaaaa-1111-4222-8333-444444444444'
    const semua = [...pesanan, { id: 'p6', status: 'preparing', sales_source: 'online', external_order_id: PREP, total_amount: 40240, outlet_id: 'cic' }]
    const r = gabungXendit({
      ...dasar, semuaPesanan: semua, bayar: [bayar({ xenditId: 'pp', externalOrderId: PREP, nominal: 40240 })],
      filter: 'all', outletDipilih: 'all', bolehTanpaOutlet: true,
    })
    expect(r.xenditLain).toEqual([])
  })

  it('sumber tanpa website: tidak menyentuh baris apa pun', () => {
    const r = gabungXendit({ ...dasar, tampilWebsite: false, filter: 'all', outletDipilih: 'all', bolehTanpaOutlet: true })
    expect(r.rows).toBe(tableRows)
    expect(r.xenditLain).toEqual([])
  })
})
