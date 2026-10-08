import type { Ukuran } from './posisi'

export type SetelanNayra = {
  tinggiNayra: number | null
  lebarPanel: number | null
  tinggiPanel: number | null
  animasi: boolean
  tersembunyi: boolean
}

export const SETELAN_BAWAAN: SetelanNayra = {
  tinggiNayra: null,
  lebarPanel: null,
  tinggiPanel: null,
  animasi: true,
  tersembunyi: false,
}

export const TINGGI_MIN = 80
export const TINGGI_MAKS = 380
export const LANGKAH_TINGGI = 5
export const LEBAR_HP = 640
const TINGGI_OTOMATIS = { desktop: 145, hp: 105 }
const PORSI_LAYAR_MAKS = 0.65

export const LEBAR_PANEL = { min: 320, maks: 600, bawaan: 400 }
export const TINGGI_PANEL = { min: 420, maks: 850, bawaan: 560 }

export const tinggiOtomatis = (lebarLayar: number): number =>
  lebarLayar < LEBAR_HP ? TINGGI_OTOMATIS.hp : TINGGI_OTOMATIS.desktop

export function tinggiNayraEfektif(pilihan: number | null, layar: Ukuran): number {
  const maks = Math.min(TINGGI_MAKS, Math.floor(layar.h * PORSI_LAYAR_MAKS))
  return Math.max(TINGGI_MIN, Math.min(pilihan ?? tinggiOtomatis(layar.w), maks))
}

export function batasSliderNayra(layar: Ukuran): number {
  return Math.max(TINGGI_MIN, Math.min(TINGGI_MAKS, Math.floor(layar.h * PORSI_LAYAR_MAKS)))
}

export const ukuranPanelPilihan = (s: SetelanNayra): Ukuran => ({
  w: s.lebarPanel ?? LEBAR_PANEL.bawaan,
  h: s.tinggiPanel ?? TINGGI_PANEL.bawaan,
})

const angkaDalam = (v: unknown, min: number, maks: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= maks ? Math.round(v) : null

export function bacaSetelan(mentah: string | null): SetelanNayra {
  let v: unknown
  try {
    v = JSON.parse(mentah ?? 'null')
  } catch {
    return SETELAN_BAWAAN
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return SETELAN_BAWAAN
  const o = v as Record<string, unknown>
  return {
    tinggiNayra: angkaDalam(o.tinggiNayra, TINGGI_MIN, TINGGI_MAKS),
    lebarPanel: angkaDalam(o.lebarPanel, LEBAR_PANEL.min, LEBAR_PANEL.maks),
    tinggiPanel: angkaDalam(o.tinggiPanel, TINGGI_PANEL.min, TINGGI_PANEL.maks),
    animasi: typeof o.animasi === 'boolean' ? o.animasi : SETELAN_BAWAAN.animasi,
    tersembunyi: typeof o.tersembunyi === 'boolean' ? o.tersembunyi : SETELAN_BAWAAN.tersembunyi,
  }
}
