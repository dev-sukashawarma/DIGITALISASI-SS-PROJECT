import { describe, expect, it } from 'vitest'
import { hitungCondong, JANGKAUAN, MAKS_DERAJAT, MAKS_GESER } from './condong'

describe('hitungCondong', () => {
  it('nol saat kursor tepat di tengah avatar', () => {
    expect(hitungCondong(0)).toEqual({ derajat: 0, px: 0 })
  })
  it('sebanding jarak, separuh jangkauan = separuh condong', () => {
    expect(hitungCondong(JANGKAUAN / 2)).toEqual({ derajat: MAKS_DERAJAT / 2, px: MAKS_GESER / 2 })
  })
  it('dibatasi maksimum di kedua arah', () => {
    expect(hitungCondong(5000)).toEqual({ derajat: 6, px: 3 })
    expect(hitungCondong(-5000)).toEqual({ derajat: -6, px: -3 })
  })
})
