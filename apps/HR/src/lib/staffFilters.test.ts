import { describe, it, expect } from 'vitest'
import { isTestOrDevStaff, TEST_OUTLET_ID } from './staffFilters'
import { filterStaff } from './filterStaff'
import type { StaffRow, StaffFilterValues } from './types'

describe('staffFilters - isTestOrDevStaff', () => {
  it('returns false for null or undefined staff', () => {
    expect(isTestOrDevStaff(null)).toBe(false)
    expect(isTestOrDevStaff(undefined)).toBe(false)
  })

  it('hides accounts with account_category other than employee', () => {
    expect(isTestOrDevStaff({ name: 'Bot 1', account_category: 'system_bot' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Kiosk 1', account_category: 'kiosk' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Mitra 1', account_category: 'mitra_owner' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Tester 1', account_category: 'testing' })).toBe(true)
  })

  it('hides accounts with non-employee roles even if category is employee or undefined', () => {
    expect(isTestOrDevStaff({ name: 'Kiosk Outlet', role: 'kiosk', account_category: 'employee' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Mitra Franchise', role: 'mitra', account_category: 'employee' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Owner Toko', role: 'owner', account_category: 'employee' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Lead Dev', role: 'developer', account_category: 'employee' })).toBe(true)
  })

  it('hides accounts in test outlet or with test outlet name', () => {
    expect(isTestOrDevStaff({ name: 'Staff A', outlet_id: TEST_OUTLET_ID })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Staff B', outlets: { name: 'Outlet Test' } })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Staff C', outlets: { name: 'Outlet Tes Pusat' } })).toBe(true)
  })

  it('hides devai bot accounts', () => {
    expect(isTestOrDevStaff({ name: 'Devai Bnr', username: 'devai_bnr' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Admin Dev', username: 'admindev' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Some Name', username: 'dev_test' })).toBe(true)
  })

  it('hides test accounts by username or name patterns', () => {
    expect(isTestOrDevStaff({ name: 'Leader Tes', username: 'leader_test' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Test Cicurug', username: 'testcicurug' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'rendy_tes', username: 'rendy_tes' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'tes', username: 'tes' })).toBe(true)
    expect(isTestOrDevStaff({ name: 'Test Finance', username: 'testfinance' })).toBe(true)
  })

  it('allows genuine operational employees', () => {
    const validStaff = {
      name: 'Ahmad Fauzi',
      username: 'ahmad_fauzi',
      role: 'crew',
      account_category: 'employee',
      outlet_id: '11111111-1111-1111-1111-111111111111',
      outlets: { name: 'SUKA SHAWARMA BNR' },
    }
    expect(isTestOrDevStaff(validStaff)).toBe(false)
  })
})

describe('filterStaff', () => {
  const dummyStaff: StaffRow[] = [
    {
      id: '1',
      name: 'Ahmad Fauzi',
      username: 'ahmad_fauzi',
      role: 'crew',
      status: 'active',
      account_category: 'employee',
      outlet_id: 'outlet-1',
      outlets: { name: 'BNR' },
      outlet_ids: ['outlet-1'],
    },
    {
      id: '2',
      name: 'Devai Bnr',
      username: 'devai_bnr',
      role: 'leader',
      status: 'active',
      account_category: 'system_bot',
      outlet_id: 'outlet-1',
      outlets: { name: 'BNR' },
      outlet_ids: ['outlet-1'],
    },
    {
      id: '3',
      name: 'Leader Tes',
      username: 'leader_test',
      role: 'leader',
      status: 'active',
      account_category: 'testing',
      outlet_id: 'outlet-1',
      outlets: { name: 'BNR' },
      outlet_ids: ['outlet-1'],
    },
    {
      id: '4',
      name: 'Kiosk Self Service',
      username: 'kiosk_bnr',
      role: 'kiosk',
      status: 'active',
      account_category: 'kiosk',
      outlet_id: 'outlet-1',
      outlets: { name: 'BNR' },
      outlet_ids: ['outlet-1'],
    },
    {
      id: '5',
      name: 'Bapak Deri',
      username: 'mitra_deri',
      role: 'mitra',
      status: 'active',
      account_category: 'mitra_owner',
      outlet_id: 'outlet-1',
      outlets: { name: 'BNR' },
      outlet_ids: ['outlet-1'],
    },
  ]

  const defaultFilter: StaffFilterValues = {
    search: '',
    outletId: '',
    role: '',
    subRole: '',
    onboardingStage: '',
    status: '',
    category: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  }

  it('filters out bot ai, testing, kiosk, and mitra owner accounts completely', () => {
    const result = filterStaff(dummyStaff, defaultFilter)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Ahmad Fauzi')
  })
})
