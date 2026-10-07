// Helper murni untuk menggeser widget Bot HRD (tanpa DOM, mudah diuji).

export type Titik = { x: number; y: number }
export type Ukuran = { lebar: number; tinggi: number }

export const AMBANG_GESER = 5
export const MARGIN_LAYAR = 8
export const KUNCI_POSISI = 'botHrd.posisi'

/** Jepit posisi (pojok kiri-atas) supaya seluruh elemen tetap di dalam layar. */
export function jepitKeLayar(pos: Titik, ukuran: Ukuran, layar: Ukuran, margin = MARGIN_LAYAR): Titik {
  const maksX = Math.max(margin, layar.lebar - ukuran.lebar - margin)
  const maksY = Math.max(margin, layar.tinggi - ukuran.tinggi - margin)
  return {
    x: Math.min(Math.max(pos.x, margin), maksX),
    y: Math.min(Math.max(pos.y, margin), maksY),
  }
}

/** Posisi baru elemen = posisi awal elemen + selisih gerak pointer. */
export function posisiDariPointer(awalPointer: Titik, awalElemen: Titik, pointer: Titik): Titik {
  return { x: awalElemen.x + (pointer.x - awalPointer.x), y: awalElemen.y + (pointer.y - awalPointer.y) }
}

/** Apakah pointer sudah bergerak cukup jauh untuk dianggap geser (bukan klik)? */
export function lewatAmbang(awal: Titik, sekarang: Titik, ambang = AMBANG_GESER): boolean {
  return Math.hypot(sekarang.x - awal.x, sekarang.y - awal.y) >= ambang
}

/**
 * Letak panel di dekat tombol: sisi kanan panel sejajar tombol, panel di atas tombol;
 * dibalik ke bawah bila tak muat di atas, lalu dijepit ke layar.
 */
export function posisiPanelDekatTombol(
  tombol: Titik,
  ukuranTombol: Ukuran,
  ukuranPanel: Ukuran,
  layar: Ukuran,
  margin = MARGIN_LAYAR,
  jarak = 12,
): Titik {
  const x = tombol.x + ukuranTombol.lebar - ukuranPanel.lebar
  const diAtas = tombol.y - jarak - ukuranPanel.tinggi
  const y = diAtas >= margin ? diAtas : tombol.y + ukuranTombol.tinggi + jarak
  return jepitKeLayar({ x, y }, ukuranPanel, layar, margin)
}

type Simpanan = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined

export function parsePosisi(mentah: string | null | undefined): Titik | null {
  if (!mentah) return null
  try {
    const o = JSON.parse(mentah) as Partial<Titik> | null
    if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) return { x: o.x as number, y: o.y as number }
  } catch {
    // abaikan data rusak
  }
  return null
}

export function bacaPosisi(s: Simpanan, kunci = KUNCI_POSISI): Titik | null {
  try {
    return parsePosisi(s?.getItem(kunci))
  } catch {
    return null
  }
}

export function simpanPosisi(s: Simpanan, pos: Titik, kunci = KUNCI_POSISI): void {
  try {
    s?.setItem(kunci, JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) }))
  } catch {
    // penyimpanan penuh / diblokir
  }
}

export const KUNCI_BESAR = 'botHrd.besar'

export function bacaBesar(s: Simpanan, kunci = KUNCI_BESAR): boolean {
  try {
    return s?.getItem(kunci) === '1'
  } catch {
    return false
  }
}

export function simpanBesar(s: Simpanan, besar: boolean, kunci = KUNCI_BESAR): void {
  try {
    s?.setItem(kunci, besar ? '1' : '0')
  } catch {
    // diblokir
  }
}

/** Ukuran panel desktop: normal 440x600, besar min(900,lebar-2rem) x min(85vh,tinggi-2rem). */
export function ukuranPanel(besar: boolean, layar: Ukuran): Ukuran {
  if (besar) {
    return { lebar: Math.min(900, layar.lebar - 32), tinggi: Math.min(layar.tinggi * 0.85, layar.tinggi - 32) }
  }
  return { lebar: Math.min(440, layar.lebar - 16), tinggi: Math.min(600, layar.tinggi - 32) }
}
