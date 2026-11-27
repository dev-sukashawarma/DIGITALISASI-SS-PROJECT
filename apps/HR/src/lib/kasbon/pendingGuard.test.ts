import { describe, expect, it } from 'vitest'
import { filterPendingKasbonsForGuard, type RawPendingKasbonRow } from './pendingGuard'

const makeRow = (overrides: Partial<RawPendingKasbonRow> = {}): RawPendingKasbonRow => ({
  id: 'ka-1',
  staff_id: 'st-1',
  amount: 50000,
  remaining: 50000,
  created_at: '2026-11-11T00:00:00Z',
  reason: 'Keperluan mendadak',
  status: 'active',
  status_hr: 'pending',
  outlet_staff: {
    id: 'st-1',
    name: 'Budi Santoso',
    username: 'budi_crew',
    role: 'crew',
    account_category: 'employee',
    outlet_id: 'out-1',
    outlets: { id: 'out-1', name: 'Outlet Cibubur', slug: 'cibubur' },
  },
  ...overrides,
})

describe('filterPendingKasbonsForGuard', () => {
  it('menyimpan kasbon pending karyawan operasional yang valid', () => {
    const valid = makeRow()
    expect(filterPendingKasbonsForGuard([valid])).toEqual([valid])
  })

  it('menyimpan kasbon jika status_hr null (dianggap pending seperti di RPC)', () => {
    const row = makeRow({ status_hr: null })
    expect(filterPendingKasbonsForGuard([row])).toHaveLength(1)
  })

  it('mengecualikan akun tes seperti "tes" di "outlet tes"', () => {
    const testAccount = makeRow({
      id: 'ka-test',
      staff_id: 'st-test',
      outlet_staff: {
        id: 'st-test',
        name: 'tes',
        username: 'tes',
        role: 'area_manager',
        account_category: 'employee',
        outlet_id: 'out-test',
        outlets: { id: 'out-test', name: 'outlet tes', slug: 'outlet-tes' },
      },
    })
    expect(filterPendingKasbonsForGuard([testAccount])).toEqual([])
  })

  it('mengecualikan kasbon yang outlet-nya outlet tes walau nama staf normal', () => {
    const row = makeRow({
      outlet_staff: {
        id: 'st-2',
        name: 'Karyawan Normal',
        username: 'normal1',
        role: 'crew',
        account_category: 'employee',
        outlet_id: 'out-demo',
        outlets: { id: 'out-demo', name: 'Outlet Demo', slug: 'demo' },
      },
    })
    expect(filterPendingKasbonsForGuard([row])).toEqual([])
  })

  it('mengecualikan kasbon yang sudah paid_off atau staff terhapus', () => {
    const paidOff = makeRow({ id: 'ka-paid', status: 'paid_off' })
    const orphan = makeRow({ id: 'ka-orphan', outlet_staff: null })
    expect(filterPendingKasbonsForGuard([paidOff, orphan])).toEqual([])
  })
})
