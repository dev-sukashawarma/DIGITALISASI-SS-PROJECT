import { describe, it, expect } from 'vitest'
import { summarizeBalances, countPendingApproval } from './cashSummary'

describe('summarizeBalances', () => {
  it('memisahkan saldo bank vs cash dan menjumlah total', () => {
    const s = summarizeBalances([
      { kind: 'bank', saldo: 1_000_000 },
      { kind: 'bank', saldo: 500_000 },
      { kind: 'cash', saldo: 250_000 },
    ])
    expect(s.totalBank).toBe(1_500_000)
    expect(s.totalCash).toBe(250_000)
    expect(s.total).toBe(1_750_000)
  })

  it('menangani saldo negatif (kas keluar melebihi masuk)', () => {
    const s = summarizeBalances([
      { kind: 'bank', saldo: -100_000 },
      { kind: 'cash', saldo: -50_000 },
    ])
    expect(s.totalBank).toBe(-100_000)
    expect(s.totalCash).toBe(-50_000)
    expect(s.total).toBe(-150_000)
  })

  it('mengembalikan nol untuk daftar kosong', () => {
    expect(summarizeBalances([])).toEqual({ totalBank: 0, totalCash: 0, total: 0 })
  })
})

describe('countPendingApproval', () => {
  it('hanya menghitung status pending_approval', () => {
    const n = countPendingApproval([
      { status: 'pending_approval' },
      { status: 'pending_approval' },
      { status: 'approved' },
      { status: 'reconciled' },
      { status: 'rejected' },
    ])
    expect(n).toBe(2)
  })
})
