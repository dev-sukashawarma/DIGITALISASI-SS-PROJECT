import { idKarakter, tempatkan, rencanaSinkron } from '@/kantor/peta'
import type { Meja } from '@/kantor/keadaan'

const meja = (id: string): Meja => ({ id, nama: id, scope: [], keadaan: 'siaga', alatTerakhir: null, terakhirAt: null })

describe('idKarakter', () => {
  it('stabil & positif', () => {
    expect(idKarakter('667ce866-aaaa')).toBe(idKarakter('667ce866-aaaa'))
    expect(idKarakter('a')).toBeGreaterThan(0)
  })
  it('beda kunci → beda id', () => {
    expect(idKarakter('kunci-1')).not.toBe(idKarakter('kunci-2'))
  })
})

describe('tempatkan', () => {
  it('mempertahankan urutan input & memotong di kapasitas', () => {
    const r = tempatkan([meja('a'), meja('b'), meja('c')], 2, 6)
    expect(r.diKantor.map((p) => p.meja.id)).toEqual(['a', 'b'])
    expect(r.diLuar.map((m) => m.id)).toEqual(['c'])
  })
  it('palet = idKarakter mod jumlahPalet', () => {
    const r = tempatkan([meja('a')], 6, 6)
    expect(r.diKantor[0].palet).toBe(idKarakter('a') % 6)
    expect(r.diKantor[0].agentId).toBe(idKarakter('a'))
  })
  it('nol kunci → kosong', () => {
    expect(tempatkan([], 6, 6)).toEqual({ diKantor: [], diLuar: [] })
  })
  it('jumlahPalet 0 → palet 0', () => {
    expect(tempatkan([meja('a')], 6, 0).diKantor[0].palet).toBe(0)
  })
})

describe('rencanaSinkron', () => {
  it('tambah yang baru, hapus yang hilang, biarkan yang tetap', () => {
    const t = tempatkan([meja('a'), meja('b')], 6, 6).diKantor
    const r = rencanaSinkron([idKarakter('a'), idKarakter('x')], t)
    expect(r.tambah.map((p) => p.meja.id)).toEqual(['b'])
    expect(r.hapus).toEqual([idKarakter('x')])
  })
})
