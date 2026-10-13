import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/authz', () => ({ requireRole: async () => ({}), PERAN_KEUANGAN: ['owner', 'admin'] }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/app/actions/prorataAuxiliary', () => ({ getProrataAuxiliaryDataAction: async () => ({}) }))
vi.mock('@/lib/server/ringkasanPayrollHr', () => ({ hitungRingkasanPayrollHr: async () => null }))

import { jumlahkanOpexLabaRugi } from './opexLabaRugi'

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
