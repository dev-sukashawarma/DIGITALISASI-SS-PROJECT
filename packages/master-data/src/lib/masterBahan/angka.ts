/**
 * Parser angka Indonesia untuk input harga/kuantitas ("11.554" = 11554, bukan 11,554).
 *
 * Aturan (lihat fix-report Task 4, coordinator ruling):
 *   - trim; buang spasi & prefiks "Rp"/"rp" di depan; kosong → null
 *   - ada '.' DAN ',' → '.' = pemisah ribuan (dibuang), ',' = desimal (→ '.')
 *   - hanya ',' → koma desimal (→ '.'); lebih dari satu ',' → null
 *   - hanya '.' → pola /^[1-9]\d{0,2}(\.\d{3})+$/ dianggap ribuan ("11.554"→11554,
 *     "1.000.000"→1000000); grup pertama TIDAK boleh diawali 0 (menutup celah "0.500"
 *     dibaca sebagai 500 alih-alih 0,5) — selain itu '.' tunggal = titik desimal
 *     ("1.5"→1.5, "0.25"→0.25, "0.500"→0.5)
 *   - karakter lain, atau hasil bukan angka berhingga → null
 *   - negatif tidak diizinkan (harga/qty di modul ini tak pernah negatif) → null
 */
export function bacaAngka(s: string): number | null {
  let t = s.trim().replace(/^rp\s*/i, '').replace(/\s+/g, '')
  if (t === '') return null
  if (!/^[\d.,]+$/.test(t)) return null

  const jumlahTitik = (t.match(/\./g) ?? []).length
  const jumlahKoma = (t.match(/,/g) ?? []).length
  const polaRibuan = /^[1-9]\d{0,2}(\.\d{3})+$/

  if (jumlahTitik > 0 && jumlahKoma > 0) {
    if (jumlahKoma > 1) return null
    t = t.replace(/\./g, '').replace(',', '.')
  } else if (jumlahKoma > 0) {
    if (jumlahKoma > 1) return null
    t = t.replace(',', '.')
  } else if (jumlahTitik > 0) {
    if (jumlahTitik > 1 && !polaRibuan.test(t)) return null
    if (polaRibuan.test(t)) t = t.replace(/\./g, '')
    // else: '.' tunggal bukan pola ribuan → titik desimal, dibiarkan apa adanya
  }

  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Format angka untuk pra-isi kolom input, gaya Indonesia TANPA pemisah ribuan
 * (supaya round-trip aman lewat bacaAngka): integer → "1000", desimal → koma
 * ("2,125"). null/undefined → "" (kolom kosong, bukan "null"/"undefined").
 */
export function tulisAngka(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

/**
 * Isian angka opsional dengan bawaan (batas minimum, harga awal, dll):
 *   - kosong (setelah trim) → { nilai: bawaan, invalid: false }
 *   - terisi & terbaca → { nilai, invalid: false }
 *   - terisi tapi tak terbaca → { nilai: null, invalid: true } — TIDAK diam-diam
 *     jatuh ke bawaan; pemanggil wajib menahan submit lewat `invalid`.
 */
export function bacaIsian(teks: string, bawaan: number | null): { nilai: number | null; invalid: boolean } {
  const t = teks.trim()
  if (t === '') return { nilai: bawaan, invalid: false }
  const n = bacaAngka(t)
  if (n === null) return { nilai: null, invalid: true }
  return { nilai: n, invalid: false }
}
