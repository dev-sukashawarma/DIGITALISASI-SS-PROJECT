import { profilUntukPeran, LABEL_PROFIL } from './peran'

describe('peran → profil (fase 1)', () => {
  it('owner, admin, developer → ceo', () => {
    for (const r of ['owner', 'admin', 'developer']) expect(profilUntukPeran(r)).toBe('ceo')
  })
  it('role lain & kosong → null', () => {
    for (const r of ['crew', 'kitchen', 'admin_hr', 'admin_finance', 'mitra', 'spv', '', null, undefined]) {
      expect(profilUntukPeran(r as any)).toBeNull()
    }
  })
  it('label profil', () => {
    expect(LABEL_PROFIL.ceo).toBe('Bot CEO')
  })
})
