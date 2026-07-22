/**
 * Utility to compress and resize image files in browser using native HTML5 Canvas.
 * Converts heavy camera photos (2MB - 8MB JPG/PNG) to lightweight WebP files (~50KB - 150KB).
 */
export async function compressImageToWebP(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<File> {
  // If not an image or SVG, return original file safely
  if (!file.type.startsWith('image/') || file.type.includes('svg')) {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calculate aspect ratio preserving dimensions
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        // Draw image onto canvas with smooth scaling
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Convert canvas to WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }

            // Generate clean compressed file name with .webp extension
            const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
            const newFileName = `${originalName}.webp`

            const compressedFile = new File([blob], newFileName, {
              type: 'image/webp',
              lastModified: Date.now(),
            })

            // If compressed file is smaller, use it; otherwise fallback to original
            if (compressedFile.size < file.size) {
              resolve(compressedFile)
            } else {
              resolve(file)
            }
          },
          'image/webp',
          quality
        )
      }

      img.onerror = () => resolve(file)
    }

    reader.onerror = () => resolve(file)
  })
}
