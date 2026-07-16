import { describe, it, expect } from 'vitest'
import { packMonochrome } from './escpos-image'
import { EscPosEncoder } from './escpos-encoder'

// Bangun buffer RGBA solid.
function rgba(width: number, height: number, on: boolean): number[] {
  const arr: number[] = []
  for (let i = 0; i < width * height; i++) {
    const v = on ? 0 : 255 // 0 = hitam (bit 1), 255 = putih
    arr.push(v, v, v, 255)
  }
  return arr
}

describe('packMonochrome', () => {
  it('8x1 hitam → 1 byte 0xFF', () => {
    const r = packMonochrome(rgba(8, 1, true), 8, 1)
    expect(r.widthBytes).toBe(1)
    expect(r.height).toBe(1)
    expect(Array.from(r.bytes)).toEqual([0xff])
  })
  it('8x1 putih → 1 byte 0x00', () => {
    const r = packMonochrome(rgba(8, 1, false), 8, 1)
    expect(Array.from(r.bytes)).toEqual([0x00])
  })
  it('piksel hitam di x=0 → MSB set (0x80)', () => {
    const px = rgba(8, 1, false)
    px[0] = 0; px[1] = 0; px[2] = 0 // pixel 0 hitam
    const r = packMonochrome(px, 8, 1)
    expect(r.bytes[0]).toBe(0x80)
  })
  it('lebar non-kelipatan 8 → widthBytes dibulatkan ke atas', () => {
    const r = packMonochrome(rgba(10, 2, false), 10, 2)
    expect(r.widthBytes).toBe(2)
    expect(r.bytes.length).toBe(2 * 2)
  })
  it('transparan dianggap putih', () => {
    const px = rgba(8, 1, true) // hitam
    for (let i = 0; i < 8; i++) px[i * 4 + 3] = 0 // alpha 0
    const r = packMonochrome(px, 8, 1)
    expect(r.bytes[0]).toBe(0x00)
  })
})

describe('EscPosEncoder.raster', () => {
  it('mengeluarkan header GS v 0 + data', () => {
    const enc = new EscPosEncoder()
    enc.raster(new Uint8Array([0xff, 0x00]), 1, 2)
    const bytes = Array.from(enc.encode())
    // cari 0x1d 0x76 0x30 0x00 (GS v 0 m)
    const idx = bytes.findIndex((b, i) =>
      b === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30 && bytes[i + 3] === 0x00)
    expect(idx).toBeGreaterThanOrEqual(0)
    // xL,xH = 1,0 ; yL,yH = 2,0 ; lalu data 0xff,0x00
    expect(bytes.slice(idx + 4, idx + 8)).toEqual([1, 0, 2, 0])
    expect(bytes.slice(idx + 8, idx + 10)).toEqual([0xff, 0x00])
  })
})
