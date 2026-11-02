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

import { adalahHppKolMarcomDisembunyikan } from './jointExpense'

describe('adalahHppKolMarcomDisembunyikan', () => {
  it('HPP Menu KOL Marcom Oktober 2026 ke atas disembunyikan', () => {
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: HPP Menu KOL - Anya] - Menu: Suka Beef (Outlet: MITRA CIBUBUR)',
      expense_date: '2026-10-01'
    })).toBe(true)
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[marcom: hpp menu kol - test]',
      expense_date: '2026-10-25'
    })).toBe(true)
  })

  it('September 2026 dan sebelumnya tetap dihitung (sudah closing)', () => {
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: HPP Menu KOL - Budi] (Outlet: MITRA CICURUG)',
      expense_date: '2026-09-30'
    })).toBe(false)
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: HPP Menu KOL - Budi] (Outlet: MITRA CICURUG)',
      expense_date: '2026-08-15'
    })).toBe(false)
  })

  it('Pengeluaran marcom lain (fee endorsement, ongkir sample) tidak disembunyikan', () => {
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: Fee Endorsement KOL - Anya]',
      expense_date: '2026-10-15'
    })).toBe(false)
    expect(adalahHppKolMarcomDisembunyikan({
      description: 'Beli Bahan Baku',
      expense_date: '2026-10-10'
    })).toBe(false)
    expect(adalahHppKolMarcomDisembunyikan(null)).toBe(false)
  })
})

import { adalahOutletOpexNolOktober2026, adalahOpexCabangNolOktober2026 } from './jointExpense'

describe('Kebijakan Oktober 2026: OPEX Pondok Aren & Paledang = Rp 0', () => {
  const PONDOK_AREN = '48b980da-5a42-4a9b-a952-86ab5db6666a'
  const PALEDANG = '550e8400-e29b-41d4-a716-446655440003'
  const CISEENG = '0ddba13b-fa0e-4bc7-819b-57fe1ec7bf9b'

  it('Pondok Aren dan Paledang pada Oktober 2026 bernilai true (dinolkan)', () => {
    expect(adalahOutletOpexNolOktober2026(PONDOK_AREN, '2026-10-01')).toBe(true)
    expect(adalahOutletOpexNolOktober2026(PALEDANG, '2026-10-31')).toBe(true)
    expect(adalahOutletOpexNolOktober2026(PONDOK_AREN, { year: 2026, month: 10 })).toBe(true)
    expect(adalahOpexCabangNolOktober2026({ outlet_id: PONDOK_AREN, expense_date: '2026-10-15' })).toBe(true)
    expect(adalahOpexCabangNolOktober2026({ outlet_id: PALEDANG, expense_date: '2026-10-28' })).toBe(true)
  })

  it('Bulan selain Oktober 2026 (September & November) tetap dihitung normal (false)', () => {
    expect(adalahOutletOpexNolOktober2026(PONDOK_AREN, '2026-09-30')).toBe(false)
    expect(adalahOutletOpexNolOktober2026(PONDOK_AREN, '2026-11-01')).toBe(false)
    expect(adalahOutletOpexNolOktober2026(PALEDANG, { year: 2026, month: 11 })).toBe(false)
    expect(adalahOpexCabangNolOktober2026({ outlet_id: PALEDANG, expense_date: '2026-11-02' })).toBe(false)
  })

  it('Cabang lain pada Oktober 2026 tetap dihitung normal (false)', () => {
    expect(adalahOutletOpexNolOktober2026(CISEENG, '2026-10-15')).toBe(false)
    expect(adalahOpexCabangNolOktober2026({ outlet_id: CISEENG, expense_date: '2026-10-15' })).toBe(false)
    expect(adalahOpexCabangNolOktober2026(null)).toBe(false)
  })
})
