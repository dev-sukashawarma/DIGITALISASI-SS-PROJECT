import type { Ukuran } from './posisi'

export type PilihanUkuran = 'kecil' | 'sedang' | 'besar'
/** tinggiChef null = otomatis (ikut lebar layar). */
export type Setelan = { tinggiChef: number | null; ukuranPanel: PilihanUkuran; animasi: boolean; tersembunyi: boolean }

export const SETELAN_BAWAAN: Setelan = { tinggiChef: null, ukuranPanel: 'sedang', animasi: true, tersembunyi: false }
export const PILIHAN_UKURAN: readonly PilihanUkuran[] = ['kecil', 'sedang', 'besar']

export const TINGGI_MIN = 80
export const TINGGI_MAKS = 260
export const LANGKAH_TINGGI = 5
/** Layar di bawah lebar ini memakai tinggi otomatis versi HP. */
export const LEBAR_HP = 640
const TINGGI_OTOMATIS = { desktop: 140, hp: 110 }
/** Chef tidak boleh lebih tinggi dari porsi layar ini, berapa pun pilihan pengguna. */
const PORSI_LAYAR_MAKS = 0.6

export const UKURAN_PANEL: Record<PilihanUkuran, Ukuran> = {
  kecil: { w: 320, h: 480 },
  sedang: { w: 384, h: 576 },
  besar: { w: 448, h: 680 },
}

export const tinggiOtomatis = (lebarLayar: number): number =>
  lebarLayar < LEBAR_HP ? TINGGI_OTOMATIS.hp : TINGGI_OTOMATIS.desktop

/** Tinggi chef yang dipakai: pilihan pengguna (atau otomatis), dibatasi agar muat di layar. */
export function tinggiChefEfektif(pilihan: number | null, layar: Ukuran): number {
  const maks = Math.min(TINGGI_MAKS, Math.floor(layar.h * PORSI_LAYAR_MAKS))
  return Math.max(TINGGI_MIN, Math.min(pilihan ?? tinggiOtomatis(layar.w), maks))
}

const pilihanUkuran = (v: unknown): PilihanUkuran | null =>
  (PILIHAN_UKURAN as readonly unknown[]).includes(v) ? (v as PilihanUkuran) : null

const tinggiSah = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= TINGGI_MIN && v <= TINGGI_MAKS ? Math.round(v) : null

/** Setelan dari localStorage; kolom yang rusak/hilang diganti nilai bawaan satu per satu. */
export function bacaSetelan(mentah: string | null): Setelan {
  let v: unknown
  try { v = JSON.parse(mentah ?? 'null') } catch { return SETELAN_BAWAAN }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return SETELAN_BAWAAN
  const o = v as Record<string, unknown>
  return {
    tinggiChef: tinggiSah(o.tinggiChef),
    ukuranPanel: pilihanUkuran(o.ukuranPanel) ?? SETELAN_BAWAAN.ukuranPanel,
    animasi: typeof o.animasi === 'boolean' ? o.animasi : SETELAN_BAWAAN.animasi,
    tersembunyi: typeof o.tersembunyi === 'boolean' ? o.tersembunyi : SETELAN_BAWAAN.tersembunyi,
  }
}
