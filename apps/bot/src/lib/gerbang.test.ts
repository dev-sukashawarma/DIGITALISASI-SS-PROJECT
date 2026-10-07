import { putuskanGerbang, type DasarGerbang } from '@/lib/gerbang'

const dasar = (ubah: Partial<DasarGerbang> = {}): DasarGerbang => ({
  userId: 'u1', boleh: true, galatRpc: false, status: 'active', role: 'owner', ...ubah,
})

describe('putuskanGerbang', () => {
  it('tanpa user → 401', () => {
    expect(putuskanGerbang(dasar({ userId: null }), false)).toEqual({ ok: false, status: 401 })
  })
  it('kantor: owner aktif lolos tanpa profil', () => {
    expect(putuskanGerbang(dasar(), false)).toEqual({ ok: true })
  })
  it('kantor: is_owner_or_admin false → 403', () => {
    expect(putuskanGerbang(dasar({ boleh: false }), false)).toEqual({ ok: false, status: 403 })
  })
  it('kantor: galat RPC → 403', () => {
    expect(putuskanGerbang(dasar({ galatRpc: true }), false)).toEqual({ ok: false, status: 403 })
  })
  it('kantor: staf nonaktif → 403', () => {
    expect(putuskanGerbang(dasar({ status: 'inactive' }), false)).toEqual({ ok: false, status: 403 })
  })
  it('chat: owner tanpa profil → 403', () => {
    expect(putuskanGerbang(dasar({ role: 'owner' }), true)).toEqual({ ok: false, status: 403 })
  })
  it('chat: developer berprofil lolos', () => {
    expect(putuskanGerbang(dasar({ role: 'developer' }), true)).toEqual({ ok: true })
  })
})
