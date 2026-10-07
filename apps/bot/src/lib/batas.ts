export const BATAS = { panjangPesan: 2000, pesanPerJam: 60, percakapanMaks: 50, timeoutMs: 120_000 } as const

export const GALAT_STANDAR = 'Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi.'

export function validasiPesan(x: unknown): { ok: true; pesan: string } | { ok: false; galat: string } {
  if (typeof x !== 'string') return { ok: false, galat: 'Pesan tidak valid.' }
  const pesan = x.trim()
  if (!pesan) return { ok: false, galat: 'Pesan kosong.' }
  if (pesan.length > BATAS.panjangPesan) return { ok: false, galat: `Pesan maksimal ${BATAS.panjangPesan} karakter.` }
  return { ok: true, pesan }
}

export function judulDari(pesan: string): string {
  return pesan.replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** `idsTerbaruDulu` diurut diperbarui_at DESC; kembalikan yang melewati batas. */
export function idUntukDipangkas(idsTerbaruDulu: string[]): string[] {
  return idsTerbaruDulu.slice(BATAS.percakapanMaks)
}
