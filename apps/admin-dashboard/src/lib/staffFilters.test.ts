import { describe, expect, it } from 'vitest'
import { isTestOrDevStaff, TEST_OUTLET_ID } from './staffFilters'

describe('staffFilters — isTestOrDevStaff', () => {
  it('mengidentifikasi staf normal sebagai false', () => {
    expect(
      isTestOrDevStaff({
        id: '123',
        name: 'Ahmad Fauzi',
        username: 'ahmad_fauzi',
        role: 'crew',
        outlet_id: 'out-1',
        outlets: { name: 'Outlet Bantarjati' },
      })
    ).toBe(false)
  })

  it('menyaring akun dengan role developer atau kiosk', () => {
    expect(isTestOrDevStaff({ role: 'developer' })).toBe(true)
    expect(isTestOrDevStaff({ role: 'kiosk' })).toBe(true)
  })

  it('menyaring akun devai bot', () => {
    expect(isTestOrDevStaff({ name: 'devai_subagent_worker' })).toBe(true)
    expect(isTestOrDevStaff({ username: 'devai_lead' })).toBe(true)
    expect(isTestOrDevStaff({ email: 'devai@sukashawarma.id' })).toBe(true)
    expect(isTestOrDevStaff({ username: 'dev_test' })).toBe(true)
  })

  it('menyaring akun dari outlet testing', () => {
    expect(isTestOrDevStaff({ outlet_id: TEST_OUTLET_ID })).toBe(true)
    expect(isTestOrDevStaff({ outlets: { name: 'Outlet Test Bogor' } })).toBe(true)
  })

  it('menyaring username dan nama testing eksplisit', () => {
    expect(isTestOrDevStaff({ username: 'kasir_tes' })).toBe(true)
    expect(isTestOrDevStaff({ username: 'tes_outlet' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'test kitchen crew' })).toBe(true)
  })
})
