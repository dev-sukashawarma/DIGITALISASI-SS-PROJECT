export function computeSelisih(qtyFisik: number | null, qtySystem: number): number {
  return (qtyFisik ?? 0) - qtySystem
}

const MEASURABLE_UNITS = ['gram', 'ml', 'kg', 'liter']

/** Toleransi default barang BULK non-susut (timbang/ukur) berbasis Stok Sistem -- keputusan owner 22 Sep 2026. */
export const THRESHOLD_BULK_PERSEN = 20

/**
 * Aturan penyusutan berbasis Pemakaian POS (Opsi A):
 * - Stok Sistem buku tetap murni (1x POS).
 * - Batas defisit (loss) yang ditoleransi dihitung dari asumsi penyusutan berat mentah:
 *   berat matang = (1 - s) * berat mentah  =>  maks pemakaian aktual = POS / (1 - s)
 *   sehingga batas maksimum selisih minus = POS * s / (1 - s).
 * - Surplus (fisik > stok sistem 1x POS) untuk bahan susut dipatok ketat 0% (langsung flag).
 */
export interface AturanSusutPos {
  /** Persentase penyusutan dari berat mentah (mis. 50 = susut 50% -> maks 2x POS). */
  susutPersen: number
  /** Pengali maksimum pemakaian aktual terhadap POS: 1 / (1 - s). */
  faktorMaksPos: number
  /** Rasio maksimum loss terhadap Pemakaian POS: s / (1 - s). */
  rasioLossMaksPos: number
}

function buatAturanSusut(susutPersen: number): AturanSusutPos {
  const s = susutPersen / 100
  return {
    susutPersen,
    faktorMaksPos: 1 / (1 - s),
    rasioLossMaksPos: s / (1 - s),
  }
}

export const SUSUT_POS_AYAM_SAPI_PERSEN = 50
export const SUSUT_POS_KENTANG_PERSEN = 20
export const SUSUT_POS_SAOS_PERSEN = 15

const ATURAN_SUSUT_AYAM_SAPI = buatAturanSusut(SUSUT_POS_AYAM_SAPI_PERSEN)
const ATURAN_SUSUT_KENTANG = buatAturanSusut(SUSUT_POS_KENTANG_PERSEN)
const ATURAN_SUSUT_SAOS = buatAturanSusut(SUSUT_POS_SAOS_PERSEN)

const SELISIH_ZERO_EPS = 0.01
const FLOAT_EPS = 1e-6

/**
 * Mengembalikan aturan penyusutan berbasis Pemakaian POS untuk 4 kelompok bahan:
 * - AYAM (50% susut -> maks 2,0x POS / loss maks 100% POS)
 * - SAPI (50% susut -> maks 2,0x POS / loss maks 100% POS)
 * - KENTANG (20% susut -> maks 1,25x POS / loss maks 25% POS)
 * - Semua varian SAOS* (15% susut -> maks ~1,18x POS / loss maks ~17,65% POS)
 *
 * Bahan lain (termasuk MAYONAISE, SAYUR, MINYAK, bumbu lain, dan bahan countable)
 * mengembalikan null sehingga memakai aturan lama (20% stok sistem / 0% count).
 */
export function getAturanSusutPos(nama?: string | null): AturanSusutPos | null {
  if (!nama) return null
  const upper = nama.trim().toUpperCase()
  if (!upper) return null

  if (upper === 'AYAM' || upper.startsWith('AYAM ')) return ATURAN_SUSUT_AYAM_SAPI
  if (upper === 'SAPI' || upper.startsWith('SAPI ')) return ATURAN_SUSUT_AYAM_SAPI
  if (upper === 'KENTANG' || upper.startsWith('KENTANG ')) return ATURAN_SUSUT_KENTANG
  if (
    upper === 'SAOS' ||
    upper.startsWith('SAOS ') ||
    upper === 'SAUS' ||
    upper.startsWith('SAUS ')
  ) {
    return ATURAN_SUSUT_SAOS
  }

  return null
}

/**
 * Menghitung batas maksimum defisit/loss (qty positif, satuan kecil) dari Pemakaian POS
 * berdasarkan aturan penyusutan dari berat mentah: POS * s / (1 - s).
 */
