import { describe, it, expect } from 'vitest'
import { ringkasHppDinamis, selisihPct, periodeSebelumSnapshot, LABEL_SUMBER, type HppDinamisBahanRow, type HppDinamisMenuRow } from './hppDinamis'

const bahan = (o: Partial<HppDinamisBahanRow>): HppDinamisBahanRow => ({
  bahan_baku_id: 'b', nama_bahan: 'SAPI', satuan: 'Blok', satuan_kecil: 'gram', is_gram: true,
  qty_pemakaian: 100, nilai: 1000, sumber_harga_terakhir: 'kiriman', ref_id_terakhir: null, ref_tanggal_terakhir: null,
  nilai_kiriman: 1000, nilai_drop_ship: null, nilai_master_historis: null, nilai_master_sekarang: null, nilai_tidak_ada: null, ...o,
})
const menu = (o: Partial<HppDinamisMenuRow>): HppDinamisMenuRow => ({
  menu_item_id: 'm', menu_nama: 'Sapi Jumbo', harga_jual: 42000, qty_terjual: 10, punya_resep: true,
  hpp_override_unit: 24000, hpp_override_total: 240000, hpp_teoritis_total: 195640, hpp_teoritis_unit: 19564, ...o,
})

describe('selisihPct', () => {
  it('menghitung persen terhadap acuan', () => { expect(selisihPct(120, 100)).toBe(20) })
  it('null bila acuan nol/negatif', () => { expect(selisihPct(10, 0)).toBeNull(); expect(selisihPct(10, -1)).toBeNull() })
})

describe('periodeSebelumSnapshot', () => {
  it('true sebelum 1 Sep 2026', () => { expect(periodeSebelumSnapshot('2026-08-31')).toBe(true) })
  it('false mulai 1 Sep 2026', () => { expect(periodeSebelumSnapshot('2026-09-01')).toBe(false) })
  it('false bila from kosong', () => {
    expect(periodeSebelumSnapshot('')).toBe(false)
    expect(periodeSebelumSnapshot(null)).toBe(false)
    expect(periodeSebelumSnapshot(undefined)).toBe(false)
  })
})

describe('ringkasHppDinamis', () => {
  it('menjumlah override, teoritis, aktual dan porsi sumber', () => {
    const r = ringkasHppDinamis(
      [menu({}), menu({ menu_item_id: 'x', punya_resep: false, hpp_teoritis_total: null, hpp_override_total: 50000 })],
      [bahan({ nilai: 600, nilai_kiriman: 600 }), bahan({ bahan_baku_id: 'c', nilai: 400, nilai_kiriman: null, nilai_master_sekarang: 400, sumber_harga_terakhir: 'master_sekarang' })],
    )
    expect(r.totalOverride).toBe(290000)
    expect(r.totalTeoritis).toBe(195640)
    expect(r.totalAktual).toBe(1000)
    expect(r.porsi.kiriman).toBe(60)
    expect(r.porsi.master_sekarang).toBe(40)
    expect(r.porsi.tidak_ada).toBe(0)
    expect(r.menuTanpaResep).toBe(1)
  })
  it('selisih teoritis vs override hanya dari menu ber-resep', () => {
    const r = ringkasHppDinamis([menu({}), menu({ menu_item_id: 'x', punya_resep: false, hpp_teoritis_total: null, hpp_override_total: 50000 })], [])
    // 195640 vs 240000 (override menu ber-resep saja) = -18.48%
    expect(r.selisihTeoritisVsOverridePct).toBeCloseTo(-18.48, 1)
  })
  it('porsi nol & selisih null bila tidak ada data', () => {
    const r = ringkasHppDinamis([], [])
    expect(r.totalAktual).toBe(0)
    expect(r.porsi.kiriman).toBe(0)
    expect(r.selisihAktualVsTeoritisPct).toBeNull()
  })
  it('label sumber lengkap', () => {
    expect(Object.keys(LABEL_SUMBER)).toEqual(['kiriman', 'drop_ship', 'master_historis', 'master_sekarang', 'tidak_ada'])
  })
})
