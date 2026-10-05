import type { Ukuran } from './posisi'

export type PilihanUkuran = 'kecil' | 'sedang' | 'besar'
export type Setelan = { ukuranChef: PilihanUkuran; ukuranPanel: PilihanUkuran; animasi: boolean; tersembunyi: boolean }

export const SETELAN_BAWAAN: Setelan = { ukuranChef: 'sedang', ukuranPanel: 'sedang', animasi: true, tersembunyi: false }
export const PILIHAN_UKURAN: readonly PilihanUkuran[] = ['kecil', 'sedang', 'besar']

/** Layar di bawah lebar ini memakai tabel tinggi chef versi HP. */
export const LEBAR_HP = 640
const TINGGI_CHEF: Record<'desktop' | 'hp', Record<PilihanUkuran, number>> = {
  desktop: { kecil: 110, sedang: 140, besar: 180 },
  hp: { kecil: 90, sedang: 110, besar: 130 },
}
export const UKURAN_PANEL: Record<PilihanUkuran, Ukuran> = {
  kecil: { w: 320, h: 480 },
  sedang: { w: 384, h: 576 },
  besar: { w: 448, h: 680 },
}

export const tinggiChef = (pilihan: PilihanUkuran, lebarLayar: number): number =>
  TINGGI_CHEF[lebarLayar < LEBAR_HP ? 'hp' : 'desktop'][pilihan]

const pilihan = (v: unknown): PilihanUkuran | null =>
  (PILIHAN_UKURAN as readonly unknown[]).includes(v) ? (v as PilihanUkuran) : null

/** Setelan dari localStorage; kolom yang rusak/hilang diganti nilai bawaan satu per satu. */
export function bacaSetelan(mentah: string | null): Setelan {
  let v: unknown
  try { v = JSON.parse(mentah ?? 'null') } catch { return SETELAN_BAWAAN }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return SETELAN_BAWAAN
  const o = v as Record<string, unknown>
  return {
    ukuranChef: pilihan(o.ukuranChef) ?? SETELAN_BAWAAN.ukuranChef,
    ukuranPanel: pilihan(o.ukuranPanel) ?? SETELAN_BAWAAN.ukuranPanel,
    animasi: typeof o.animasi === 'boolean' ? o.animasi : SETELAN_BAWAAN.animasi,
    tersembunyi: typeof o.tersembunyi === 'boolean' ? o.tersembunyi : SETELAN_BAWAAN.tersembunyi,
  }
}
