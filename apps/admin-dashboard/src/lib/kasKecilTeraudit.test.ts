import { describe, it, expect } from 'vitest'
import { adalahRekapOpexBulanan, buatSaringanKasKecil } from './kasKecilTeraudit'

describe('adalahRekapOpexBulanan', () => {
  it('mengenali baris rangkuman hasil impor closing', () => {
    expect(adalahRekapOpexBulanan('OPEX Agustus 2026 - Bahan Baku (Petty Cash)')).toBe(true)
    expect(adalahRekapOpexBulanan('OPEX Agustus 2026 - Operasional Outlet')).toBe(true)
    expect(adalahRekapOpexBulanan('opex september 2026 - Transport & Logistik Cabang')).toBe(true)
  })

  it('menolak biaya satuan biasa (kasus nyata September 2026)', () => {
    for (const d of ['Banner Pamulang', 'Lalamove Cileungsi', 'Refund Kelebihan Pembayaran Cileungsi',
      'Brosur Pamulang', 'Cetak Menu Dramaga', 'OPEX tambahan', '', null, undefined]) {
      expect(adalahRekapOpexBulanan(d)).toBe(false)
    }
  })
})

describe('buatSaringanKasKecil', () => {
  const A = 'outlet-a'
  const B = 'outlet-b'

  it('biaya satuan di expenses TIDAK membuang kas kecil outlet itu', () => {
    const simpan = buatSaringanKasKecil([
      { outlet_id: A, description: 'Banner Pamulang', expense_date: '2026-09-05' },
    ])
    expect(simpan({ outlet_id: A, expense_date: '2026-09-10' })).toBe(true)
  })

  it('rangkuman bulanan membuang kas kecil outlet itu di bulan yang sama saja', () => {
    const simpan = buatSaringanKasKecil([
      { outlet_id: A, description: 'OPEX Agustus 2026 - Operasional Outlet', expense_date: '2026-08-01' },
    ])
    expect(simpan({ outlet_id: A, expense_date: '2026-08-20' })).toBe(false)
    expect(simpan({ outlet_id: A, expense_date: '2026-09-02' })).toBe(true) // bulan lain
    expect(simpan({ outlet_id: B, expense_date: '2026-08-20' })).toBe(true) // outlet lain
  })

  it('kas kecil tanpa outlet selalu disimpan', () => {
    const simpan = buatSaringanKasKecil([])
    expect(simpan({ outlet_id: null, expense_date: '2026-09-01' })).toBe(true)
  })
})
