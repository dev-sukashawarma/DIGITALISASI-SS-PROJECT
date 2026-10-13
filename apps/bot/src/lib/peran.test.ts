import { profilBolehUntukPeran, profilUntukKunci, adalahProfil, LABEL_PROFIL } from './peran'

describe('peran → profil yang boleh diajak chat', () => {
  it('developer, owner, admin → ceo, gudang, hrd, finance', () => {
    for (const r of ['developer', 'owner', 'admin']) {
      expect(profilBolehUntukPeran(r)).toEqual(['ceo', 'gudang', 'hrd', 'finance'])
    }
  })
  it('admin_finance → finance', () => {
    expect(profilBolehUntukPeran('admin_finance')).toEqual(['finance'])
  })
  it('role lain & kosong → tidak ada', () => {
    for (const r of ['crew', 'kitchen', 'admin_hr', 'mitra', 'spv', '', null, undefined]) {
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
