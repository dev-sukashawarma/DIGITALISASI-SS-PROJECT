/**
 * Perkecil foto di browser sebelum diunggah lewat Server Action.
 * Server Action punya batas body (lihat next.config.ts); foto kamera/desain
 * sering 2–5 MB, padahal tampilan menu cukup ±1600 px. Hasil WebP biasanya
 * 100–300 KB. Bila browser gagal memproses (format tak didukung, dsb.) atau
 * hasilnya tidak lebih kecil, file asli yang dipakai.
 */
export async function compressImage(
  file: File,
  { maxSize = 1600, quality = 0.85 }: { maxSize?: number; quality?: number } = {}
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'menu'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}
