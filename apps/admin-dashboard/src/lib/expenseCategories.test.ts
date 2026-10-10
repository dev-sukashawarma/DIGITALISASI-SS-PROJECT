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
