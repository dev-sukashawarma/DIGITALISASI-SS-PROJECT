import { describe, it, expect } from 'vitest'
import { adalahJointExpenseDisembunyikan } from './jointExpense'

describe('adalahJointExpenseDisembunyikan', () => {
  it('joint expense Oktober 2026 ke atas disembunyikan (dua ejaan)', () => {
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expense', expense_date: '2026-10-01' })).toBe(true)
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expanse', expense_date: '2026-11-15' })).toBe(true)
  })
  it('Agustus & September tetap dihitung', () => {
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expense', expense_date: '2026-09-30' })).toBe(false)
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expense', expense_date: '2026-08-01' })).toBe(false)
  })
  it('kategori lain tidak tersentuh', () => {
    expect(adalahJointExpenseDisembunyikan({ category: 'pengeluaran_global', expense_date: '2026-10-05' })).toBe(false)
    expect(adalahJointExpenseDisembunyikan(null)).toBe(false)
  })
})
