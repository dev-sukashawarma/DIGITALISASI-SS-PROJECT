export type Ukuran = { w: number; h: number }
export type Titik = { x: number; y: number }
export type Kotak = Titik & Ukuran

export const AMBANG_GESER = 5
export const MARGIN_LAYAR = 8
export const JARAK_PANEL = 12
export const MARGIN_PANEL = 16
export const TINGGI_PANEL_MIN = 280

const jepit = (v: number, min: number, maks: number) => Math.min(Math.max(v, min), Math.max(min, maks))

/** Gerakan di bawah ambang tetap dihitung klik, bukan geser. */
export const sudahGeser = (dx: number, dy: number): boolean => dx * dx + dy * dy > AMBANG_GESER * AMBANG_GESER

export function jepitPosisi(p: Titik, ukuran: Ukuran, layar: Ukuran): Titik {
  return {
    x: jepit(p.x, MARGIN_LAYAR, layar.w - ukuran.w - MARGIN_LAYAR),
    y: jepit(p.y, MARGIN_LAYAR, layar.h - ukuran.h - MARGIN_LAYAR),
  }
}

export function posisiAwal(ukuran: Ukuran, layar: Ukuran): Titik {
  return jepitPosisi({ x: layar.w - ukuran.w - 16, y: layar.h - ukuran.h - 16 }, ukuran, layar)
}

/** Ukuran panel = ukuran pilihan (bawaan 384x576), dijepit agar muat di layar. */
export function ukuranPanel(layar: Ukuran, dasar: Ukuran = { w: 384, h: 576 }): Ukuran {
  return { w: Math.min(dasar.w, layar.w - 2 * MARGIN_PANEL), h: Math.min(dasar.h, layar.h - 112) }
}

/** Sisi tab kecil pengganti chef saat disembunyikan. */
export const UKURAN_TAB = 44

/** Tab menempel di tepi kanan layar, setinggi tengah chef terakhir. */
export function posisiTab(chef: { y: number; h: number }, layar: Ukuran): Titik {
  return { x: layar.w - UKURAN_TAB, y: jepit(chef.y + chef.h / 2 - UKURAN_TAB / 2, MARGIN_LAYAR, layar.h - UKURAN_TAB - MARGIN_LAYAR) }
}

/** Panel di sisi chef yang menghadap tengah layar; bila tak muat (HP), di atas/bawah chef. */
export function posisiPanel(chef: Kotak, panel: Ukuran, layar: Ukuran): Kotak {
  const m = MARGIN_PANEL
  const j = JARAK_PANEL
  const keKiri = chef.x + chef.w / 2 > layar.w / 2
  const muat = keKiri ? chef.x - j - panel.w >= m : chef.x + chef.w + j + panel.w <= layar.w - m
  if (muat) {
    return {
      x: keKiri ? chef.x - j - panel.w : chef.x + chef.w + j,
      y: jepit(chef.y + chef.h - panel.h, m, layar.h - panel.h - m),
      ...panel,
    }
  }
  const x = jepit(chef.x + chef.w / 2 - panel.w / 2, m, layar.w - panel.w - m)
  const diAtas = chef.y + chef.h / 2 > layar.h / 2
  const ruang = diAtas ? chef.y - j - m : layar.h - (chef.y + chef.h + j) - m
  const h = Math.max(Math.min(panel.h, ruang), TINGGI_PANEL_MIN)
  const y = diAtas ? chef.y - j - h : chef.y + chef.h + j
  return { x, y: jepit(y, m, layar.h - h - m), w: panel.w, h }
}
