import { describe, expect, it } from 'vitest'
import { withWasteSlice, WASTE_SLICE_KEY } from './expenseBreakdown'

const CATEGORIES = [
  { name: 'Gaji Crew Outlet', value: 30_000_000, color: '#701604', categoryKey: 'gaji_crew_outlet' },
  { name: 'Biaya Sewa Outlet', value: 12_000_000, color: '#d97706', categoryKey: 'sewa_outlet' },
  { name: 'PLN', value: 4_000_000, color: '#0a7d2c', categoryKey: 'pln' },
]

describe('withWasteSlice', () => {
  it('menambahkan waste sebagai satu irisan, tepat satu kali', () => {
    const out = withWasteSlice(CATEGORIES, 8_000_000, true)
    const wasteSlices = out.filter((s) => s.categoryKey === WASTE_SLICE_KEY)
    expect(wasteSlices).toHaveLength(1)
    expect(wasteSlices[0].value).toBe(8_000_000)
  })

  it('menempatkan waste sesuai besarnya, bukan selalu di ujung', () => {
    const out = withWasteSlice(CATEGORIES, 20_000_000, true)
    expect(out.map((s) => s.categoryKey)).toEqual([
      'gaji_crew_outlet',
      WASTE_SLICE_KEY,
      'sewa_outlet',
      'pln',
    ])
  })

  it('tidak menambah apa pun saat waste tak ikut dihitung', () => {
    expect(withWasteSlice(CATEGORIES, 8_000_000, false)).toEqual(CATEGORIES)
  })

  it('tidak menambah irisan kosong saat waste nol', () => {
    const out = withWasteSlice(CATEGORIES, 0, true)
    expect(out.some((s) => s.categoryKey === WASTE_SLICE_KEY)).toBe(false)
  })

  it('jumlah seluruh irisan = biaya manual + waste', () => {
    const manual = CATEGORIES.reduce((s, c) => s + c.value, 0)
    const out = withWasteSlice(CATEGORIES, 8_000_000, true)
    expect(out.reduce((s, c) => s + c.value, 0)).toBe(manual + 8_000_000)
  })

  it('tidak mengubah array masukan', () => {
    const before = CATEGORIES.map((c) => ({ ...c }))
    withWasteSlice(CATEGORIES, 8_000_000, true)
    expect(CATEGORIES).toEqual(before)
  })

  it('kunci irisan waste bukan kategori expenses yang sah', () => {
    // Penjaga: kalau suatu saat ada yang menulis irisan ini balik ke tabel
    // expenses, kuncinya harus jelas-jelas bukan kategori yang valid.
    expect(WASTE_SLICE_KEY.startsWith('__')).toBe(true)
  })
})
