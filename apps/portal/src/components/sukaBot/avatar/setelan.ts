import type { Ukuran } from './posisi'

/** null = otomatis (chef ikut lebar layar; kotak chat 384x576). */
export type Setelan = {
  tinggiChef: number | null
  lebarPanel: number | null
  tinggiPanel: number | null
  animasi: boolean
  tersembunyi: boolean
}

export const SETELAN_BAWAAN: Setelan = { tinggiChef: null, lebarPanel: null, tinggiPanel: null, animasi: true, tersembunyi: false }

export const TINGGI_MIN = 80
/** Aset WebM 520 px: tajam sampai 400 px di monitor biasa, sedikit lembut di atas ±260 px pada layar 2x. */
export const TINGGI_MAKS = 400
export const LANGKAH_TINGGI = 5
/** Layar di bawah lebar ini memakai tinggi otomatis versi HP. */
export const LEBAR_HP = 640
const TINGGI_OTOMATIS = { desktop: 385, hp: 110 }
/** Chef tidak boleh lebih tinggi dari porsi layar ini, berapa pun pilihan pengguna. */
const PORSI_LAYAR_MAKS = 0.6

export const LEBAR_PANEL = { min: 300, maks: 640, bawaan: 384 }
export const TINGGI_PANEL = { min: 400, maks: 900, bawaan: 576 }
export const LANGKAH_PANEL = 10
/** Ruang yang disisakan di sekitar kotak chat (harus sama dengan `ukuranPanel` di posisi.ts). */
const SISA_LEBAR = 32
const SISA_TINGGI = 112

/** Pilihan lama (Kecil/Sedang/Besar) → angka yang sama, agar setelan pengguna tidak hilang. */
const PANEL_LAMA: Record<string, Ukuran | null> = { kecil: { w: 320, h: 480 }, sedang: null, besar: { w: 448, h: 680 } }

export const tinggiOtomatis = (lebarLayar: number): number =>
  lebarLayar < LEBAR_HP ? TINGGI_OTOMATIS.hp : TINGGI_OTOMATIS.desktop

/** Tinggi chef yang dipakai: pilihan pengguna (atau otomatis), dibatasi agar muat di layar. */
export function tinggiChefEfektif(pilihan: number | null, layar: Ukuran): number {
  const maks = Math.min(TINGGI_MAKS, Math.floor(layar.h * PORSI_LAYAR_MAKS))
  return Math.max(TINGGI_MIN, Math.min(pilihan ?? tinggiOtomatis(layar.w), maks))
}

/** Ukuran kotak chat pilihan pengguna (sebelum dijepit layar oleh `ukuranPanel`). */
export const ukuranPanelPilihan = (s: Setelan): Ukuran => ({
  w: s.lebarPanel ?? LEBAR_PANEL.bawaan,
  h: s.tinggiPanel ?? TINGGI_PANEL.bawaan,
})

/** Batas atas slider kotak chat untuk layar ini. */
export function batasSliderPanel(layar: Ukuran): { lebarMaks: number; tinggiMaks: number } {
  return {
    lebarMaks: Math.max(LEBAR_PANEL.min, Math.min(LEBAR_PANEL.maks, layar.w - SISA_LEBAR)),
    tinggiMaks: Math.max(TINGGI_PANEL.min, Math.min(TINGGI_PANEL.maks, layar.h - SISA_TINGGI)),
  }
}

const angkaDalam = (v: unknown, min: number, maks: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= maks ? Math.round(v) : null

/** Setelan dari localStorage; kolom yang rusak/hilang diganti nilai bawaan satu per satu. */
export function bacaSetelan(mentah: string | null): Setelan {
  let v: unknown
  try { v = JSON.parse(mentah ?? 'null') } catch { return SETELAN_BAWAAN }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return SETELAN_BAWAAN
  const o = v as Record<string, unknown>
  const lama = typeof o.ukuranPanel === 'string' ? PANEL_LAMA[o.ukuranPanel] ?? null : null
  return {
    tinggiChef: angkaDalam(o.tinggiChef, TINGGI_MIN, TINGGI_MAKS),
    lebarPanel: angkaDalam(o.lebarPanel, LEBAR_PANEL.min, LEBAR_PANEL.maks) ?? lama?.w ?? null,
    tinggiPanel: angkaDalam(o.tinggiPanel, TINGGI_PANEL.min, TINGGI_PANEL.maks) ?? lama?.h ?? null,
    animasi: typeof o.animasi === 'boolean' ? o.animasi : SETELAN_BAWAAN.animasi,
    tersembunyi: typeof o.tersembunyi === 'boolean' ? o.tersembunyi : SETELAN_BAWAAN.tersembunyi,
  }
}
