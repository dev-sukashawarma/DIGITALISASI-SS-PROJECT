import { describe, it, expect } from 'vitest'
import {
  statusXendit, toXenditFilter, cocokFilterXendit, pembayaranTanpaPesananSelesai, type PembayaranRingkas,
} from './xenditStatus'

const bayar = (p: Partial<PembayaranRingkas>): PembayaranRingkas => ({
  xenditId: 'x', refQris: null, nominal: 54324, dibayarAt: '2026-10-09T07:50:00.000Z', caraCocok: 'webhook',
  externalOrderId: 'e1', outletId: 'o1', namaPelanggan: null, ringkasanItem: null, bukanPenjualan: false, ...p,
})

describe('statusXendit', () => {
  it('tanpa pembayaran → belum', () => expect(statusXendit({ total_amount: 54324 }, [])).toBe('belum'))
  it('satu pembayaran nominal sama → terverifikasi', () => expect(statusXendit({ total_amount: 54324 }, [bayar({})])).toBe('terverifikasi'))
  it('nominal beda → selisih (Pajajaran 69.000 vs 32.192)', () =>
    expect(statusXendit({ total_amount: 69000 }, [bayar({ nominal: 32192 })])).toBe('selisih'))
  it('dua pembayaran → dobel', () =>
    expect(statusXendit({ total_amount: 54324 }, [bayar({ xenditId: 'a' }), bayar({ xenditId: 'b' })])).toBe('dobel'))
  it('total_amount string dari DB tetap dibandingkan sebagai angka', () =>
    expect(statusXendit({ total_amount: '54324.00' as unknown as number }, [bayar({})])).toBe('terverifikasi'))
})

describe('filter', () => {
  it('nilai tak dikenal → all', () => expect(toXenditFilter('ngawur')).toBe('all'))
  it('selisih mencakup dobel', () => {
    expect(cocokFilterXendit('dobel', 'selisih')).toBe(true)
    expect(cocokFilterXendit('terverifikasi', 'selisih')).toBe(false)
    expect(cocokFilterXendit('belum', 'all')).toBe(true)
    expect(cocokFilterXendit('terverifikasi', 'hanya_xendit')).toBe(false)
  })
})

describe('pembayaranTanpaPesananSelesai', () => {
  it('memisahkan pesanan batal, hanya-di-Xendit, dan membuang bukan penjualan', () => {
    const hasil = pembayaranTanpaPesananSelesai(
      [
        bayar({ xenditId: 'ok', externalOrderId: 'selesai' }),
        bayar({ xenditId: 'batal', externalOrderId: 'cic100' }),
        bayar({ xenditId: 'yatim', externalOrderId: null }),
        bayar({ xenditId: 'asing', externalOrderId: 'tak-dikenal' }),
        bayar({ xenditId: 'pr', externalOrderId: null, bukanPenjualan: true }),
      ],
      new Set(['selesai']),
      new Set(['cic100']),
    )
    expect(hasil.map(h => [h.jenis, h.bayar.xenditId])).toEqual([
      ['batal', 'batal'], ['hanya_xendit', 'yatim'], ['hanya_xendit', 'asing'],
    ])
  })
})
