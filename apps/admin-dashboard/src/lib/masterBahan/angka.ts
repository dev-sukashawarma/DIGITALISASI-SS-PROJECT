/**
 * Parser angka Indonesia untuk input harga/kuantitas ("11.554" = 11554, bukan 11,554).
 *
 * Aturan (lihat fix-report Task 4, coordinator ruling):
 *   - trim; buang spasi & prefiks "Rp"/"rp" di depan; kosong → null
 *   - ada '.' DAN ',' → '.' = pemisah ribuan (dibuang), ',' = desimal (→ '.')
 *   - hanya ',' → koma desimal (→ '.'); lebih dari satu ',' → null
 *   - hanya '.' → pola /^\d{1,3}(\.\d{3})+$/ dianggap ribuan ("11.554"→11554,
 *     "1.000.000"→1000000); selain itu '.' tunggal = titik desimal ("1.5"→1.5, "0.25"→0.25)
 *   - karakter lain, atau hasil bukan angka berhingga → null
 *   - negatif tidak diizinkan (harga/qty di modul ini tak pernah negatif) → null
 */
export function bacaAngka(s: string): number | null {
  let t = s.trim().replace(/^rp\s*/i, '').replace(/\s+/g, '')
  if (t === '') return null
  if (!/^[\d.,]+$/.test(t)) return null

  const jumlahTitik = (t.match(/\./g) ?? []).length
  const jumlahKoma = (t.match(/,/g) ?? []).length

  if (jumlahTitik > 0 && jumlahKoma > 0) {
    if (jumlahKoma > 1) return null
    t = t.replace(/\./g, '').replace(',', '.')
  } else if (jumlahKoma > 0) {
    if (jumlahKoma > 1) return null
    t = t.replace(',', '.')
  } else if (jumlahTitik > 0) {
    if (jumlahTitik > 1 && !/^\d{1,3}(\.\d{3})+$/.test(t)) return null
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
    // else: '.' tunggal bukan pola ribuan → titik desimal, dibiarkan apa adanya
  }

  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
