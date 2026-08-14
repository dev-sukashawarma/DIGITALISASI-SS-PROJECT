// Password sementara acak untuk staf baru / reset. Mengganti default seragam
// 'sukashawarma123' yang lemah & sama untuk semua orang. Admin tetap melihat
// nilainya (input text) untuk diberikan ke staf; idealnya nanti dipadu dengan
// "wajib ganti saat login pertama".
//
// Charset tanpa karakter ambigu (0/O/1/l/I) agar mudah dibaca/diketik manual.
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(length = 10): string {
  const n = CHARS.length
  let out = ''
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined

  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(length)
    cryptoObj.getRandomValues(buf)
    for (let i = 0; i < length; i++) out += CHARS[buf[i] % n]
  } else {
    // Fallback (lingkungan tanpa Web Crypto) — tetap acak, cukup untuk temp password.
    for (let i = 0; i < length; i++) out += CHARS[Math.floor(Math.random() * n)]
  }
  return out
}
