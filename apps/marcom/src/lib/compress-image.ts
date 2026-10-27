/**
 * Utilitas kompresi foto/gambar bukti nota di sisi klien (browser)
 * Mengubah foto kamera HP yang berat (3MB - 10MB JPG/PNG) menjadi WebP ringan (~150KB - 300KB)
 * dengan resolusi optimal (max 1600px) agar tulisan struk/nota tetap tajam dan terbaca jelas.
 */

const MAX_DIMENSION = 1600 // Cukup tinggi agar teks struk kecil tetap terbaca tajam
const WEBP_QUALITY = 0.82

export async function compressReceiptImage(file: File): Promise<File> {
  // Hanya proses file gambar (bukan PDF atau SVG)
  if (typeof window === 'undefined' || !file.type.startsWith('image/') || file.type.includes('svg')) {
    return file
  }

  try {
    // Gunakan createImageBitmap bila didukung (memproses EXIF orientation otomatis dari kamera HP)
    if (typeof createImageBitmap === 'function') {
      let source: ImageBitmap | null = null
      let resized: ImageBitmap | null = null
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' })
        const { width, height } = calculateAspectRatio(source.width, source.height, MAX_DIMENSION)

        if (width !== source.width || height !== source.height) {
          resized = await createImageBitmap(source, {
            resizeWidth: width,
            resizeHeight: height,
            resizeQuality: 'high',
          })
        }

        const targetBitmap = resized ?? source
        const blob = await bitmapToWebpBlob(targetBitmap, width, height)

        if (blob && blob.size < file.size) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'nota'
          return new File([blob], `${baseName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          })
        }
      } finally {
        source?.close()
        resized?.close()
      }
    }

    // Fallback: HTML5 Image + Canvas
    return await fallbackCanvasCompress(file)
  } catch (err) {
    console.warn('[compressReceiptImage] Kompresi gagal, menggunakan file asli:', err)
    return file
  }
}

function calculateAspectRatio(width: number, height: number, maxDim: number) {
  const ratio = Math.min(1, maxDim / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

async function bitmapToWebpBlob(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'function') {
    try {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(bitmap, 0, 0, width, height)
        return await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
      }
    } catch {
      // OffscreenCanvas encoder WebP tidak tersedia, fallback ke DOM canvas
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', WEBP_QUALITY)
  })
}

function fallbackCanvasCompress(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string

      img.onload = () => {
        const { width, height } = calculateAspectRatio(img.width, img.height, MAX_DIMENSION)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file)
              return
            }
            const baseName = file.name.replace(/\.[^.]+$/, '') || 'nota'
            resolve(
              new File([blob], `${baseName}.webp`, {
                type: 'image/webp',
                lastModified: Date.now(),
              })
            )
          },
          'image/webp',
          WEBP_QUALITY
        )
      }

      img.onerror = () => resolve(file)
    }

    reader.onerror = () => resolve(file)
  })
}
