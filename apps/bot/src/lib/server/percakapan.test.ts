import { pangkasPercakapan, buatPercakapan, simpanPesan } from './percakapan'

function palsu(ids: string[] = []) {
  const dihapus: string[][] = []
  const disisip: unknown[] = []
  const s = {
    from: vi.fn(() => ({
      select: () => ({ order: async () => ({ data: ids.map((id) => ({ id })), error: null }) }),
      delete: () => ({ in: async (_k: string, v: string[]) => { dihapus.push(v); return { error: null } } }),
      insert: (obj: unknown) => {
        disisip.push(obj)
        return {
          select: () => ({ single: async () => ({ data: { id: 'x', hermes_session_id: 'h' }, error: null }) }),
          then: (res: (v: unknown) => void) => res({ error: null }),
        }
      },
    })),
  }
  return { s, dihapus, disisip }
}

describe('percakapan', () => {
  it('pangkasPercakapan menghapus yang lewat 50', async () => {
    const { s, dihapus } = palsu(Array.from({ length: 52 }, (_, i) => `p${i}`))
    await pangkasPercakapan(s)
    expect(dihapus).toEqual([['p50', 'p51']])
  })
  it('pangkasPercakapan tak menghapus apa pun bila ≤ 50', async () => {
    const { s, dihapus } = palsu(['a', 'b'])
    await pangkasPercakapan(s)
    expect(dihapus).toEqual([])
  })
  it('buatPercakapan memakai judul satu baris', async () => {
    const { s, disisip } = palsu()
    await expect(buatPercakapan(s, 'ceo', 'omzet\nkemarin')).resolves.toEqual({ id: 'x', hermes_session_id: 'h' })
    expect(disisip[0]).toEqual({ profil: 'ceo', judul: 'omzet kemarin' })
  })
  it('simpanPesan menyimpan peran, isi, meta', async () => {
    const { s, disisip } = palsu()
    await simpanPesan(s, 'pc', 'bot', 'halo', { status: 'ok' })
    expect(disisip[0]).toEqual({ percakapan_id: 'pc', peran: 'bot', isi: 'halo', meta: { status: 'ok' } })
  })
})
