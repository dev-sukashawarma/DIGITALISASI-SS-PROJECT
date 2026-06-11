/** Perkiraan ukuran byte dari sebuah dataURL base64. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function isWithinSizeLimit(dataUrl: string, maxBytes: number): boolean {
  return estimateDataUrlBytes(dataUrl) <= maxBytes;
}

/**
 * Kompres gambar dari <video>/<canvas> ke JPEG dataURL.
 * (Bergantung DOM; dipakai di komponen, diverifikasi manual.)
 */
export function canvasToCompressedJpeg(canvas: HTMLCanvasElement, quality = 0.6): string {
  return canvas.toDataURL("image/jpeg", quality);
}
