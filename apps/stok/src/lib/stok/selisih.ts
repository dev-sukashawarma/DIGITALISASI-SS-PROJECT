export function computeSelisih(qtyFisik: number | null, qtySystem: number): number {
  return (qtyFisik ?? 0) - qtySystem
}

const MEASURABLE_UNITS = ['gram', 'ml', 'kg', 'liter']

/**
 * Menentukan apakah selisih opname perlu di-flag (butuh approval leader).
 *
 * Aturan threshold:
 * - Item TIMBANG (satuan atau satuan_kecil = gram/ml/kg/liter) → toleransi 5%
 *   Contoh: AYAM (kg), SAPI (blok+gram), MINYAK (kompan+ml)
 * - Item HITUNG / countable (pcs, pack, blok murni, dll)        → toleransi 0%
 *   Apapun selisihnya langsung flag.
 *
 * @param selisih     Hasil computeSelisih (fisik - sistem)
 * @param qtySystem   Saldo sistem saat opname
 * @param satuan      Satuan utama bahan (mis: 'kg', 'pcs', 'blok')
 * @param satuanKecil Satuan kecil bahan (mis: 'gram', 'lembar') — opsional
 */
export function isSelisihFlagged(
  selisih: number,
  qtySystem: number,
  satuan?: string,
  satuanKecil?: string | null,
): boolean {
  if (qtySystem === 0) return false;

  let threshold = 0.0; // default: countable (0%)

  if (satuan) {
    const s = satuan.toLowerCase();
    const sk = satuanKecil?.toLowerCase() ?? '';

    if (MEASURABLE_UNITS.includes(s)) {
      // Satuan utama sudah timbang (kg, gram, liter, ml) → 5%
      threshold = 0.05;
    } else if (MEASURABLE_UNITS.includes(sk)) {
      // Satuan utama countable TAPI satuan kecilnya timbang
      // Contoh: SAPI (blok + gram), GAS (pcs + gram → tetap 0% karena dihitung per tabung)
      // Hanya berlaku jika satuan_kecil adalah gram/ml/liter dan satuan utama BUKAN pcs
      if (['gram', 'ml', 'liter'].includes(sk) && s !== 'pcs') {
        threshold = 0.05;
      }
    }
  } else {
    // Fallback jika satuan tidak disediakan
    threshold = 0.15;
  }

  const baseQty = Math.abs(qtySystem);
  return Math.abs(selisih) > threshold * baseQty;
}
