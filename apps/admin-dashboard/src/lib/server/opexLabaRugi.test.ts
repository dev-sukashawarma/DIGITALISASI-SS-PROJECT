import { describe, it, expect, vi, beforeEach } from 'vitest'

const ambilPengeluaranMock = vi.fn(async (..._args: any[]) => ({
  expenses: [
    { id: 'e1', outlet_id: 'o-1', outlets: { name: 'Outlet A' }, category: 'listrik', amount: 100000, expense_date: '2026-09-10' },
    { id: 'e2', outlet_id: 'o-2', outlets: { name: 'Outlet B' }, category: 'listrik', amount: 250000, expense_date: '2026-09-10' },
  ],
  pettyCashExpenses: [
    { id: 'p1', outlet_id: 'o-1', outlets: { name: 'Outlet A' }, category: 'operasional', amount: 15000, expense_date: '2026-09-10' },
    { id: 'p2', outlet_id: 'o-2', outlets: { name: 'Outlet B' }, category: 'operasional', amount: 20000, expense_date: '2026-09-10' },
  ],
}))

vi.mock('@/lib/authz', () => ({ requireRole: async () => ({}), PERAN_KEUANGAN: ['owner', 'admin'] }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/pengeluaran/ambilPengeluaran', () => ({ ambilPengeluaranMentah: (...args: any[]) => ambilPengeluaranMock(...args) }))
vi.mock('@/app/actions/prorataAuxiliary', () => ({ getProrataAuxiliaryDataAction: async () => ({}) }))
vi.mock('@/lib/server/ringkasanPayrollHr', () => ({ hitungRingkasanPayrollHr: async () => null }))

import { jumlahkanOpexLabaRugi, hitungOpexLabaRugi, hitungWastePeriode, clearOpexLabaRugiMemo } from './opexLabaRugi'

const baris = (o: Record<string, unknown>) => ({
  id: 'x', outlet_id: 'o-1', outlet_name: 'Outlet A', category: 'listrik', description: '',
  scope: 'outlet', source: 'monthly', amount: 0, ...o,
}) as any

describe('jumlahkanOpexLabaRugi', () => {
  const rows = [
    baris({ amount: 100 }),
    baris({ amount: 30, source: 'petty_cash', category: 'pengeluaran_outlet' }),
    baris({ amount: 7, source: 'petty_cash', category: 'lembur' }),
    baris({ amount: 50, scope: 'pusat', outlet_id: null, outlet_name: null }),
    baris({ amount: 999, outlet_name: 'Outlet Tes' }),
  ]

  it('semua outlet: beban outlet + kantor pusat, outlet tes tidak ikut', () => {
    expect(jumlahkanOpexLabaRugi(rows, true)).toEqual({ outlet: 137, pusat: 50, total: 187 })
  })

  it('satu outlet: beban kantor pusat tidak ikut', () => {
    expect(jumlahkanOpexLabaRugi(rows, false)).toEqual({ outlet: 137, pusat: 0, total: 137 })
  })
})

describe('hitungOpexLabaRugi & hitungWastePeriode memoization', () => {
  const outlets = [
    { id: 'o-1', name: 'Outlet A', type: 'internal', is_active: true },
    { id: 'o-2', name: 'Outlet B', type: 'internal', is_active: true },
  ]

  beforeEach(() => {
    clearOpexLabaRugiMemo()
    ambilPengeluaranMock.mockClear()
  })

  it('berbagi 1 fetch database saat pindah filter dari Semua Outlet ke Outlet A / B', async () => {
    const allRes = await hitungOpexLabaRugi({ from: '2026-09-10', to: '2026-09-10', outletId: 'all' }, outlets, { skipRoleCheck: true })
    const o1Res = await hitungOpexLabaRugi({ from: '2026-09-10', to: '2026-09-10', outletId: 'o-1' }, outlets, { skipRoleCheck: true })
    const o2Res = await hitungOpexLabaRugi({ from: '2026-09-10', to: '2026-09-10', outletId: 'o-2' }, outlets, { skipRoleCheck: true })

    expect(ambilPengeluaranMock).toHaveBeenCalledTimes(1)
    expect(o1Res.total).toBe(115000)
    expect(o2Res.total).toBe(270000)
    expect(allRes.total).toBe(385000)
  })

  it('hitungWastePeriode memakai memo per rentang tanggal saat ganti outlet', async () => {
    const rpcMock = vi.fn(async () => ({
      data: [
        { outlet_id: 'o-1', nilai_waste: 12000 },
        { outlet_id: 'o-2', nilai_waste: 8000 },
      ],
      error: null,
    }))
    const supabaseMock = { rpc: rpcMock }

    const wAll = await hitungWastePeriode(supabaseMock, { from: '2026-09-10', to: '2026-09-10', outletId: 'all' })
    const wO1 = await hitungWastePeriode(supabaseMock, { from: '2026-09-10', to: '2026-09-10', outletId: 'o-1' })
    const wO2 = await hitungWastePeriode(supabaseMock, { from: '2026-09-10', to: '2026-09-10', outletId: 'o-2' })

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(wAll).toBe(20000)
    expect(wO1).toBe(12000)
    expect(wO2).toBe(8000)
  })
})
