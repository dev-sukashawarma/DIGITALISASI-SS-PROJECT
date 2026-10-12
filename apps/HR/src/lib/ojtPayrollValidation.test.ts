import { describe, it, expect } from 'vitest'
import {
  isOjtStaff,
  calculateOjtBasicSalary,
  buildOjtSalaryNote,
} from './ojtPayrollValidation'

describe('ojtPayrollValidation', () => {
  describe('isOjtStaff', () => {
    it('returns true when onboarding_stage is ojt', () => {
      expect(isOjtStaff({ onboarding_stage: 'ojt' })).toBe(true)
      expect(isOjtStaff({ onboarding_stage: 'ojt', sub_role: 'crew_trainee' })).toBe(true)
      expect(isOjtStaff({ onboarding_stage: 'ojt', contract_type: 'contract' })).toBe(true)
    })

    it('returns true when contract_type is intern and not regular/graduated', () => {
      expect(isOjtStaff({ contract_type: 'intern' })).toBe(true)
    })

    it('returns false for training_7_days, regular, graduated, or failed', () => {
      expect(isOjtStaff({ onboarding_stage: 'training_7_days', sub_role: 'crew_trainee' })).toBe(false)
      expect(isOjtStaff({ onboarding_stage: 'regular' })).toBe(false)
      expect(isOjtStaff({ onboarding_stage: 'graduated' })).toBe(false)
      expect(isOjtStaff({ onboarding_stage: 'failed' })).toBe(false)
      expect(isOjtStaff(null)).toBe(false)
      expect(isOjtStaff(undefined)).toBe(false)
    })
  })

  describe('calculateOjtBasicSalary', () => {
    it('returns 0 for 0 or negative attendance days', () => {
      expect(calculateOjtBasicSalary(0)).toBe(0)
      expect(calculateOjtBasicSalary(-1)).toBe(0)
    })

    it('correctly calculates 26 days as 2,000,000', () => {
      expect(calculateOjtBasicSalary(26)).toBe(2_000_000)
    })

    it('correctly calculates 1 day prorata', () => {
      // 2,000,000 / 26 = 76923.0769... -> rounded to 76923
      expect(calculateOjtBasicSalary(1)).toBe(76923)
    })

    it('correctly calculates 13 days (half month) prorata', () => {
      // 2,000,000 / 26 * 13 = 1,000,000
      expect(calculateOjtBasicSalary(13)).toBe(1_000_000)
    })

    it('correctly calculates 20 days prorata', () => {
      // 2,000,000 / 26 * 20 = 1,538,461.538... -> rounded to 1538462
      expect(calculateOjtBasicSalary(20)).toBe(1538462)
    })

    it('respects custom base rate if provided', () => {
      expect(calculateOjtBasicSalary(10, 2_600_000, 26)).toBe(1_000_000)
    })
  })

  describe('buildOjtSalaryNote', () => {
    it('formats readable note with nominal and attendance days', () => {
      const note = buildOjtSalaryNote(15)
      expect(note).toContain('15 hari hadir')
      expect(note).toContain('2.000.000/26')
    })
  })
})
