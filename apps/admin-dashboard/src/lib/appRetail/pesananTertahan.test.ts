import { describe, it, expect } from 'vitest'
import { tertahan, urutkanPesanan, type PesananApp } from './pesananTertahan'

const p = (ubah: Partial<PesananApp>): PesananApp => ({
  id: 'x', order_number: 1, outlet_id: 'o', status: 'preparing', kitchen_receipt_printed: false,
  created_at: '2026-09-24T08:00:00Z', total_amount: 30000, ...ubah,
})
const jam = (s: string) => new Date(s)

describe('tertahan', () => {
  it('preparing, belum "Mulai Masak", lewat batas -> tertahan', () => {
    expect(tertahan(p({}), jam('2026-09-24T08:11:00Z'), 10)).toBe(true)
  })
  it('belum lewat batas -> tidak', () => {
    expect(tertahan(p({}), jam('2026-09-24T08:09:59Z'), 10)).toBe(false)
  })
  it('sudah "Mulai Masak" (kitchen_receipt_printed) -> tidak', () => {
    expect(tertahan(p({ kitchen_receipt_printed: true }), jam('2026-09-24T09:00:00Z'), 10)).toBe(false)
  })
  it('selesai / batal -> tidak', () => {
    expect(tertahan(p({ status: 'completed' }), jam('2026-09-24T09:00:00Z'), 10)).toBe(false)
    expect(tertahan(p({ status: 'cancelled' }), jam('2026-09-24T09:00:00Z'), 10)).toBe(false)
  })
})

describe('urutkanPesanan', () => {
  it('tertahan di atas, sisanya terbaru dulu', () => {
    const lama = p({ id: 'lama', created_at: '2026-09-24T07:00:00Z' })            // tertahan
    const baru = p({ id: 'baru', created_at: '2026-09-24T08:55:00Z' })            // belum lewat
    const selesai = p({ id: 'selesai', status: 'completed', created_at: '2026-09-24T08:58:00Z' })
    expect(urutkanPesanan([baru, selesai, lama], jam('2026-09-24T09:00:00Z'), 10).map((x) => x.id))
      .toEqual(['lama', 'selesai', 'baru'])
  })
})
