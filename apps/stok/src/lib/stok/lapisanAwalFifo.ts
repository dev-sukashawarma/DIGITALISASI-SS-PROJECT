/**
 * Lapisan saldo awal FIFO vendor: kiriman masuk terakhir SEBELUM periode,
 * ditelusuri mundur (terbaru dulu) sampai menutup saldo awal tiap kunci
 * (outlet|bahan atau bahan).
 *
 * Dulu kueri memakai `.limit(3000)` -- dipotong PostgREST jadi 1000 baris
 * terbaru LINTAS SEMUA bahan, sehingga bahan yang jarang dikirim tidak
 * kebagian lapisan dan vendornya jadi "tidak tercatat". Sekarang kueri
 * berhalaman dan berhenti begitu semua kebutuhan tertutup.
 */

export interface LapisanMasuk {
  qty: number
  vendor: string | null
}

export interface BarisLapisan extends LapisanMasuk {
  kunci: string
}

/**
 * Serap baris (urut terbaru dulu) ke `hasil` selama kunci itu masih butuh.
 * Baris disimpan apa adanya (pemanggil bisa membawa data asal untuk
 * menyelesaikan nama vendor belakangan, hanya untuk baris yang terpakai).
 * `sisa` dimutasi. Kembalikan true bila semua kebutuhan sudah tertutup.
 */
export function serapLapisan<T extends BarisLapisan>(
  sisa: Map<string, number>,
  baris: T[],
  hasil: Map<string, T[]>
): boolean {
  for (const b of baris) {
    const butuh = sisa.get(b.kunci)
    if (butuh === undefined || butuh <= 0.0001) continue
    const list = hasil.get(b.kunci) || []
    list.push(b)
    hasil.set(b.kunci, list)
    sisa.set(b.kunci, butuh - b.qty)
  }
  for (const v of sisa.values()) if (v > 0.0001) return false
  return true
}
