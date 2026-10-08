export type Ukuran = { w: number; h: number }
export type Titik = { x: number; y: number }
export type Kotak = Titik & Ukuran

export const AMBANG_GESER = 5
export const MARGIN_LAYAR = 12
export const JARAK_PANEL = 16
export const MARGIN_PANEL = 16
export const TINGGI_PANEL_MIN = 320
export const UKURAN_TAB = 48

const jepit = (v: number, min: number, maks: number) =>
  Math.min(Math.max(v, min), Math.max(min, maks))

/** Gerakan di bawah ambang tetap dihitung klik biasa, bukan geser */
export const sudahGeser = (dx: number, dy: number): boolean =>
  dx * dx + dy * dy > AMBANG_GESER * AMBANG_GESER

export function jepitPosisi(p: Titik, ukuran: Ukuran, layar: Ukuran): Titik {
  return {
    x: jepit(p.x, MARGIN_LAYAR, layar.w - ukuran.w - MARGIN_LAYAR),
    y: jepit(p.y, MARGIN_LAYAR, layar.h - ukuran.h - MARGIN_LAYAR),
  }
}

export function posisiAwal(ukuran: Ukuran, layar: Ukuran): Titik {
  return jepitPosisi(
    { x: layar.w - ukuran.w - 24, y: layar.h - ukuran.h - 24 },
    ukuran,
    layar
  )
}

/** Ukuran panel obrolan, dijepit agar pas di layar desktop maupun mobile */
export function ukuranPanel(layar: Ukuran, dasar: Ukuran = { w: 390, h: 560 }): Ukuran {
  return {
    w: Math.min(dasar.w, layar.w - 2 * MARGIN_PANEL),
    h: Math.min(dasar.h, Math.max(TINGGI_PANEL_MIN, layar.h - 100)),
  }
}

/** Tab menempel di tepi kanan layar setinggi tengah posisi Nayra terakhir */
export function posisiTab(chef: { y: number; h: number }, layar: Ukuran): Titik {
  return {
    x: layar.w - UKURAN_TAB,
    y: jepit(
      chef.y + chef.h / 2 - UKURAN_TAB / 2,
      MARGIN_LAYAR,
      layar.h - UKURAN_TAB - MARGIN_LAYAR
    ),
  }
}

/** Menghitung posisi pop-up chat panel agar cerdas menempel di sisi Nayra */
export function posisiPanel(chef: Kotak, panel: Ukuran, layar: Ukuran): Kotak {
  const m = MARGIN_PANEL
  const j = JARAK_PANEL
  const keKiri = chef.x + chef.w / 2 > layar.w / 2
  const muat = keKiri
    ? chef.x - j - panel.w >= m
    : chef.x + chef.w + j + panel.w <= layar.w - m

  if (muat) {
    return {
      x: keKiri ? chef.x - j - panel.w : chef.x + chef.w + j,
      y: jepit(chef.y + chef.h - panel.h, m, layar.h - panel.h - m),
      ...panel,
    }
  }

  // Jika di HP / layar sempit, letakkan di tengah
  const x = jepit(chef.x + chef.w / 2 - panel.w / 2, m, layar.w - panel.w - m)
  const diAtas = chef.y + chef.h / 2 > layar.h / 2
  const ruang = diAtas ? chef.y - j - m : layar.h - (chef.y + chef.h + j) - m
  const h = Math.max(Math.min(panel.h, ruang), TINGGI_PANEL_MIN)
  const y = diAtas ? chef.y - j - h : chef.y + chef.h + j

  return { x, y: jepit(y, m, layar.h - h - m), w: panel.w, h }
}
