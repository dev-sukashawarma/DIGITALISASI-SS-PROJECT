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
})
