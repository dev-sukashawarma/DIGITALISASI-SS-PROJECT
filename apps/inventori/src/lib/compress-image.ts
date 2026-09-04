// Kamera HP menghasilkan JPEG 3-10 MB. Mengirim byte mentah itu lewat 4G adalah
// biaya terbesar saat menyimpan inventaris. Kompresi di browser memakai
// parameter yang sama dengan sharp di server (1024px, WebP q72) sehingga hasil
// akhirnya identik, tetapi yang menyeberang jaringan ~20-40x lebih kecil.
//
// Seluruh tahap berat dijalankan di luar main thread: createImageBitmap men-
// decode dan me-resample di thread terpisah, dan OffscreenCanvas.convertToBlob
// meng-encode WebP di sana juga. Yang tersisa di main thread hanya drawImage
// dari bitmap yang sudah kecil. Tanpa ini, memilih 87 foto berarti 87 kali UI
// tertahan beberapa ratus milidetik.
const MAX_DIMENSION = 1024
const WEBP_QUALITY = 0.72

function scaledSize(width: number, height: number) {
  const ratio = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

async function encodeWebp(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'function') {
    try {
      const canvas = new OffscreenCanvas(width, height)
      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(bitmap, 0, 0, width, height)
        return await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
      }
    } catch {
      // Sebagian browser mengiklankan OffscreenCanvas tanpa encoder WebP.
      // Jatuh ke canvas biasa di bawah.
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
}

/**
 * Mengecilkan foto menjadi WebP <=1024px. Mengembalikan file asli bila browser
 * tidak mendukung salah satu langkah — foto asli yang besar tetap jauh lebih
 * baik daripada gagal menyimpan inventaris.
 */
export async function compressPhoto(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file
  let source: ImageBitmap | null = null
  let resized: ImageBitmap | null = null
  try {
    // imageOrientation menerapkan EXIF rotate, sama seperti sharp().rotate().
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = scaledSize(source.width, source.height)

    // Resample di thread terpisah dulu supaya drawImage di main thread hanya
    // menyalin bitmap 1024px, bukan menurunkan skala foto 12 megapiksel.
    if (width !== source.width || height !== source.height) {
      resized = await createImageBitmap(source, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })
    }

    const blob = await encodeWebp(resized ?? source, width, height)
    // Browser tanpa encoder WebP mengembalikan PNG yang justru lebih besar.
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  } finally {
    source?.close()
    resized?.close()
  }
}
