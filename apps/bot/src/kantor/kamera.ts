// Bingkai kamera kantor: skala & geser dihitung dari tile yang TERISI saja. Layout bawaan Pixel
// Agents menyisakan banyak baris void — kalau ikut dihitung, ruangan jadi kecil & tidak di tengah.
const TILE_VOID = 255

export function bingkaiKamera(tiles: number[], cols: number, rows: number, w: number, h: number, tile: number) {
  let c0 = cols, c1 = -1, r0 = rows, r1 = -1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r * cols + c] === TILE_VOID) continue
      if (c < c0) c0 = c
      if (c > c1) c1 = c
      if (r < r0) r0 = r
      if (r > r1) r1 = r
    }
  }
  if (c1 < 0) { c0 = 0; c1 = cols - 1; r0 = 0; r1 = rows - 1 }
  const lebar = (c1 - c0 + 1) * tile
  const tinggi = (r1 - r0 + 1) * tile
  const zoom = Math.max(1, Math.floor(Math.min(w / lebar, h / tinggi)))
  // renderFrame menaruh layout di tengah kanvas lalu menambah pan; geser agar pusat ruangan di tengah.
  const pusatX = ((c0 + c1 + 1) / 2) * tile * zoom
  const pusatY = ((r0 + r1 + 1) / 2) * tile * zoom
  const panX = w / 2 - pusatX - Math.floor((w - cols * tile * zoom) / 2)
  const panY = h / 2 - pusatY - Math.floor((h - rows * tile * zoom) / 2)
  return { zoom, panX: Object.is(panX, -0) ? 0 : panX, panY: Object.is(panY, -0) ? 0 : panY }
}
