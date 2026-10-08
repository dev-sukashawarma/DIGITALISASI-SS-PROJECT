import { describe, it, expect } from 'vitest'
import { buatKonteksMarcomPalsu } from './fixture'
import { hitungAdsBudget } from './adsBudget'

describe('marcom_ads_budget', () => {
  it('menghitung ringkasan budget dan iklan aktif bulan ini', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungAdsBudget(konteks, { bulan: 10, tahun: 2026 })

    // Di mockBudgets:
    // Karanganyar: target 10jt, spent 4.5jt, kol 3/5
    // Solo Baru: target 12jt, spent 8jt, kol 4/6
    // Kartasura: target 8jt, spent 2jt, kol 1/4
    // Total target = 30jt, total spent = 14.5jt, sisa = 15.5jt, persen = 48% (14.5 / 30 * 100)
    expect(hasil.ringkasan_budget).toEqual({
      total_target_budget: 30000000,
      total_spent: 14500000,
      sisa_budget: 15500000,
      persen_terpakai: 48.33,
      total_target_kol: 15,
      total_kol_tercapai: 8,
    })
    expect(hasil.per_outlet).toHaveLength(3)
    expect(hasil.iklan_aktif).toHaveLength(2) // ad-1 (Solo Baru ON) dan ad-2 (Karanganyar ON)
  })

  it('memfilter budget berdasarkan nama outlet', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungAdsBudget(konteks, {
      bulan: 10,
      tahun: 2026,
      outlet: 'Solo Baru',
    })

    expect(hasil.per_outlet).toHaveLength(1)
    expect(hasil.per_outlet[0].outlet_nama).toBe('SS Solo Baru')
    expect(hasil.per_outlet[0].spent).toBe(8000000)
    expect(hasil.iklan_aktif).toHaveLength(1)
    expect(hasil.iklan_aktif[0].outlet_nama).toBe('SS Solo Baru')
  })

  it('menangani bulan tanpa data budget dengan aman', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungAdsBudget(konteks, { bulan: 1, tahun: 2025 })

    expect(hasil.ringkasan_budget.total_target_budget).toBe(0)
    expect(hasil.ringkasan_budget.total_spent).toBe(0)
    expect(hasil.ringkasan_budget.persen_terpakai).toBe(0)
    expect(hasil.per_outlet).toHaveLength(0)
  })
})
