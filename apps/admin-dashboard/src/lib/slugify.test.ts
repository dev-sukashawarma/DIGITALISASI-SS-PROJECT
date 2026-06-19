import { describe, it, expect } from 'vitest'
import { slugify } from './slugify'

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('Suka Shawarma Empang')).toBe('suka-shawarma-empang')
  })
  it('strips punctuation', () => {
    expect(slugify('Outlet #1 (Pusat)!')).toBe('outlet-1-pusat')
  })
  it('collapses repeated separators', () => {
    expect(slugify('A  --  B')).toBe('a-b')
  })
  it('trims leading/trailing dashes', () => {
    expect(slugify('  Empang  ')).toBe('empang')
  })
  it('strips accents', () => {
    expect(slugify('Café Düsseldorf')).toBe('cafe-dusseldorf')
  })
  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })
})
