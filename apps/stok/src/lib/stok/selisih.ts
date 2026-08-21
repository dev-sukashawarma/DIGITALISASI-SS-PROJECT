export function computeSelisih(qtyFisik: number | null, qtySystem: number): number {
  return (qtyFisik ?? 0) - qtySystem
}

const MEASURABLE_UNITS = ['gram', 'ml', 'kg', 'liter']

/**
 * Mengambil nilai persentase threshold / batas toleransi untuk suatu bahan.
 * - Satuan timbang/ukur (gram, kg, ml, liter) → 5%
 * - Satuan hitung / countable (pcs, pack, box, dll) → 0%
 * - Fallback jika satuan tidak disediakan → 15%
 */
export function getThresholdPersen(
  satuan?: string,
  satuanKecil?: string | null,
): number {
  if (!satuan) return 15;

  const s = satuan.toLowerCase();
  const sk = satuanKecil?.toLowerCase() ?? '';

  if (MEASURABLE_UNITS.includes(s)) {
    // Satuan utama sudah timbang (kg, gram, liter, ml) → 5%
    return 5;
  } else if (MEASURABLE_UNITS.includes(sk)) {
    // Satuan utama countable TAPI satuan kecilnya timbang
    // Contoh: SAPI (blok + gram), GAS (pcs + gram → tetap 0% karena dihitung per tabung)
    // Hanya berlaku jika satuan_kecil adalah gram/ml/liter dan satuan utama BUKAN pcs
    if (['gram', 'ml', 'liter'].includes(sk) && s !== 'pcs') {
      return 5;
    }
  }

  return 0;
}

export interface SelisihPersenResult {
  persen: number;
  formatted: string;
  isLoss: boolean;
  isSurplus: boolean;
  isZero: boolean;
}

/**
 * Menghitung persentase loss / selisih terhadap stok sistem.
 *
 * @param selisih    Hasil computeSelisih (fisik - sistem)
 * @param qtySystem  Saldo sistem saat opname
 */
export function computeSelisihPersen(
  selisih: number,
  qtySystem: number,
): SelisihPersenResult {
  if (qtySystem === 0) {
    if (selisih === 0) {
      return { persen: 0, formatted: '0.0%', isLoss: false, isSurplus: false, isZero: true };
    }
    if (selisih > 0) {
      return { persen: 100, formatted: '+100.0%', isLoss: false, isSurplus: true, isZero: false };
    }
    return { persen: -100, formatted: '-100.0%', isLoss: true, isSurplus: false, isZero: false };
  }

  const ratio = (selisih / Math.abs(qtySystem)) * 100;
  const rounded = Math.round(ratio * 10) / 10;
  const formatted = (ratio > 0 ? '+' : '') + rounded.toFixed(1) + '%';

  return {
    persen: rounded,
    formatted,
    isLoss: selisih < 0,
    isSurplus: selisih > 0,
    isZero: selisih === 0,
  };
}

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
  if (qtySystem === 0) return selisih !== 0;

  const threshold = getThresholdPersen(satuan, satuanKecil) / 100;
  const baseQty = Math.abs(qtySystem);
  return Math.abs(selisih) > threshold * baseQty;
}
