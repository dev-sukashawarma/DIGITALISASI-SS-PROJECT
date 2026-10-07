// Diadaptasi dari pixel-agents-hq/pixel-agents @3537e140 webview-ui/src/browserMock.ts (MIT).
// Memuat PNG aset di browser, decode ke matriks warna hex, lalu menyuntik ke engine.
import { rgbaToHex } from '@/kantor/engine/core/assets/colorUtils'
import {
  CHAR_FRAME_H, CHAR_FRAME_W, CHAR_FRAMES_PER_ROW, CHARACTER_DIRECTIONS, FLOOR_TILE_SIZE,
  WALL_BITMASK_COUNT, WALL_GRID_COLS, WALL_PIECE_HEIGHT, WALL_PIECE_WIDTH,
} from '@/kantor/engine/core/assets/constants'
import type { AssetIndex, CatalogEntry, CharacterDirectionSprites } from '@/kantor/engine/core/assets/types'
import { setCharacterTemplates } from '@/kantor/engine/office/sprites/spriteData'
import { setFloorSprites } from '@/kantor/engine/office/floorTiles'
import { setWallSprites } from '@/kantor/engine/office/wallTiles'
import { buildDynamicCatalog } from '@/kantor/engine/office/layout/furnitureCatalog'

type Png = { width: number; height: number; data: Uint8ClampedArray }
export type AsetKantor = { layout: unknown; jumlahKarakter: number }

async function decodePng(url: string): Promise<Png> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Gagal memuat ${url} (${res.status})`)
  const bitmap = await createImageBitmap(await res.blob())
  const c = document.createElement('canvas')
  c.width = bitmap.width
  c.height = bitmap.height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D tidak tersedia')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const img = ctx.getImageData(0, 0, c.width, c.height)
  return { width: c.width, height: c.height, data: img.data }
}

function potong(png: Png, w: number, h: number, ox = 0, oy = 0): string[][] {
  const out: string[][] = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const i = ((oy + y) * png.width + (ox + x)) * 4
      row.push(rgbaToHex(png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]))
    }
    out.push(row)
  }
  return out
}

const jalur = (kind: string, rel: string) => (rel.startsWith(`${kind}/`) ? rel : `${kind}/${rel}`)

export async function muatAset(base: string): Promise<AsetKantor> {
  const [indeks, katalog] = await Promise.all([
    fetch(`${base}asset-index.json`).then((r) => r.json()) as Promise<AssetIndex>,
    fetch(`${base}furniture-catalog.json`).then((r) => r.json()) as Promise<CatalogEntry[]>,
  ])

  const karakter = await Promise.all(indeks.characters.map(async (rel) => {
    const png = await decodePng(`${base}${jalur('characters', rel)}`)
    const s: CharacterDirectionSprites = { down: [], up: [], right: [] }
    CHARACTER_DIRECTIONS.forEach((dir, di) => {
      s[dir] = Array.from({ length: CHAR_FRAMES_PER_ROW }, (_, f) =>
        potong(png, CHAR_FRAME_W, CHAR_FRAME_H, f * CHAR_FRAME_W, di * CHAR_FRAME_H))
    })
    return s
  }))
  const lantai = await Promise.all(indeks.floors.map(async (rel) =>
    potong(await decodePng(`${base}${jalur('floors', rel)}`), FLOOR_TILE_SIZE, FLOOR_TILE_SIZE)))
  const dinding = await Promise.all(indeks.walls.map(async (rel) => {
    const png = await decodePng(`${base}${jalur('walls', rel)}`)
    return Array.from({ length: WALL_BITMASK_COUNT }, (_, m) =>
      potong(png, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT, (m % WALL_GRID_COLS) * WALL_PIECE_WIDTH, Math.floor(m / WALL_GRID_COLS) * WALL_PIECE_HEIGHT))
  }))
  const furnitur: Record<string, string[][]> = {}
  await Promise.all(katalog.map(async (e) => {
    furnitur[e.id] = potong(await decodePng(`${base}${e.furniturePath}`), e.width, e.height)
  }))
  const layout = indeks.defaultLayout ? await fetch(`${base}${indeks.defaultLayout}`).then((r) => r.json()) : null

  // Urutan sama dengan upstream: karakter → lantai → dinding → furnitur → layout.
  setCharacterTemplates(karakter)
  setFloorSprites(lantai)
  setWallSprites(dinding)
  buildDynamicCatalog({ catalog: katalog as never, sprites: furnitur })
  return { layout, jumlahKarakter: karakter.length }
}
