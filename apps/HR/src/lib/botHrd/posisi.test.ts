import { describe, expect, it } from 'vitest'
import { bacaPosisi, jepitKeLayar, lewatAmbang, parsePosisi, posisiDariPointer, posisiPanelDekatTombol, simpanPosisi } from './posisi'

const layar = { lebar: 1000, tinggi: 800 }

describe('jepitKeLayar', () => {
  it('membiarkan posisi yang sudah di dalam', () => {
    expect(jepitKeLayar({ x: 100, y: 100 }, { lebar: 56, tinggi: 56 }, layar)).toEqual({ x: 100, y: 100 })
  })
  it('menjepit ke tepi kiri-atas dengan margin', () => {
    expect(jepitKeLayar({ x: -50, y: -9 }, { lebar: 56, tinggi: 56 }, layar, 8)).toEqual({ x: 8, y: 8 })
  })
  it('menjepit ke tepi kanan-bawah agar seluruh elemen terlihat', () => {
    expect(jepitKeLayar({ x: 990, y: 790 }, { lebar: 56, tinggi: 56 }, layar, 8)).toEqual({ x: 936, y: 736 })
  })
  it('elemen lebih besar dari layar tetap di margin', () => {
    expect(jepitKeLayar({ x: 50, y: 50 }, { lebar: 2000, tinggi: 2000 }, layar, 8)).toEqual({ x: 8, y: 8 })
  })
})

describe('posisiDariPointer', () => {
  it('menambahkan selisih gerak', () => {
    expect(posisiDariPointer({ x: 10, y: 10 }, { x: 100, y: 200 }, { x: 25, y: 4 })).toEqual({ x: 115, y: 194 })
  })
})

describe('lewatAmbang', () => {
  it('di bawah ambang = klik', () => {
    expect(lewatAmbang({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(false)
  })
  it('mencapai ambang = geser', () => {
    expect(lewatAmbang({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true)
  })
})

describe('posisiPanelDekatTombol', () => {
  const tombol = { lebar: 56, tinggi: 56 }
  const panel = { lebar: 400, tinggi: 600 }
  it('di atas tombol, sisi kanan sejajar', () => {
    expect(posisiPanelDekatTombol({ x: 900, y: 700 }, tombol, panel, layar)).toEqual({ x: 556, y: 88 })
  })
  it('dibalik ke bawah bila tak muat di atas', () => {
    const p = posisiPanelDekatTombol({ x: 900, y: 100 }, tombol, { lebar: 400, tinggi: 500 }, layar)
    expect(p.y).toBe(168)
    expect(p.y + 500).toBeLessThanOrEqual(800 - 8)
  })
  it('selalu di dalam layar', () => {
    const p = posisiPanelDekatTombol({ x: 10, y: 10 }, tombol, panel, layar)
    expect(p.x).toBeGreaterThanOrEqual(8)
    expect(p.y).toBeGreaterThanOrEqual(8)
    expect(p.y + 600).toBeLessThanOrEqual(792)
  })
})

describe('penyimpanan posisi', () => {
  it('parsePosisi menolak data rusak', () => {
    expect(parsePosisi(null)).toBeNull()
    expect(parsePosisi('bukan json')).toBeNull()
    expect(parsePosisi('{"x":"a","y":1}')).toBeNull()
    expect(parsePosisi('{"x":1,"y":2}')).toEqual({ x: 1, y: 2 })
  })
  it('simpan lalu baca kembali', () => {
    const d = new Map<string, string>()
    const s = { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k) }
    simpanPosisi(s, { x: 10.4, y: 20.6 })
    expect(bacaPosisi(s)).toEqual({ x: 10, y: 21 })
  })
  it('aman bila storage melempar / null', () => {
    const rusak = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => {} }
    expect(bacaPosisi(rusak)).toBeNull()
    expect(() => simpanPosisi(rusak, { x: 1, y: 1 })).not.toThrow()
    expect(bacaPosisi(null)).toBeNull()
  })
})
