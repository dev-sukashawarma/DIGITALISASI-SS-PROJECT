import { putuskanGerbang, type DasarGerbang } from '@/lib/gerbang'

const dasar = (ubah: Partial<DasarGerbang> = {}): DasarGerbang => ({
  userId: 'u1', boleh: true, galatRpc: false, status: 'active', ...ubah,
})

describe('putuskanGerbang', () => {
  it('tanpa user → 401', () => {
    expect(putuskanGerbang(dasar({ userId: null }))).toEqual({ ok: false, status: 401 })
  })
  it('owner/admin/developer aktif lolos', () => {
    expect(putuskanGerbang(dasar())).toEqual({ ok: true })
  })
  it('is_owner_or_admin false → 403', () => {
    expect(putuskanGerbang(dasar({ boleh: false }))).toEqual({ ok: false, status: 403 })
  })
  it('galat RPC → 403', () => {
    expect(putuskanGerbang(dasar({ galatRpc: true }))).toEqual({ ok: false, status: 403 })
  })
  it('staf nonaktif → 403', () => {
    expect(putuskanGerbang(dasar({ status: 'inactive' }))).toEqual({ ok: false, status: 403 })
  })
})
