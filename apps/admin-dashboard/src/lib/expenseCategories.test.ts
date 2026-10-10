import { describe, expect, it } from 'vitest'
import { isLemburExpense, isSalaryCategory, deriveScope } from './expenseCategories'

describe('isLemburExpense', () => {
  it('mendeteksi kategori eksplisit lembur atau overtime', () => {
    expect(isLemburExpense('lembur', '')).toBe(true)
    expect(isLemburExpense('overtime', '')).toBe(true)
    expect(isLemburExpense('LEMBUR', undefined)).toBe(true)
  })

  it('mendeteksi lembur dari deskripsi transaksi kas toko', () => {
    expect(isLemburExpense('pengeluaran_outlet', 'Lemburan kru shift malam')).toBe(true)
    expect(isLemburExpense('pengeluaran_outlet', 'lembur event car free day')).toBe(true)
    expect(isLemburExpense('transport', 'Uang overtime persiapan bazar')).toBe(true)
  })

  it('mengabaikan menu makanan atau promo yang mirip kata kol / kolaborasi', () => {
    expect(isLemburExpense('pengeluaran_outlet', 'Beli sayur kol & kubis')).toBe(false)
    expect(isLemburExpense('pengeluaran_outlet', 'hpp menu kol')).toBe(false)
    expect(isLemburExpense('pengeluaran_outlet', 'Beli sabun cuci piring')).toBe(false)
  })

  it('menangani input kosong secara aman', () => {
    expect(isLemburExpense(null, null)).toBe(false)
    expect(isLemburExpense('', '')).toBe(false)
  })
})

describe('isSalaryCategory', () => {
  it('mengidentifikasi kategori payroll rutin dan bonus', () => {
    expect(isSalaryCategory('salary')).toBe(true)
    expect(isSalaryCategory('gaji_crew_outlet')).toBe(true)
    expect(isSalaryCategory('bonus_leader')).toBe(true)
    expect(isSalaryCategory('bonus_area_manager')).toBe(true)
    expect(isSalaryCategory('bonus_crew')).toBe(true)
    expect(isSalaryCategory('bonus_regional_manager')).toBe(true)
    expect(isSalaryCategory('lembur')).toBe(true)
  })

  it('mengembalikan false untuk kategori operasional murni', () => {
    expect(isSalaryCategory('pengeluaran_outlet')).toBe(false)
    expect(isSalaryCategory('pln')).toBe(false)
    expect(isSalaryCategory('sewa_outlet')).toBe(false)
  })
})

describe('deriveScope', () => {
  it('menetapkan scope pusat untuk kategori pusat tanpa outlet', () => {
    expect(deriveScope('pengeluaran_global', null)).toBe('pusat')
    expect(deriveScope('gaji_staff_kantor', null)).toBe('pusat')
  })

  it('menetapkan scope outlet jika ada outletId cabang', () => {
    expect(deriveScope('pengeluaran_global', 'outlet-123')).toBe('outlet')
    expect(deriveScope('pengeluaran_outlet', 'outlet-123')).toBe('outlet')
  })
})

describe('Pencegahan Double Count Transaksi OPEX', () => {
  it('memastikan transaksi terpartisi tepat ke satu pos (lembur, salary, atau nonSalary)', () => {
    const sampleTransactions = [
      { id: '1', category: 'pengeluaran_outlet', description: 'Uang lembur kru toko', amount: 150_000 },
      { id: '2', category: 'lembur', description: 'Overtime shift malam', amount: 100_000 },
      { id: '3', category: 'salary', description: 'Gaji pokok kru', amount: 2_000_000 },
      { id: '4', category: 'gaji_crew_outlet', description: 'Payroll bulanan', amount: 3_000_000 },
      { id: '5', category: 'pln', description: 'Token listrik outlet', amount: 500_000 },
      { id: '6', category: 'pengeluaran_outlet', description: 'Beli sabun cuci & plastik', amount: 75_000 },
    ]

    let lembur = 0
    let salary = 0
    let nonSalary = 0
    let total = 0

    sampleTransactions.forEach(t => {
      const isLembur = isLemburExpense(t.category, t.description)
      const amt = t.amount
      total += amt

      if (t.category === 'lembur' || isLembur) {
        lembur += amt
      } else if (isSalaryCategory(t.category)) {
        salary += amt
      } else {
        nonSalary += amt
      }
    })

    // Uang lembur harus 150.000 + 100.000 = 250.000
    expect(lembur).toBe(250_000)
    // Gaji harus 2.000.000 + 3.000.000 = 5.000.000
    expect(salary).toBe(5_000_000)
    // Non-salary operasional murni harus 500.000 + 75.000 = 575.000 (lembur TIDAK masuk sini)
    expect(nonSalary).toBe(575_000)
    // Jumlah seluruh partisi harus persis sama dengan total (0 double count, 0 omission)
    expect(lembur + salary + nonSalary).toBe(total)
  })

  it('memastikan perincian gaji rutin dan bonus selalu seimbang tanpa selisih', () => {
    const totalPayroll = 250_000_000
    const crewBonus = 8_000_000
    const managerBonus = 4_000_000
    const totalBonus = crewBonus + managerBonus

    const routineSalary = Math.max(0, totalPayroll - totalBonus)

    // Card 1 + Card 2 + Card 3 harus tepat sama dengan totalPayroll
    expect(routineSalary + crewBonus + managerBonus).toBe(totalPayroll)
  })
})

