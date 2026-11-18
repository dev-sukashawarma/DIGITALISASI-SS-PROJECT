import { describe, expect, it } from 'vitest'
import { hitungBiayaXendit, terapkanBiayaKeAnalytics, type BiayaPembayaran } from './biayaXendit'

const ID1 = '22a1629a-373f-4d3c-9c82-17e42740db59'
const ID2 = '33b2730b-484f-4e4d-8d93-28f53851ec60'
const pesanan = (id: string, total: number, createdAt = '2026-10-09T07:00:00Z', sales_source = 'online') =>
  ({ sales_source, external_order_id: id, total_amount: total, created_at: createdAt })
const bayar = (id: string, extra: Partial<BiayaPembayaran> = {}): BiayaPembayaran => ({
  externalOrderId: id, nominal: 50000, channel: 'QRIS', dibayarAt: '2026-10-09T07:01:00Z',
  biayaMdr: 0, biayaProses: 4440, bukanPenjualan: false, ...extra,
})

describe('hitungBiayaXendit', () => {
  it('memakai biaya asli dari file', () => {
    expect(hitungBiayaXendit([pesanan(ID1, 262566)], [bayar(ID1, { nominal: 262566, biayaMdr: 1835 })]))
      .toEqual({ total: 6275, estimasi: 0, jumlahPesananEstimasi: 0 })
  })

  it('bayar dobel = biaya dobel', () => {
    expect(hitungBiayaXendit([pesanan(ID1, 50000)], [bayar(ID1), bayar(ID1)]).total).toBe(8880)
  })

  it('hanya pembayaran yang biayanya belum diketahui yang diestimasi', () => {
    expect(hitungBiayaXendit([pesanan(ID1, 50000)], [bayar(ID1), bayar(ID1, { channel: 'BNI', nominal: 36216, biayaMdr: null })]))
      .toEqual({ total: 18870, estimasi: 14430, jumlahPesananEstimasi: 1 })
  })

  it('tanpa akses / gagal muat → semua estimasi', () => {
    expect(hitungBiayaXendit([pesanan(ID1, 50000)], null)).toEqual({ total: 4440, estimasi: 4440, jumlahPesananEstimasi: 1 })
  })

  it('pembayaran bukan penjualan diabaikan; pesanan non-website tidak kena biaya', () => {
    expect(hitungBiayaXendit(
      [pesanan(ID1, 50000), pesanan(ID2, 50000, '2026-10-09T07:00:00Z', 'pos')],
      [bayar(ID1), bayar(ID1, { bukanPenjualan: true }), bayar(ID2)],
    )).toEqual({ total: 4440, estimasi: 0, jumlahPesananEstimasi: 0 })
  })

  it('pesanan sebelum 1 Okt tanpa pembayaran: MDR saja, tanpa Processing Fee', () => {
    expect(hitungBiayaXendit([pesanan(ID1, 150000, '2026-09-29T05:00:00Z')], []).total).toBe(1048)
  })
})

describe('terapkanBiayaKeAnalytics', () => {
  it('menambah Admin Fee dan memotong kas masuk & laba kotor tanpa mengubah objek asal', () => {
    const asal = { grossRevenue: 100000, totalHPP: 40000, totalAdminFee: 5000 }
    const hasil = terapkanBiayaKeAnalytics(asal, { total: 6275, estimasi: 0, jumlahPesananEstimasi: 0 })
    expect(hasil).toMatchObject({
      totalAdminFee: 11275, netDisbursement: 88725, realGrossProfit: 48725,
      biayaXendit: 6275, biayaXenditEstimasi: 0, jumlahPesananEstimasiXendit: 0,
    })
    expect(asal.totalAdminFee).toBe(5000)
  })
})
