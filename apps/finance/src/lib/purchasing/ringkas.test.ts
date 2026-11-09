import { describe, it, expect } from 'vitest'
import { GRUP_TAB, jumlahPerluTindakan, susunTugas, tabUntuk, type InputTugas } from './ringkas'

const nol: InputTugas = {
  prMenunggu: 0, poDraft: 0, poMenungguApproval: 0, poTerlambat: 0,
  tanpaInvoice: 0, siapDiajukan: 0, ditolakFinance: 0, menungguFinance: 0,
}

describe('tabUntuk', () => {
  it('halaman anggota grup mendapat tab grupnya', () => {
    expect(tabUntuk('/pembelian/permintaan')?.map((t) => t.href)).toEqual(['/pembelian/perlu-dibeli', '/pembelian/permintaan'])
    expect(tabUntuk('/supplier/')?.[0].href).toBe('/supplier')
    expect(tabUntuk('/laporan/pembelian')?.length).toBe(3)
  })

  it('detail PO & halaman lain tidak mendapat tab', () => {
    expect(tabUntuk('/pembelian/abc-123')).toBeNull()
    expect(tabUntuk('/pembelian/new')).toBeNull()
    expect(tabUntuk('/setoran')).toBeNull()
    expect(tabUntuk(null)).toBeNull()
  })

  it('setiap rute hanya muncul di satu grup', () => {
    const semua = GRUP_TAB.flat().map((t) => t.href)
    expect(new Set(semua).size).toBe(semua.length)
  })
})

describe('susunTugas', () => {
  it('semua nol = daftar kosong', () => {
    expect(susunTugas(nol)).toEqual([])
  })

  it('peringatan di atas, info di bawah, nol disembunyikan', () => {
    const t = susunTugas({ ...nol, poMenungguApproval: 2, prMenunggu: 3, ditolakFinance: 1, siapDiajukan: 0 })
    expect(t.map((x) => x.kunci)).toEqual(['ditolak', 'pr', 'approval'])
  })

  it('jumlah perlu tindakan tidak menghitung info', () => {
    const t = susunTugas({ ...nol, poMenungguApproval: 5, menungguFinance: 4, tanpaInvoice: 2, poTerlambat: 1 })
    expect(jumlahPerluTindakan(t)).toBe(3)
  })
})
