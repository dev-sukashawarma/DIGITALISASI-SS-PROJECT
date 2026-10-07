import { bingkaiKamera } from '@/kantor/kamera'

const V = 255
// 4×3 tile, ruangan hanya di kolom 1–2 baris 1–2.
const tiles = [
  V, V, V, V,
  V, 1, 1, V,
  V, 1, 1, V,
]

describe('bingkaiKamera', () => {
  it('zoom mengikuti ruangan terisi, bukan seluruh layout', () => {
    // ruangan 2×2 tile × 16 px = 32 px; kanvas 128×128 → zoom 4
    expect(bingkaiKamera(tiles, 4, 3, 128, 128, 16).zoom).toBe(4)
  })
  it('pusat ruangan jatuh di pusat kanvas', () => {
    const { zoom, panX, panY } = bingkaiKamera(tiles, 4, 3, 128, 128, 16)
    const offX = Math.floor((128 - 4 * 16 * zoom) / 2) + Math.round(panX)
    const offY = Math.floor((128 - 3 * 16 * zoom) / 2) + Math.round(panY)
    expect(offX + 2 * 16 * zoom).toBe(64) // pusat kolom 1–2 = tepi kiri kolom 2
    expect(offY + 2 * 16 * zoom).toBe(64) // pusat baris 1–2 = tepi atas baris 2
  })
  it('zoom minimal 1 & layout tanpa tile terisi memakai seluruh layout', () => {
    expect(bingkaiKamera(tiles, 4, 3, 10, 10, 16).zoom).toBe(1)
    expect(bingkaiKamera([V, V], 2, 1, 64, 64, 16)).toEqual({ zoom: 2, panX: 0, panY: 0 })
  })
})
