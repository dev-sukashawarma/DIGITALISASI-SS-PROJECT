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
    for (let i = 0; i < length; i++) out += CHARS[Math.floor(Math.random() * n)]
  }
  return out
}
