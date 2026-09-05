export type DeltaKind = 'up' | 'down' | 'flat' | 'new' | 'none'

export type Delta = {
  kind: DeltaKind
  /** Persen selisih, satu desimal. null bila tak bermakna (none/new). */
  pct: number | null
}

/** Ambang selisih yang masih dianggap "datar", dalam persen. */
const FLAT_THRESHOLD = 0.5

/**
 * Membandingkan angka hari ini terhadap baseline.
 * Papan tak boleh menampilkan Infinity, NaN, atau -100% palsu — semua kasus
 * pembagian nol dipetakan ke kind tersendiri yang dirender sebagai teks.
 */
export function computeDelta(today: number, base: number | null): Delta {
  if (base === null) return { kind: 'none', pct: null }
  if (base === 0) {
    return today > 0 ? { kind: 'new', pct: null } : { kind: 'none', pct: null }
  }
  const raw = ((today - base) / base) * 100
  const pct = Math.round(raw * 10) / 10
  if (Math.abs(pct) < FLAT_THRESHOLD) return { kind: 'flat', pct }
  return { kind: pct > 0 ? 'up' : 'down', pct }
}
