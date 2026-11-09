import { describe, expect, it } from 'vitest'
import { saringDraftBasi } from './draftOpnameLokal'

const iso = (ms: number) => new Date(ms).toISOString()

describe('saringDraftBasi', () => {
  const draft = {
    savedAt: 1_000,
    inputs: { A: { kecil: '10' }, B: { besar: '2' } },
    targets: { A: { besar: '1' } },
    vendor: { A: { v1: { besar: '1' } } },
    notes: 'catatan',
  }

  it('membuang isian bahan yang satuannya diganti sesudah draft disimpan', () => {
    const { draft: hasil, dibuang } = saringDraftBasi(draft, [
      { id: 'A', nama: 'BAWANG PUTIH BUBUK', satuan_diganti_at: iso(2_000) },
      { id: 'B', nama: 'AYAM', satuan_diganti_at: null },
    ])
    expect(dibuang).toEqual(['BAWANG PUTIH BUBUK'])
    expect(hasil.inputs).toEqual({ B: { besar: '2' } })
    expect(hasil.targets).toEqual({})
    expect(hasil.vendor).toEqual({})
    expect(hasil.notes).toBe('catatan')
  })

  it('membiarkan bahan yang satuannya diganti sebelum draft disimpan', () => {
    const { dibuang, draft: hasil } = saringDraftBasi(draft, [{ id: 'A', nama: 'A', satuan_diganti_at: iso(500) }])
    expect(dibuang).toEqual([])
    expect(hasil.inputs).toEqual(draft.inputs)
  })

  it('draft lama tanpa savedAt: bahan yang pernah diganti satuannya tetap dibuang', () => {
    const { dibuang } = saringDraftBasi({ inputs: { A: { kecil: '3' } } }, [{ id: 'A', nama: 'A', satuan_diganti_at: iso(1) }])
    expect(dibuang).toEqual(['A'])
  })

  it('bahan yang tak ada isiannya tidak dilaporkan dibuang', () => {
    const { dibuang } = saringDraftBasi({ savedAt: 1, inputs: { B: { besar: '1' } } }, [{ id: 'A', nama: 'A', satuan_diganti_at: iso(9) }])
    expect(dibuang).toEqual([])
  })
})
