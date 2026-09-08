/**
 * Gerbang konfirmasi untuk isian "0" saat opname.
 *
 * Definisi yang berlaku (diputuskan owner, 8 September 2026):
 *   - Bahan DIKOSONGKAN  = belum dihitung -> dilewati, saldo sistem tidak berubah.
 *   - Bahan DIISI 0      = sudah dihitung, fisiknya habis -> saldo dijadikan nol.
 *
 * Masalahnya crew memakai "0" untuk keduanya. Pada 5-7 September 2026 tiga
 * outlet mengetik "0 Roll" untuk FOIL padahal barangnya masih ada; Pajajaran
 * kehilangan 75 Roll (~Rp660 rb) dalam satu kali finalisasi, tanpa peringatan.
 *
 * Modul ini hanya menentukan SIAPA yang perlu dikonfirmasi ulang. Ia sengaja
 * tidak tahu apa-apa soal React maupun Supabase supaya bisa diuji sebagai
 * aritmetika biasa.
 */

/** Ambang "stok berarti": 1 satuan menengah (mis. 1 Roll = 760 cm, 1 Kg = 1000 gram). */
function ambangStokBerarti(faktorKonversi?: number | null): number {
  return faktorKonversi && faktorKonversi > 0 ? faktorKonversi : 1
}

/**
 * True kalau crew menandai bahan habis (fisik 0) padahal sistem masih mencatat
 * stok minimal 1 satuan menengah. Sisa recehan di bawah ambang (0,2 tabung gas,
 * 0,1 galon) sengaja dilewatkan supaya modal konfirmasi jarang muncul dan tidak
 * berubah jadi klik refleks.
 *
 * Saldo minus tidak pernah diflag: mengisi 0 pada baris minus justru
 * mengembalikannya ke nol, dan itu memang perbaikan.
 *
 * @param qtyFisik      hasil hitung crew, dalam satuan kecil
 * @param qtySystem     saldo sistem, dalam satuan kecil (sudah sadar skala)
 * @param faktorKonversi satuan kecil per satuan menengah (bahan_baku.faktor_konversi)
 */
export function isSuspiciousZero(
  qtyFisik: number,
  qtySystem: number,
  faktorKonversi?: number | null
): boolean {
  if (qtyFisik !== 0) return false
  return qtySystem >= ambangStokBerarti(faktorKonversi)
}

export interface ZeroGuardCandidate {
  qtyFisik: number
  qtySystem: number
  faktorKonversi?: number | null
}

/** Menyaring daftar item opname, mempertahankan urutan aslinya. */
export function collectSuspiciousZeros<T extends ZeroGuardCandidate>(items: T[]): T[] {
  return items.filter((i) => isSuspiciousZero(i.qtyFisik, i.qtySystem, i.faktorKonversi))
}
