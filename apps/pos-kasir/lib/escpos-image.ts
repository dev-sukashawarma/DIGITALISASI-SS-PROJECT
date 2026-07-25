// Konversi gambar → data raster ESC/POS (monokrom) untuk printer thermal.
// Loader butuh browser (canvas); `packMonochrome` murni & dapat diuji.

export interface RasterImage {
  bytes: Uint8Array
  widthBytes: number
  height: number
}

/**
 * Kemas piksel RGBA → bit-image 1bpp (MSB kiri). Piksel gelap (luminance < threshold)
 * jadi bit 1 (hitam); transparan dianggap putih. Terekspos untuk unit test.
 * Dilengkapi dengan pemotongan otomatis margin putih (auto-crop whitespace) agar ukuran byte super ringan.
 */
export function packMonochrome(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  threshold = 128,
): RasterImage {
  // 1. Deteksi area bounding box non-putih (auto-trim padding)
  let minX = width, minY = height, maxX = -1, maxY = -1
  let hasContent = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const a = rgba[idx + 3]
      const lum = a < 128 ? 255 : 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2]
      if (lum < threshold) {
        hasContent = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (!hasContent) return { bytes: new Uint8Array(0), widthBytes: 0, height: 0 }

  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1
  const widthBytes = Math.ceil(cropW / 8)
  const bytes = new Uint8Array(widthBytes * cropH)

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const origX = minX + x
      const origY = minY + y
      const idx = (origY * width + origX) * 4
      const a = rgba[idx + 3]
      const lum = a < 128 ? 255 : 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2]
      if (lum < threshold) {
        bytes[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  return { bytes, widthBytes, height: cropH }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * Muat gambar dari URL lalu konversi ke raster (lebar dibatasi `maxWidthDots`).
 * Mengembalikan null bila gagal (mis. CORS men-taint canvas / gambar tak dimuat) —
 * pemanggil harus tetap mencetak sisa struk.
 */
export async function loadImageRaster(url: string, maxWidthDots: number): Promise<RasterImage | null> {
  if (typeof document === 'undefined') return null
  try {
    const img = await loadImage(url)
    const srcW = img.width || 1
    const srcH = img.height || 1
    const scale = Math.min(1, maxWidthDots / srcW)
    const w = Math.max(1, Math.round(srcW * scale))
    const h = Math.max(1, Math.round(srcH * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h) // dapat throw bila canvas tainted (CORS)
    return packMonochrome(data, w, h)
  } catch {
    return null
  }
}
