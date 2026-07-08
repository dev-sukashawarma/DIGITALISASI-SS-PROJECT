/**
 * Format saldo (running balance) sebagai "N {satuan} + M {satuan_kecil}".
 * Kalau satuanKecil/faktorTampilan tidak ada, fallback ke "{qty} {satuan}".
 *
 * Untuk nilai negatif (defisit stok), gunakan Math.trunc agar whole dan
 * remainder konsisten bertanda negatif — mis. -33.1 pcs → "-33 pcs - 0.3 kg"
 * (bukan "-34 pcs + 2.7 kg" dari Math.floor yang membingungkan secara visual).
 */
export function formatCompositeSaldo(
  qty: number,
  satuan: string,
  satuanKecil: string | null,
  faktorTampilan: number | null
): string {
  if (!satuanKecil || !faktorTampilan) {
    // Fallback tanpa tanda '+': saldo = total absolut, beda dari delta (pergerakan bertanda).
    return `${qty} ${satuan}`
  }

  // Gunakan Math.trunc (bukan Math.floor) agar whole selalu bertanda sama dengan qty.
  // Math.floor(-33.1) = -34 (berbeda arah), Math.trunc(-33.1) = -33 (sama arah).
  let whole = Math.trunc(qty)
  const remainderRaw = (qty - whole) * faktorTampilan
  let remainder = Math.round(remainderRaw * 100) / 100

  // Floating-point drift: mis. qty = 2.9999999999 → remainder bisa jadi persis faktorTampilan.
  // Carry ke whole, bukan negatif ke bawah.
  if (Math.abs(remainder) >= faktorTampilan) {
    whole += Math.sign(remainder)
    remainder = 0
  }

  // Separator: '+' jika remainder >= 0 (termasuk 0), '-' jika remainder negatif.
  const separator = remainder < 0 ? '-' : '+'
  const absRemainder = Math.abs(remainder)
  return `${whole} ${satuan} ${separator} ${absRemainder} ${satuanKecil}`
}

/**
 * Format qty pergerakan (delta) langsung dalam satuan kecil, karena angkanya
 * biasanya kecil (hasil BOM automation) dan lebih masuk akal drpd pecahan
 * satuan besar (mis. "-0.03 kompan" -> "-480 ml").
 */
export function formatCompositeDelta(
  qty: number,
  satuan: string,
  satuanKecil: string | null,
  faktorTampilan: number | null
): string {
  if (!satuanKecil || !faktorTampilan) {
    return `${qty > 0 ? '+' : ''}${qty} ${satuan}`
  }
  const converted = Math.round(qty * faktorTampilan * 100) / 100
  return `${converted > 0 ? '+' : ''}${converted} ${satuanKecil}`
}

/**
 * Gabung input 2-field opname (kontainer utuh + sisa dalam satuan kecil)
 * jadi satu qty_fisik desimal dalam satuan besar.
 *
 * Asumsi: faktorTampilan > 0 (dijamin `CHECK (faktor_tampilan > 0)` di DB).
 */
export function combineOpnameInput(
  containers: number,
  remainder: number,
  faktorTampilan: number
): number {
  return containers + remainder / faktorTampilan
}
