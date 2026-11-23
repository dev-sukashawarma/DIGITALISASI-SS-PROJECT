import { describe, expect, it } from 'vitest'
import { saringDraftBasi, bacaDraftOpnameLokal, tanggalWIBDariMs } from './draftOpnameLokal'

describe('tanggalWIBDariMs', () => {
  it('memakai zona WIB (UTC+7), bukan UTC', () => {
    // 2026-11-22 17:30 UTC = 2026-11-23 00:30 WIB
    expect(tanggalWIBDariMs(Date.UTC(2026, 10, 22, 17, 30))).toBe('2026-11-23')
    // 2026-11-22 16:59 UTC = 2026-11-22 23:59 WIB
    expect(tanggalWIBDariMs(Date.UTC(2026, 10, 22, 16, 59))).toBe('2026-11-22')
  })
})

describe('bacaDraftOpnameLokal', () => {
  const HARI_INI = '2026-11-23'
  const pagiIni = Date.UTC(2026, 10, 23, 2, 0) // 09:00 WIB
  const kemarin = Date.UTC(2026, 10, 22, 12, 0) // 19:00 WIB kemarin

  it('tanpa data / JSON rusak = null', () => {
    expect(bacaDraftOpnameLokal(null, HARI_INI)).toBeNull()
    expect(bacaDraftOpnameLokal('{rusak', HARI_INI)).toBeNull()
    expect(bacaDraftOpnameLokal('"teks"', HARI_INI)).toBeNull()
  })

  it('draft bertanggal hari ini dipulihkan', () => {
    const raw = JSON.stringify({ tanggal: HARI_INI, inputs: { A: { besar: '2' } }, notes: 'x', savedAt: pagiIni })
    const d = bacaDraftOpnameLokal(raw, HARI_INI)
    expect(d?.inputs).toEqual({ A: { besar: '2' } })
    expect(d?.notes).toBe('x')
  })

  it('draft kemarin dibuang', () => {
    const raw = JSON.stringify({ tanggal: '2026-11-22', inputs: { A: { besar: '2' } }, savedAt: pagiIni })
    expect(bacaDraftOpnameLokal(raw, HARI_INI)).toBeNull()
  })

  it('draft lama tanpa tanggal: dinilai dari tanggal WIB dibuatAt/savedAt', () => {
    expect(bacaDraftOpnameLokal(JSON.stringify({ savedAt: kemarin, inputs: { A: { besar: '1' } } }), HARI_INI)).toBeNull()
    expect(bacaDraftOpnameLokal(JSON.stringify({ savedAt: pagiIni, inputs: { A: { besar: '1' } } }), HARI_INI)?.inputs).toEqual({ A: { besar: '1' } })
    // dibuatAt (awal pengisian) kemarin menang atas autosave hari ini
    expect(bacaDraftOpnameLokal(JSON.stringify({ dibuatAt: kemarin, savedAt: pagiIni, inputs: {} }), HARI_INI)).toBeNull()
  })

  it('draft tanpa tanggal maupun waktu simpan dibuang (tak bisa dipastikan hari ini)', () => {
    expect(bacaDraftOpnameLokal(JSON.stringify({ inputs: { A: { besar: '1' } } }), HARI_INI)).toBeNull()
  })

  it('isian "" dari versi lama dibersihkan (kosong = belum dihitung)', () => {
    const raw = JSON.stringify({
      tanggal: HARI_INI,
      inputs: { A: { besar: '' }, B: { besar: '0', kecil: '' } },
      targets: { A: { tengah: ' ' } },
      vendor: { C: { v1: { besar: '' }, v2: { besar: '1' } } },
    })
    const d = bacaDraftOpnameLokal(raw, HARI_INI)
    expect(d?.inputs).toEqual({ B: { besar: '0' } })
    expect(d?.targets).toEqual({})
    expect(d?.vendor).toEqual({ C: { v1: {}, v2: { besar: '1' } } })
  })
})

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

  it('tab tetap terbuka melewati ganti satuan: dibuatAt menang atas savedAt autosave terakhir', () => {
    // Isian A diketik jam 1.000 (satuan lama), satuan diganti jam 2.000, autosave terakhir jam 5.000.
    const { dibuang } = saringDraftBasi(
      { dibuatAt: 1_000, savedAt: 5_000, inputs: { A: { kecil: '10' } } },
      [{ id: 'A', nama: 'A', satuan_diganti_at: iso(2_000) }],
    )
    expect(dibuang).toEqual(['A'])
  })

  it('isian yang diketik ulang sesudah penyaringan tidak dibuang lagi pada putaran berikutnya', () => {
    const bahan = [{ id: 'A', nama: 'A', satuan_diganti_at: iso(2_000) }]
    const r1 = saringDraftBasi({ dibuatAt: 1_000, inputs: { A: { kecil: '10' } } }, bahan)
    expect(r1.dibuang).toEqual(['A'])
    expect(r1.draft.batasAt).toBe(2_000)
    const r2 = saringDraftBasi({ ...r1.draft, inputs: { A: { kecil: '60' } } }, bahan)
    expect(r2.dibuang).toEqual([])
  })

  it('daftar bahan basi (belum ada satuan_diganti_at) tidak menaikkan batas', () => {
    const r1 = saringDraftBasi({ dibuatAt: 1_000, inputs: { A: { kecil: '10' } } }, [{ id: 'A', nama: 'A', satuan_diganti_at: null }])
    expect(r1.draft.batasAt ?? 0).toBeLessThan(2_000)
    const r2 = saringDraftBasi(r1.draft, [{ id: 'A', nama: 'A', satuan_diganti_at: iso(2_000) }])
    expect(r2.dibuang).toEqual(['A'])
  })

  it('bahan yang tak ada isiannya tidak dilaporkan dibuang', () => {
    const { dibuang } = saringDraftBasi({ savedAt: 1, inputs: { B: { besar: '1' } } }, [{ id: 'A', nama: 'A', satuan_diganti_at: iso(9) }])
    expect(dibuang).toEqual([])
  })
})
