export type HasilCari<T> = { status: 'cocok'; item: T } | { status: 'ambigu'; kandidat: T[] } | { status: 'tidak_ada' }

const rapikan = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Nama outlet tanpa awalan merek ("SUKA SHAWARMA", "MITRA", "SS"), supaya "beji" cocok. */
export function normalisasiOutlet(s: string): string {
  return rapikan(rapikan(s).replace(/\bsuka shawarma\b|\bmitra\b|\bss\b/g, ' '))
}

export function normalisasiBahan(s: string): string {
  return rapikan(s)
}

export function cariSatu<T>(kueri: string, daftar: T[], nama: (t: T) => string, normalisasi: (s: string) => string): HasilCari<T> {
  const q = normalisasi(kueri)
  if (!q) return { status: 'tidak_ada' }
  const persis = daftar.filter((t) => normalisasi(nama(t)) === q)
  if (persis.length === 1) return { status: 'cocok', item: persis[0] }
  if (persis.length > 1) return { status: 'ambigu', kandidat: persis }
  const kataQ = q.split(' ')
  const sebagian = daftar.filter((t) => {
    const n = normalisasi(nama(t))
    return kataQ.every((k) => n.includes(k))
  })
  if (sebagian.length === 1) return { status: 'cocok', item: sebagian[0] }
  if (sebagian.length > 1) return { status: 'ambigu', kandidat: sebagian }
  return { status: 'tidak_ada' }
}
