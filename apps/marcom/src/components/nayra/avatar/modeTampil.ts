export type KondisiTampil = { kurangiGerak: boolean; hematData: boolean; videoGagal: boolean }

/** Video hanya bila pengguna tidak mematikan animasi, tidak hemat data, dan video belum pernah gagal. */
export const bolehVideo = (k: KondisiTampil): boolean => !k.kurangiGerak && !k.hematData && !k.videoGagal

export type FormatAnimasi = 'webm' | 'webp'
export type Sumber = FormatAnimasi | 'gambar'

/**
 * WebM transparan (VP9) hanya didukung penuh oleh Chromium (Chrome, Edge) & Firefox.
 * Semua browser di iPhone/iPad (WebKit) dan Safari Mac memakai WebP beranimasi transparan.
 */
export function pilihFormat(ua: string, maxTouchPoints: number): FormatAnimasi {
  const ios = /iPhone|iPad|iPod|CriOS|FxiOS/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua)
  return ios || safari ? 'webp' : 'webm'
}
