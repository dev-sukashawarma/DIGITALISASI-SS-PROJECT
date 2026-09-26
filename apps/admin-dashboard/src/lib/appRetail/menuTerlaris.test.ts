import { describe, it, expect } from 'vitest'
import { MAKS_MENU_TERLARIS, periksaMenuTerlaris, geserMenu, tambahMenu } from './menuTerlaris'

describe('menu terlaris', () => {
  it('batas maksimal 6 (cermin CHECK migration 20260926100000)', () => {
    expect(MAKS_MENU_TERLARIS).toBe(6)
  })
  it('periksa: sah, kosong sah, terlalu banyak, dobel', () => {
    expect(periksaMenuTerlaris(['a', 'b'])).toBeNull()
    expect(periksaMenuTerlaris([])).toBeNull()
    expect(periksaMenuTerlaris(['1', '2', '3', '4', '5', '6', '7'])).toBe('Maksimal 6 menu terlaris.')
    expect(periksaMenuTerlaris(['a', 'a'])).toBe('Menu yang sama dipilih dua kali.')
  })
  it('geser naik/turun, di ujung tidak berubah', () => {
    expect(geserMenu(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(geserMenu(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(geserMenu(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(geserMenu(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
  it('tambah: ke paling bawah, tak dobel, tak lewat batas', () => {
    expect(tambahMenu(['a'], 'b')).toEqual(['a', 'b'])
    expect(tambahMenu(['a'], 'a')).toEqual(['a'])
    expect(tambahMenu(['1', '2', '3', '4', '5', '6'], '7')).toEqual(['1', '2', '3', '4', '5', '6'])
  })
})
