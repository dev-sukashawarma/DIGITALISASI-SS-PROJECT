// apps/admin-dashboard/src/lib/wasteBreakdown.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateByOutlet, aggregateByReason, aggregateByBahan, aggregateByDate, type WasteBreakdownRow } from './wasteBreakdown'

const rows: WasteBreakdownRow[] = [
  { outlet_id: 'o1', outlet_name: 'Outlet A', reason: 'Basi / Expired', bahan_baku_id: 'b1', bahan_nama: 'Ayam', tanggal: '2026-07-01', qty: 2, nilai: 20000 },
  { outlet_id: 'o1', outlet_name: 'Outlet A', reason: 'Jatuh / Tumpah', bahan_baku_id: 'b2', bahan_nama: 'Saus', tanggal: '2026-07-01', qty: 1, nilai: 5000 },
  { outlet_id: 'o2', outlet_name: 'Outlet B', reason: 'Basi / Expired', bahan_baku_id: 'b1', bahan_nama: 'Ayam', tanggal: '2026-07-02', qty: 3, nilai: 30000 },
]

describe('aggregateByOutlet', () => {
  it('menjumlahkan nilai per outlet, urut nilai tertinggi', () => {
    const result = aggregateByOutlet(rows)
    expect(result).toEqual([
      { id: 'o1', name: 'Outlet A', nilai: 25000, qty: 3 },
      { id: 'o2', name: 'Outlet B', nilai: 30000, qty: 3 },
    ].sort((a, b) => b.nilai - a.nilai))
  })
})

describe('aggregateByReason', () => {
  it('menjumlahkan nilai per alasan, urut nilai tertinggi', () => {
    const result = aggregateByReason(rows)
    expect(result[0]).toEqual({ reason: 'Basi / Expired', nilai: 50000, qty: 5 })
    expect(result[1]).toEqual({ reason: 'Jatuh / Tumpah', nilai: 5000, qty: 1 })
  })
})

describe('aggregateByBahan', () => {
  it('menjumlahkan nilai per bahan baku, urut nilai tertinggi', () => {
    const result = aggregateByBahan(rows)
    expect(result[0]).toEqual({ id: 'b1', name: 'Ayam', nilai: 50000, qty: 5 })
    expect(result[1]).toEqual({ id: 'b2', name: 'Saus', nilai: 5000, qty: 1 })
  })
})

describe('aggregateByDate', () => {
  it('menjumlahkan nilai per tanggal, urut tanggal ascending', () => {
    const result = aggregateByDate(rows)
    expect(result).toEqual([
      { date: '2026-07-01', nilai: 25000 },
      { date: '2026-07-02', nilai: 30000 },
    ])
  })
})

describe('empty input', () => {
  it('semua fungsi mengembalikan array kosong', () => {
    expect(aggregateByOutlet([])).toEqual([])
    expect(aggregateByReason([])).toEqual([])
    expect(aggregateByBahan([])).toEqual([])
    expect(aggregateByDate([])).toEqual([])
  })
})
