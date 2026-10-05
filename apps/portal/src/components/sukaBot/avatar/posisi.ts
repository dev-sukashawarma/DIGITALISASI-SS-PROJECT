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

export function ukuranPanel(layar: Ukuran): Ukuran {
  return { w: Math.min(384, layar.w - 2 * MARGIN_PANEL), h: Math.min(576, layar.h - 112) }
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
