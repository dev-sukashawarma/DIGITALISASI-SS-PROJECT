import { describe, expect, it } from 'vitest'
import { cariTukarBahan, isKelipatanKemasan, keluargaBahan } from './diagnosaSelisih'

describe('isKelipatanKemasan', () => {
  it('pas 1 tabung GAS (3000 g) = kelipatan', () => {
    expect(isKelipatanKemasan(3000, 3000)).toBe(true)
    expect(isKelipatanKemasan(-18240, 18240)).toBe(true)
  })

  it('toleransi +/- 2 satuan kecil', () => {
    expect(isKelipatanKemasan(5998, 3000)).toBe(true)
    expect(isKelipatanKemasan(6002, 3000)).toBe(true)
    expect(isKelipatanKemasan(6010, 3000)).toBe(false)
  })

  it('di bawah satu kemasan atau kemasan 1 bukan anomali', () => {
    expect(isKelipatanKemasan(1500, 3000)).toBe(false)
    expect(isKelipatanKemasan(5, 1)).toBe(false)
  })
})

describe('keluargaBahan', () => {
  it('bahan sejenis beda ukuran satu keluarga', () => {
    expect(keluargaBahan('FOIL 5M')).toBe('FOIL')
    expect(keluargaBahan('FOIL 7,6M')).toBe('FOIL')
    expect(keluargaBahan('KULIT 25')).toBe('KULIT')
    expect(keluargaBahan('GAS 12 KG')).toBe('GAS')
  })

  it('nama tanpa ukuran tidak punya keluarga', () => {
    expect(keluargaBahan('PLASTIK MERAH')).toBeNull()
    expect(keluargaBahan('SAPI')).toBeNull()
  })
})

describe('cariTukarBahan', () => {
  // Kasus nyata Mitra Cicurug 21 Nov: FOIL 7,6M -1 Dus, FOIL 5M +1 Dus 3 Roll.
  const foil76 = { id: 'f76', nama: 'FOIL 7,6M', satuan: 'Dus', selisih: -18240, kemasan: 18240 }
  const foil5 = { id: 'f5', nama: 'FOIL 5M', satuan: 'Dus', selisih: 25611, kemasan: 24000 }

  it('dua bahan sekeluarga dengan selisih berlawanan saling ditandai', () => {
    const hasil = cariTukarBahan([foil76, foil5])
    expect(hasil.get('f76')?.map((p) => p.nama)).toEqual(['FOIL 5M'])
    expect(hasil.get('f5')?.map((p) => p.nama)).toEqual(['FOIL 7,6M'])
  })

  it('selisih searah tidak ditandai', () => {
    expect(cariTukarBahan([foil76, { ...foil5, selisih: -25611 }]).size).toBe(0)
  })

  it('berlawanan tapi tidak saling meniadakan (sisa > 50%) tidak ditandai', () => {
    // -1 Dus vs +3 Dus: sisa 2 Dus > separuh dari 3 Dus.
    expect(cariTukarBahan([foil76, { ...foil5, selisih: 72000 }]).size).toBe(0)
  })

  it('selisih kecil (< setengah kemasan) diabaikan', () => {
    expect(cariTukarBahan([foil76, { ...foil5, selisih: 500 }]).size).toBe(0)
  })

  it('beda keluarga tidak ditandai, kecuali pasangan substitusi', () => {
    const pouch = { id: 'p', nama: 'SAOS TOMAT POUCH', satuan: 'Dus', selisih: -10800, kemasan: 10800 }
    const kompan = { id: 'k', nama: 'SAOS TOMAT KOMPAN', satuan: 'Dus', selisih: 16500, kemasan: 16500 }
    expect(cariTukarBahan([pouch, kompan]).size).toBe(0)
    expect(cariTukarBahan([pouch, kompan], [['p', 'k']]).get('p')?.[0].nama).toBe('SAOS TOMAT KOMPAN')
  })
})
