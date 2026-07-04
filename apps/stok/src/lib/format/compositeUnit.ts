/**
 * Format saldo (running balance) sebagai "N {satuan} + M {satuan_kecil}".
 * Kalau satuanKecil/faktorTampilan tidak ada, fallback ke "{qty} {satuan}".
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
  let whole = Math.floor(qty)
  const remainderRaw = (qty - whole) * faktorTampilan
  let remainder = Math.round(remainderRaw * 100) / 100
  // Floating-point drift (mis. qty = 2.9999999999) bisa bikin whole floor turun
  // tapi remainder dibulatkan naik jadi persis faktorTampilan. Carry-kan.
  if (remainder >= faktorTampilan) {
    whole += 1
    remainder = 0
  }
  return `${whole} ${satuan} + ${remainder} ${satuanKecil}`
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
