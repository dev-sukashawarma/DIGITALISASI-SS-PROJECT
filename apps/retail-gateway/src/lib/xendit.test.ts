import { describe, it, expect } from 'vitest'
import { bacaStatusWebhook } from './xendit'

describe('bacaStatusWebhook', () => {
  it('membaca pembayaran lunas', () => {
    expect(
      bacaStatusWebhook({ external_id: 'ord-123', status: 'PAID', amount: 47000 })
    ).toEqual({ externalId: 'ord-123', status: 'lunas' })
  })

  it('memperlakukan SETTLED sama dengan lunas', () => {
    expect(
      bacaStatusWebhook({ external_id: 'ord-123', status: 'SETTLED', amount: 47000 })
    ).toEqual({ externalId: 'ord-123', status: 'lunas' })
  })

  it('membaca pembayaran kadaluarsa sebagai gagal', () => {
    expect(
      bacaStatusWebhook({ external_id: 'ord-123', status: 'EXPIRED' })
    ).toEqual({ externalId: 'ord-123', status: 'gagal' })
  })

  it('mengembalikan null untuk payload tanpa external_id', () => {
    expect(bacaStatusWebhook({ status: 'PAID' })).toBeNull()
  })

  it('mengembalikan null untuk status yang tidak dikenal', () => {
    expect(bacaStatusWebhook({ external_id: 'ord-123', status: 'PENDING' })).toBeNull()
  })

  it('mengembalikan null untuk payload bukan objek', () => {
    expect(bacaStatusWebhook('bukan objek')).toBeNull()
    expect(bacaStatusWebhook(null)).toBeNull()
  })

  it('membaca bentuk webhook QR Code (reference_id di dalam data)', () => {
    // Bentuk nyata callback `qr.payment` dari Xendit. Berbeda total dari
    // Invoice: id-nya `reference_id`, letaknya di dalam `data`, dan statusnya
    // `SUCCEEDED` bukan `PAID`.
    const hasil = bacaStatusWebhook({
      event: 'qr.payment',
      data: {
        id: 'qrpy_123',
        qr_id: 'qr_123',
        reference_id: '9197d153-2a29-4ca8-a123-a4a6ff8e1cbf',
        channel_code: 'ID_DANA',
        amount: 8000,
        currency: 'IDR',
        status: 'SUCCEEDED',
      },
    })
    expect(hasil).toEqual({
      externalId: '9197d153-2a29-4ca8-a123-a4a6ff8e1cbf',
      status: 'lunas',
    })
  })

  it('bentuk Invoice TETAP dikenali setelah QR ditambahkan', () => {
    // Jalur Invoice dipertahankan sebagai cadangan, dan pesanan lama yang
    // tagihannya masih hidup harus tetap bisa diselesaikan.
    expect(bacaStatusWebhook({ external_id: 'abc', status: 'PAID' })).toEqual({
      externalId: 'abc',
      status: 'lunas',
    })
  })

  it('QR yang kedaluwarsa dibaca sebagai gagal', () => {
    expect(
      bacaStatusWebhook({ event: 'qr.payment', data: { reference_id: 'abc', status: 'INACTIVE' } })
    ).toEqual({ externalId: 'abc', status: 'gagal' })
  })

  it('status QR yang belum final tetap diabaikan', () => {
    expect(
      bacaStatusWebhook({ event: 'qr.payment', data: { reference_id: 'abc', status: 'ACTIVE' } })
    ).toBeNull()
  })

  it('data tanpa reference_id jatuh ke bentuk akar, bukan melempar', () => {
    expect(
      bacaStatusWebhook({ data: { sesuatu: 1 }, external_id: 'abc', status: 'PAID' })
    ).toEqual({ externalId: 'abc', status: 'lunas' })
  })
})
