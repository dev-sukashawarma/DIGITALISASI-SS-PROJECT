import { profilBolehUntukPeran, profilUntukKunci, adalahProfil, LABEL_PROFIL } from './peran'

describe('peran → profil yang boleh diajak chat', () => {
  it('sementara hanya developer → ceo & hrd', () => {
    expect(profilBolehUntukPeran('developer')).toEqual(['ceo', 'hrd'])
  })
  it('role lain (termasuk owner & admin) & kosong → tidak ada', () => {
    for (const r of ['owner', 'admin', 'crew', 'kitchen', 'admin_hr', 'admin_finance', 'mitra', 'spv', '', null, undefined]) {
      expect(profilBolehUntukPeran(r as any)).toEqual([])
    }
  })
  it('label profil', () => {
    expect(LABEL_PROFIL.ceo).toBe('Bot CEO')
    expect(LABEL_PROFIL.hrd).toBe('Bot HRD')
  })
})

describe('profilUntukKunci (scope kunci Hermes → profil)', () => {
  it('memuat penjualan → ceo, apa pun scope lainnya', () => {
    expect(profilUntukKunci(['penjualan'])).toBe('ceo')
    expect(profilUntukKunci(['absensi', 'penjualan', 'gudang'])).toBe('ceo')
  })
  it('scope tunggal domain → profil divisi', () => {
    expect(profilUntukKunci(['absensi'])).toBe('hrd')
    expect(profilUntukKunci(['gudang'])).toBe('gudang')
    expect(profilUntukKunci(['finance'])).toBe('finance')
  })
  it('kombinasi tanpa penjualan atau kosong → null', () => {
    expect(profilUntukKunci(['absensi', 'gudang'])).toBeNull()
    expect(profilUntukKunci([])).toBeNull()
  })
})

describe('adalahProfil', () => {
  it('menerima profil dikenal saja', () => {
    expect(adalahProfil('hrd')).toBe(true)
    expect(adalahProfil('root')).toBe(false)
    expect(adalahProfil(undefined)).toBe(false)
  })
})
