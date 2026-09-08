export type BoardRow = {
  outletId: string
  outletName: string
  pcsToday: number
  trxToday: number
  omzetToday: number
  /** null = baseline tak tersedia (bulan pembanding di bawah lantai data). */
  pcsBase: number | null
  trxBase: number | null
  omzetBase: number | null
}

export type BoardPayload = {
  /** Tanggal WIB, YYYY-MM-DD (tanggal data yang ditampilkan). */
  date: string
  /** Jam WIB 0-23; batas atas potongan perbandingan. */
  hour: number
  /** Mis. "rata-rata Kamis Agustus". */
  baseLabel: string
  /** Jumlah kemunculan kalender hari-yang-sama yang jadi pembagi. 0 = tak tersedia. */
  baseDivisor: number
  /** ISO instant saat payload dibuat; klien memakainya untuk umur data. */
  generatedAt: string
  rows: BoardRow[]
  /** True jika hari ini belum ada penjualan (belum buka) sehingga menampilkan data kemarin. */
  isYesterday?: boolean
  /** Tanggal kemarin (YYYY-MM-DD) */
  yesterdayDate?: string
  /** Label ramah manusia tanggal kemarin, mis. "Jumat, 4 September 2026" */
  yesterdayLabel?: string
  /** Tanggal hari ini (YYYY-MM-DD) */
  todayDate?: string
}