export function hitungBatasLossPos(pakaiPosQty: number, aturan: AturanSusutPos): number {
  const pos = Math.max(0, Number(pakaiPosQty) || 0)
  return pos * aturan.rasioLossMaksPos
}

/**
 * Menghitung persentase penyusutan aktual dari berat mentah:
 *   susut% = |selisih| / (pakaiPosQty + |selisih|) * 100
 * Mengembalikan null bila selisih tidak negatif (pas atau surplus).
 * Mengembalikan 100 bila ada defisit saat pakaiPosQty <= 0.
 */
export function hitungSusutAktualPersen(
  selisih: number,
  pakaiPosQty: number,
): number | null {
  if (selisih >= -SELISIH_ZERO_EPS) return null
  const loss = Math.abs(selisih)
  const pos = Math.max(0, Number(pakaiPosQty) || 0)
  if (pos <= 0) return 100
  return Math.round((loss / (pos + loss)) * 1000) / 10
}

/**
 * Mengambil nilai persentase threshold / batas toleransi untuk suatu bahan.
 * - Bahan susut berbasis POS: AYAM & SAPI 50%, KENTANG 20%, varian SAOS* 15%
 * - Satuan timbang/ukur lain (gram, kg, ml, liter) → 20% (BULK, berbasis stok sistem)
 * - Satuan hitung / countable (pcs, pack, box, dll) → 0% (COUNT)
 * - Fallback jika satuan tidak disediakan → 15%
 */
export function getThresholdPersen(
  satuan?: string,
  satuanKecil?: string | null,
  nama?: string | null,
): number {
  const susutPos = getAturanSusutPos(nama)
  if (susutPos) return susutPos.susutPersen

  if (!satuan) return 15

  const s = satuan.toLowerCase()
  const sk = satuanKecil?.toLowerCase() ?? ''

  if (MEASURABLE_UNITS.includes(s)) {
    // Satuan utama sudah timbang (kg, gram, liter, ml) → bulk
    return THRESHOLD_BULK_PERSEN
  } else if (MEASURABLE_UNITS.includes(sk)) {
    // Satuan utama countable TAPI satuan kecilnya timbang
    // Contoh: SAPI (blok + gram), GAS (pcs + gram → tetap 0% karena dihitung per tabung)
    // Hanya berlaku jika satuan_kecil adalah gram/ml/liter dan satuan utama BUKAN pcs
    if (['gram', 'ml', 'liter'].includes(sk) && s !== 'pcs') {
      return THRESHOLD_BULK_PERSEN
    }
  }

  return 0
}

export type MaterialType = 'count' | 'bulk'

/**
 * Kelompok bahan di opname: COUNT (dihitung per satuan, toleransi 0%) vs
 * BULK (ditimbang/diukur, toleransi > 0%). Diturunkan dari getThresholdPersen
 * supaya kelompok & toleransi tak pernah bertentangan.
 */
