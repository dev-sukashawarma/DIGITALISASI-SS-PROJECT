import { describe, it, expect } from 'vitest'
import { formatCompositeSaldo, formatCompositeDelta, combineOpnameInput } from '../compositeUnit'

describe('formatCompositeSaldo', () => {
  it('pecah saldo jadi unit besar + sisa unit kecil', () => {
    expect(formatCompositeSaldo(2.5, 'kompan', 'liter', 16)).toBe('2 kompan + 8 liter')
  })

  it('sisa 0 tetap tampil eksplisit', () => {
    expect(formatCompositeSaldo(2, 'kompan', 'liter', 16)).toBe('2 kompan + 0 liter')
  })

  it('sisa mendekati batas dibulatkan 2 desimal', () => {
    expect(formatCompositeSaldo(2.999, 'kompan', 'liter', 16)).toBe('2 kompan + 15.98 liter')
  })

  it('saldo negatif tetap konsisten secara matematis', () => {
    expect(formatCompositeSaldo(-0.5, 'kompan', 'liter', 16)).toBe('-1 kompan + 8 liter')
  })

  it('fallback ke tampilan lama kalau satuan_kecil null', () => {
    expect(formatCompositeSaldo(4.5, 'kg', null, null)).toBe('4.5 kg')
  })

  it('fallback ke tampilan lama kalau faktor_tampilan null', () => {
    expect(formatCompositeSaldo(4.5, 'kg', 'gram', null)).toBe('4.5 kg')
  })
})

describe('formatCompositeDelta', () => {
  it('qty kecil ditampilkan dalam satuan kecil', () => {
    expect(formatCompositeDelta(-0.03, 'kompan', 'liter', 16)).toBe('-0.48 liter')
  })

  it('qty positif ditampilkan dengan tanda plus', () => {
    expect(formatCompositeDelta(0.03, 'kompan', 'liter', 16)).toBe('+0.48 liter')
  })

  it('fallback ke tampilan lama kalau satuan_kecil null', () => {
    expect(formatCompositeDelta(-500, 'gram', null, null)).toBe('-500 gram')
  })
})

describe('combineOpnameInput', () => {
  it('gabung kontainer + sisa jadi qty desimal', () => {
    expect(combineOpnameInput(2, 8, 16)).toBe(2.5)
  })

  it('sisa 0 menghasilkan bilangan bulat', () => {
    expect(combineOpnameInput(3, 0, 16)).toBe(3)
  })

  it('sisa mendekati batas', () => {
    expect(combineOpnameInput(0, 15.98, 16)).toBeCloseTo(0.99875, 5)
  })
})
