import { describe, expect, it } from 'vitest'
import {
  isNilaiKosong,
  isIsianTerisi,
  aturNilaiIsian,
  bersihkanIsian,
  bersihkanPetaIsian,
  bersihkanPetaVendor,
  bahanDikosongkan,
} from './isianOpname'

describe('isNilaiKosong', () => {
  it('undefined, null, string kosong, dan spasi = kosong', () => {
    expect(isNilaiKosong(undefined)).toBe(true)
    expect(isNilaiKosong(null)).toBe(true)
    expect(isNilaiKosong('')).toBe(true)
    expect(isNilaiKosong('   ')).toBe(true)
  })

  it('"0" = terisi (sudah dihitung, habis)', () => {
    expect(isNilaiKosong('0')).toBe(false)
    expect(isNilaiKosong('2.5')).toBe(false)
  })
})

describe('isIsianTerisi', () => {
  it('kolom yang diketik lalu dihapus ("") tidak dianggap terisi', () => {
    expect(isIsianTerisi({ besar: '' })).toBe(false)
    expect(isIsianTerisi({ besar: '', tengah: ' ', kecil: '' })).toBe(false)
  })

  it('undefined/objek kosong tidak terisi', () => {
    expect(isIsianTerisi(undefined)).toBe(false)
    expect(isIsianTerisi(null)).toBe(false)
    expect(isIsianTerisi({})).toBe(false)
  })

  it('0 di level mana pun = terisi', () => {
    expect(isIsianTerisi({ besar: '0' })).toBe(true)
    expect(isIsianTerisi({ besar: '', kecil: '0' })).toBe(true)
  })
})

describe('aturNilaiIsian', () => {
  it('nilai kosong menghapus kunci level', () => {
    expect(aturNilaiIsian({ besar: '2', kecil: '5' }, 'besar', '')).toEqual({ kecil: '5' })
    expect(aturNilaiIsian({ besar: '2' }, 'besar', '  ')).toEqual({})
  })

  it('nilai terisi disetel apa adanya', () => {
    expect(aturNilaiIsian(undefined, 'tengah', '0')).toEqual({ tengah: '0' })
    expect(aturNilaiIsian({ besar: '1' }, 'kecil', '3')).toEqual({ besar: '1', kecil: '3' })
  })
})

describe('bersihkanIsian', () => {
  it('membuang level kosong; undefined bila tak ada yang tersisa', () => {
    expect(bersihkanIsian({ besar: '', tengah: '3' })).toEqual({ tengah: '3' })
    expect(bersihkanIsian({ besar: '', kecil: ' ' })).toBeUndefined()
    expect(bersihkanIsian(undefined)).toBeUndefined()
  })

  it('mengabaikan nilai non-string yang tidak sah', () => {
    expect(bersihkanIsian({ besar: 5 as unknown as string, kecil: '2' })).toEqual({ besar: '5', kecil: '2' })
    expect(bersihkanIsian({ besar: {} as unknown as string })).toBeUndefined()
  })
})

describe('bersihkanPetaIsian', () => {
  it('membuang bahan yang seluruh isiannya kosong', () => {
    expect(
      bersihkanPetaIsian({ A: { besar: '' }, B: { besar: '0' }, C: { kecil: '', tengah: '4' } }),
    ).toEqual({ B: { besar: '0' }, C: { tengah: '4' } })
  })

  it('input bukan objek = peta kosong', () => {
    expect(bersihkanPetaIsian(undefined)).toEqual({})
    expect(bersihkanPetaIsian('x' as unknown as Record<string, unknown>)).toEqual({})
  })
})

describe('bersihkanPetaVendor', () => {
  it('mempertahankan kunci vendor (agar "sebagian" tetap terdeteksi) tapi mengosongkan isian ""', () => {
    expect(
      bersihkanPetaVendor({ A: { v1: { besar: '' }, v2: { besar: '3' } } }),
    ).toEqual({ A: { v1: {}, v2: { besar: '3' } } })
  })

  it('input bukan objek = peta kosong', () => {
    expect(bersihkanPetaVendor(undefined)).toEqual({})
  })
})

describe('bahanDikosongkan', () => {
  it('bahan yang pernah terisi tapi tidak ada di payload = dikosongkan', () => {
    expect(bahanDikosongkan(new Set(['a', 'b', 'c']), ['a'])).toEqual(['b', 'c'])
  })

  it('bahan yang tak pernah disentuh perangkat ini tidak ikut dihapus (perangkat lain)', () => {
    expect(bahanDikosongkan(new Set(['a']), ['a'])).toEqual([])
  })

  it('kosong bila semua yang pernah terisi masih dikirim', () => {
    expect(bahanDikosongkan(new Set<string>(), [])).toEqual([])
  })
})
