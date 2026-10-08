import { DOMAIN, LABEL_DOMAIN, adalahDomain } from './domain'

describe('kosakata scope = daftar app', () => {
  it('sama persis dengan CHECK hermes_api_key_scope_check', () => {
    expect([...DOMAIN]).toEqual(['penjualan', 'stok', 'absensi', 'finance', 'mitra', 'app_retail', 'sistem', 'hr_rinci'])
  })
  it('gudang bukan scope lagi', () => {
    expect(adalahDomain('gudang')).toBe(false)
    expect(adalahDomain('stok')).toBe(true)
  })
  it('setiap scope punya label', () => {
    for (const d of DOMAIN) expect(LABEL_DOMAIN[d].length).toBeGreaterThan(2)
  })
})
