import { bolehChat, periksaProfilChat } from '@/lib/server/izinChat'

const env = { HERMES_KEYS: JSON.stringify({ ceo: 'k-ceo' }) }

describe('bolehChat', () => {
  it('role mengizinkan & kunci profil ada → boleh', () => {
    expect(bolehChat('developer', 'ceo', env)).toBe(true)
  })
  it('role mengizinkan tapi kunci profil tidak dikonfigurasi → tidak', () => {
    expect(bolehChat('developer', 'hrd', env)).toBe(false)
  })
  it('role tidak mengizinkan → tidak, walau kunci ada', () => {
    expect(bolehChat('owner', 'ceo', env)).toBe(false)
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
    expect(periksaProfilChat('ceo', 'owner', null, env)).toEqual({ ok: false, status: 403 })
    expect(periksaProfilChat('hrd', 'developer', null, env)).toEqual({ ok: false, status: 403 })
  })
  it('percakapan lama milik profil lain → 409', () => {
    expect(periksaProfilChat('ceo', 'developer', 'hrd', env)).toEqual({ ok: false, status: 409 })
  })
  it('boleh → profil dikembalikan', () => {
    expect(periksaProfilChat('ceo', 'developer', null, env)).toEqual({ ok: true, profil: 'ceo' })
    expect(periksaProfilChat('ceo', 'developer', 'ceo', env)).toEqual({ ok: true, profil: 'ceo' })
  })
})
