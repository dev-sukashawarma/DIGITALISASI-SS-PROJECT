import { describe, it, expect } from 'vitest'
import {
  AMBANG_MENDEKATI_BATAS_PERSEN,
  LANGKAH_PEMBULATAN_PERSEN,
  PERSEN_TAMPIL_MAKS,
  bulatkanPersenBudget,
  totalRupiahEstimasi,
  ringkasBudgetKeranjang,
  susunHasilEstimasi,
} from './estimasiKeranjang'

describe('bulatkanPersenBudget', () => {
  it('membulatkan ke kelipatan 5 terdekat', () => {
    expect(LANGKAH_PEMBULATAN_PERSEN).toBe(5)
    expect(bulatkanPersenBudget(0)).toBe(0)
    expect(bulatkanPersenBudget(2.4)).toBe(0)
    expect(bulatkanPersenBudget(2.5)).toBe(5)
    expect(bulatkanPersenBudget(43.7)).toBe(45)
    expect(bulatkanPersenBudget(101)).toBe(100)
    expect(bulatkanPersenBudget(137.4)).toBe(135)
  })

  it('tidak pernah negatif dan tahan NaN', () => {
    expect(bulatkanPersenBudget(-12)).toBe(0)
    expect(bulatkanPersenBudget(Number.NaN)).toBe(0)
  })
})

describe('ringkasBudgetKeranjang', () => {
  const base = { hasConfig: true, nominal: 1_000_000, terpakai: 0 }

  it('belum_diatur tanpa persen bila outlet belum punya konfigurasi budget', () => {
    expect(ringkasBudgetKeranjang({ ...base, hasConfig: false }, 50_000)).toEqual({
      status: 'belum_diatur',
      persenSetelah: null,
    })
  })

  it('melebihi tanpa persen bila plafon 0 (salah konfigurasi)', () => {
    expect(ringkasBudgetKeranjang({ ...base, nominal: 0 }, 1)).toEqual({
      status: 'melebihi',
      persenSetelah: null,
    })
  })

  it('cukup bila terpakai + keranjang di bawah ambang mendekati', () => {
    expect(ringkasBudgetKeranjang({ ...base, terpakai: 500_000 }, 100_000)).toEqual({
      status: 'cukup',
      persenSetelah: 60,
    })
  })

  it('mendekati mulai ambang 80% (setelah dibulatkan)', () => {
    expect(AMBANG_MENDEKATI_BATAS_PERSEN).toBe(80)
    expect(ringkasBudgetKeranjang({ ...base, terpakai: 700_000 }, 100_000)).toEqual({
      status: 'mendekati',
      persenSetelah: 80,
    })
    // 77,5% dibulatkan ke 80% -> ikut "mendekati", konsisten dengan angka yang tampil
    expect(ringkasBudgetKeranjang({ ...base, terpakai: 775_000 }, 0).status).toBe('mendekati')
  })

  it('melebihi hanya bila persen yang dibulatkan > 100, dan persen ditahan di 100', () => {
    expect(PERSEN_TAMPIL_MAKS).toBe(100)
    expect(ringkasBudgetKeranjang({ ...base, terpakai: 900_000 }, 200_000)).toEqual({
      status: 'melebihi',
      persenSetelah: 100,
    })
    // qty raksasa tidak menambah informasi: tetap 100 + melebihi
    expect(ringkasBudgetKeranjang({ ...base, terpakai: 0 }, 987_654_321)).toEqual({
      status: 'melebihi',
      persenSetelah: 100,
    })
    // 101% -> 100% -> masih "mendekati": status selalu sejalan dengan persen yang tampil
    expect(ringkasBudgetKeranjang({ ...base, terpakai: 1_010_000 }, 0)).toEqual({
      status: 'mendekati',
      persenSetelah: 100,
    })
  })

  it('selisih keranjang yang kecil tidak menggeser persen (tak bisa dipakai menebak harga satu bahan)', () => {
    // 40% vs 41,75%: keduanya tampil 40%.
    const tanpa = ringkasBudgetKeranjang({ ...base, terpakai: 400_000 }, 0)
    const denganSatuBahan = ringkasBudgetKeranjang({ ...base, terpakai: 400_000 }, 17_500)
    expect(denganSatuBahan.persenSetelah).toBe(40)
    expect(denganSatuBahan.persenSetelah).toBe(tanpa.persenSetelah)
  })
})

describe('susunHasilEstimasi', () => {
  const nilai = {
    totalNilai: 250_000,
    itemTanpaHarga: ['bahan-x'],
    kategoriNilai: { DAGING: 200_000, SAYUR: 50_000 },
  }
  const budget = { hasConfig: true, nominal: 1_000_000, terpakai: 400_000 }

  it('pembaca harga menerima rupiah apa adanya', () => {
    expect(susunHasilEstimasi({ bolehLihatHarga: true, nilai, budget: null })).toEqual({
      mode: 'rupiah',
      ...nilai,
    })
  })

  it('role non-pembaca harga tidak menerima angka rupiah apa pun', () => {
    const hasil = susunHasilEstimasi({ bolehLihatHarga: false, nilai, budget })
    expect(hasil).toEqual({
      mode: 'status',
      status: 'cukup',
      persenSetelah: 65,
      itemTanpaHarga: ['bahan-x'],
    })
    // Penjaga regresi: tidak boleh ada kunci yang membawa rupiah.
    expect(Object.keys(hasil).sort()).toEqual(['itemTanpaHarga', 'mode', 'persenSetelah', 'status'])
    expect(JSON.stringify(hasil)).not.toContain('250000')
  })

  it('role non-pembaca harga tanpa budget -> belum_diatur', () => {
    expect(susunHasilEstimasi({ bolehLihatHarga: false, nilai, budget: null })).toEqual({
      mode: 'status',
      status: 'belum_diatur',
      persenSetelah: null,
      itemTanpaHarga: ['bahan-x'],
    })
  })

  it('totalRupiahEstimasi hanya membaca mode rupiah', () => {
    expect(totalRupiahEstimasi(susunHasilEstimasi({ bolehLihatHarga: true, nilai, budget: null }))).toBe(250_000)
    expect(totalRupiahEstimasi(susunHasilEstimasi({ bolehLihatHarga: false, nilai, budget }))).toBe(0)
    expect(totalRupiahEstimasi(null)).toBe(0)
  })

  it('daftar bahan tanpa harga disalin, bukan referensi yang sama', () => {
    const hasil = susunHasilEstimasi({ bolehLihatHarga: false, nilai, budget })
    expect(hasil.itemTanpaHarga).not.toBe(nilai.itemTanpaHarga)
  })
})
