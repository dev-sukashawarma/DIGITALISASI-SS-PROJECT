const DIGITS = '0123456789'

export function generateTempPassword(length = 6): string {
  const n = DIGITS.length
  let out = ''
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined

  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(length)
    cryptoObj.getRandomValues(buf)
    for (let i = 0; i < length; i++) out += DIGITS[buf[i] % n]
  } else {
    for (let i = 0; i < length; i++) out += DIGITS[Math.floor(Math.random() * n)]
  }
  return out
}

