import { profilUntukPeran, LABEL_PROFIL } from './peran'

describe('peran → profil (fase 1)', () => {
  it('sementara hanya developer → ceo', () => {
    expect(profilUntukPeran('developer')).toBe('ceo')
  })
  it('role lain (termasuk owner & admin) & kosong → null', () => {
    for (const r of ['owner', 'admin', 'crew', 'kitchen', 'admin_hr', 'admin_finance', 'mitra', 'spv', '', null, undefined]) {
      expect(profilUntukPeran(r as any)).toBeNull()
    }
  })
  it('label profil', () => {
    expect(LABEL_PROFIL.ceo).toBe('Bot CEO')
  })
})
