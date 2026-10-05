import { describe, it, expect } from 'vitest'
import { originDiizinkan, headerCors } from './cors'

describe('cors', () => {
  it('default: portal produksi & portal lokal', () => {
    expect(originDiizinkan('https://app.sukashawarma.com', undefined)).toBe(true)
    expect(originDiizinkan('http://localhost:3010', undefined)).toBe(true)
    expect(originDiizinkan('https://evil.sukashawarma.com', undefined)).toBe(false)
    expect(originDiizinkan(null, undefined)).toBe(false)
  })
  it('env menimpa default', () => {
    expect(originDiizinkan('https://portal.x', 'https://portal.x, https://y')).toBe(true)
    expect(originDiizinkan('https://app.sukashawarma.com', 'https://portal.x')).toBe(false)
  })
  it('header hanya untuk origin diizinkan', () => {
    expect(headerCors('https://app.sukashawarma.com', undefined)).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.sukashawarma.com',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    })
    expect(headerCors('https://evil.com', undefined)).toEqual({ Vary: 'Origin' })
  })
})
