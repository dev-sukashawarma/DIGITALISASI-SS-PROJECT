import { describe, it, expect } from 'vitest'
import { budgetBadgeVariant } from './budget'

describe('budgetBadgeVariant', () => {
  const base = { hasConfig: true, nominal: 1_000_000, terpakai: 0 }

  it('hidden kalau outlet belum punya config', () => {
    expect(budgetBadgeVariant({ ...base, hasConfig: false })).toBe('hidden')
  })

  it('green kalau terpakai + proyeksi di bawah 80%', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 500_000 }, 100_000)).toBe('green')
  })

  it('orange kalau terpakai + proyeksi 80%-100%', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 700_000 }, 150_000)).toBe('orange')
  })

  it('red kalau terpakai + proyeksi melebihi 100%', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 900_000 }, 200_000)).toBe('red')
  })

  it('red kalau nominal 0 (misconfigured)', () => {
    expect(budgetBadgeVariant({ ...base, nominal: 0 })).toBe('red')
  })

  it('default projectedAdd = 0', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 100_000 })).toBe('green')
  })
})