export function getMaterialType(
  satuan?: string,
  satuanKecil?: string | null,
  nama?: string | null,
): MaterialType {
  return getThresholdPersen(satuan, satuanKecil, nama) > 0 ? 'bulk' : 'count'
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
 * Menentukan apakah selisih opname perlu di-flag (butuh perhatian / approval).
 *
 * Aturan threshold:
 * 1. Bahan susut berbasis POS (AYAM 50%, SAPI 50%, KENTANG 20%, varian SAOS* 15%)
 *    bila `pakaiPosQty` tersedia:
 *    - Pas (|selisih| <= 0.01) -> tidak flag
 *    - Surplus (selisih > 0.01) -> langsung flag (ketat 0%)
 *    - Minus (selisih < -0.01) -> flag bila |selisih| > POS * s / (1 - s)
 *      (mis. Ayam/Sapi 50%: |selisih| > 100% POS, setara pemakaian aktual > 2x POS)
 * 2. Bahan TIMBANG / BULK lainnya -> toleransi 20% dari |qtySystem|
 * 3. Bahan HITUNG / countable (pcs, pack, lembar, dll) -> toleransi 0%
 *
 * @param selisih     Hasil computeSelisih (fisik - sistem)
 * @param qtySystem   Saldo sistem saat opname
 * @param satuan      Satuan utama bahan (mis: 'kg', 'pcs', 'blok')
 * @param satuanKecil Satuan kecil bahan (mis: 'gram', 'lembar') — opsional
 * @param nama        Nama bahan baku — opsional
 * @param pakaiPosQty Total pemakaian POS bahan selama periode opname (satuan kecil) — opsional
 */
export function isSelisihFlagged(
  selisih: number,
  qtySystem: number,
  satuan?: string,
  satuanKecil?: string | null,
  nama?: string | null,
  pakaiPosQty?: number | null,
): boolean {
  const aturanSusut = getAturanSusutPos(nama)
  if (aturanSusut && pakaiPosQty !== undefined && pakaiPosQty !== null) {
    if (Math.abs(selisih) <= SELISIH_ZERO_EPS) return false
    // Surplus pada bahan susut dipatok ketat 0%
    if (selisih > SELISIH_ZERO_EPS) return true
    const batasLoss = hitungBatasLossPos(pakaiPosQty, aturanSusut)
    return Math.abs(selisih) > batasLoss + FLOAT_EPS
  }

  if (qtySystem === 0) return selisih !== 0

  const threshold = getThresholdPersen(satuan, satuanKecil, nama) / 100
  const baseQty = Math.abs(qtySystem)
  return Math.abs(selisih) > threshold * baseQty
}

export interface ToleransiSelisih {
  /** Batas toleransi bahan ini (persen susut POS atau persen dari stok sistem). */
  thresholdPersen: number;
  /** Acuan perhitungan threshold: 'pos' (4 bahan susut) atau 'sistem' (bulk lain & count). */
  basis: 'pos' | 'sistem';
  /** Pengali maksimum pemakaian aktual terhadap POS (khusus basis 'pos'). */
  faktorMaksPos: number | null;
  /** Batas maksimum defisit/loss dalam satuan kecil (khusus basis 'pos'). */
  batasLossQty: number | null;
  /** true bila bahan basis 'pos' melewati batas karena surplus (fisik > sistem 1x POS). */
  lewatKarenaSurplus: boolean;
  /** true bila ada selisih tapi masih di dalam batas toleransi. */
  dalamToleransi: boolean;
  /** true bila selisih melewati batas toleransi (sama dengan isSelisihFlagged). */
  lewatToleransi: boolean;
}

/**
 * Status toleransi selisih untuk ditampilkan ke pengguna. Aturannya sama dengan
 * isSelisihFlagged (form opname, approval, detail opname, Jurnal Mutasi & PDF).
 * Selisih ~0 tidak dianggap dalam/lewat toleransi.
 */
export function nilaiToleransiSelisih(
  selisih: number,
  qtySystem: number,
  satuan?: string,
  satuanKecil?: string | null,
  nama?: string | null,
  pakaiPosQty?: number | null,
): ToleransiSelisih {
  const aturanSusut = getAturanSusutPos(nama)
  const pakaiBasisPos = !!(aturanSusut && pakaiPosQty !== undefined && pakaiPosQty !== null)
  const thresholdPersen = getThresholdPersen(satuan, satuanKecil, nama)
  const batasLossQty = pakaiBasisPos ? hitungBatasLossPos(pakaiPosQty!, aturanSusut!) : null
  const faktorMaksPos = pakaiBasisPos ? aturanSusut!.faktorMaksPos : null

  if (Math.abs(selisih) <= SELISIH_ZERO_EPS) {
    return {
      thresholdPersen,
      basis: pakaiBasisPos ? 'pos' : 'sistem',
      faktorMaksPos,
      batasLossQty,
      lewatKarenaSurplus: false,
      dalamToleransi: false,
      lewatToleransi: false,
    }
  }

  const lewat = isSelisihFlagged(selisih, qtySystem, satuan, satuanKecil, nama, pakaiPosQty)
  return {
    thresholdPersen,
    basis: pakaiBasisPos ? 'pos' : 'sistem',
    faktorMaksPos,
    batasLossQty,
    lewatKarenaSurplus: pakaiBasisPos && selisih > SELISIH_ZERO_EPS && lewat,
    dalamToleransi: !lewat,
    lewatToleransi: lewat,
  }
}
