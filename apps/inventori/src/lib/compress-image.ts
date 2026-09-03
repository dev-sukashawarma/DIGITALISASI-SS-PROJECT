// Kamera HP menghasilkan JPEG 3-10 MB. Mengirim byte mentah itu lewat 4G adalah
// biaya terbesar saat menyimpan inventaris: sekali untuk pra-upload per item,
// dan sekali lagi bila submit terpaksa memakai jalur fallback. Kompresi di
// browser memakai parameter yang sama dengan sharp di server (1024px, WebP q72)
// sehingga hasil akhirnya identik, tetapi yang menyeberang jaringan ~20-40x
// lebih kecil. Server tetap mengoptimalkan ulang sebagai jaring pengaman.
const MAX_DIMENSION = 1024
const WEBP_QUALITY = 0.72

function scaledSize(width: number, height: number) {
  const ratio = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

function toWebpBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
}

/**
 * Mengecilkan foto menjadi WebP <=1024px. Mengembalikan file asli bila browser
 * tidak mendukung salah satu langkah — foto asli yang besar tetap jauh lebih
 * baik daripada gagal menyimpan inventaris.
 */
export async function compressPhoto(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap | null = null
  try {
    // imageOrientation menerapkan EXIF rotate, sama seperti sharp().rotate().
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = scaledSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await toWebpBlob(canvas)
    // Browser tanpa encoder WebP mengembalikan PNG yang justru lebih besar.
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}
