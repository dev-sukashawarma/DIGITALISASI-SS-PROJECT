import { alasanTanpaChat, bolehChat, periksaProfilChat } from '@/lib/server/izinChat'

const env = { HERMES_KEYS: JSON.stringify({ ceo: 'k-ceo', manager: 'k-manager', review: 'k-review' }) }

describe('bolehChat', () => {
  it('role mengizinkan & kunci profil ada → boleh', () => {
    expect(bolehChat('developer', 'ceo', env)).toBe(true)
    expect(bolehChat('developer', 'manager', env)).toBe(true)
    expect(bolehChat('developer', 'review', env)).toBe(true)
    expect(bolehChat('owner', 'manager', env)).toBe(true)
    expect(bolehChat('area_manager', 'manager', env)).toBe(true)
    expect(bolehChat('marcom', 'review', env)).toBe(true)
  })
  it('role mengizinkan tapi kunci profil tidak dikonfigurasi → tidak', () => {
    expect(bolehChat('developer', 'hrd', env)).toBe(false)
  })
  it('role tidak mengizinkan → tidak, walau kunci ada', () => {
    expect(bolehChat('crew', 'ceo', env)).toBe(false)
    expect(bolehChat('area_manager', 'review', env)).toBe(false)
    expect(bolehChat('marcom', 'manager', env)).toBe(false)
  })
  it('owner & admin mengizinkan & kunci profil ada → boleh', () => {
    expect(bolehChat('owner', 'ceo', env)).toBe(true)
    expect(bolehChat('admin', 'ceo', env)).toBe(true)
    expect(bolehChat('owner', 'review', env)).toBe(true)
    expect(bolehChat('admin', 'manager', env)).toBe(true)
  })
  it('profil null → tidak', () => {
    expect(bolehChat('developer', null, env)).toBe(false)
  })
})

describe('periksaProfilChat', () => {
  it('profil tak dikenal / kosong → 400', () => {
    expect(periksaProfilChat(undefined, 'developer', null, env)).toEqual({ ok: false, status: 400 })
    expect(periksaProfilChat('root', 'developer', null, env)).toEqual({ ok: false, status: 400 })
  })
  it('tidak boleh chat → 403', () => {
    expect(periksaProfilChat('ceo', 'crew', null, env)).toEqual({ ok: false, status: 403 })
    expect(periksaProfilChat('hrd', 'developer', null, env)).toEqual({ ok: false, status: 403 })
  })
  it('percakapan lama milik profil lain → 409', () => {
    expect(periksaProfilChat('ceo', 'developer', 'hrd', env)).toEqual({ ok: false, status: 409 })
  })
  it('boleh → profil dikembalikan', () => {
    expect(periksaProfilChat('ceo', 'developer', null, env)).toEqual({ ok: true, profil: 'ceo' })
    expect(periksaProfilChat('ceo', 'developer', 'ceo', env)).toEqual({ ok: true, profil: 'ceo' })
    expect(periksaProfilChat('manager', 'area_manager', null, env)).toEqual({ ok: true, profil: 'manager' })
    expect(periksaProfilChat('review', 'marcom', null, env)).toEqual({ ok: true, profil: 'review' })
  })
})

describe('alasanTanpaChat', () => {
  it('null bila boleh', () => {
    expect(alasanTanpaChat('developer', 'ceo', env)).toBeNull()
    expect(alasanTanpaChat('area_manager', 'manager', env)).toBeNull()
    expect(alasanTanpaChat('marcom', 'review', env)).toBeNull()
  })
  it('tanpa profil → tanpa_profil', () => {
    expect(alasanTanpaChat('developer', null, env)).toBe('tanpa_profil')
  })
  it('role tidak mengizinkan → peran (diperiksa sebelum kunci)', () => {
    expect(alasanTanpaChat('crew', 'hrd', env)).toBe('peran')
    expect(alasanTanpaChat('marcom', 'manager', env)).toBe('peran')
  })
  it('role boleh tapi kunci tak ada → belum_tersambung', () => {
    expect(alasanTanpaChat('developer', 'hrd', env)).toBe('belum_tersambung')
  })
})
