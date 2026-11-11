// apps/admin-dashboard/src/lib/wasteReasons.ts
//
// Kolom stok_waste_reports.reason menerima input dari:
//   1. Dropdown web apps/stok (WasteModal.tsx & ManualEntryForm.tsx) -> 8 kategori SOP
//   2. SuperApp Android (KolomAlasanCepat.kt) -> 8 kapsul cepat + kolom ketik manual
//   3. Data historis (termasuk 'Lainnya' lama, typo lapangan seperti 'Bonggol'/'Bogol', dsb.)
//
// Agar grafik "Breakdown per Alasan" selalu akurat 100% terhadap Total Kerugian
// tanpa membuang baris non-kanonik secara diam-diam:
//   - Teks ketikan manual yang bermakna sama dikelompokkan ke 8 kategori kanonik SOP
//   - Sisa catatan bebas yang benar-benar di luar 8 kategori ditampung di OTHER_MANUAL_REASON
//   - Tabel Rincian Insiden & modal detail tetap menampilkan teks asli dari DB.

/**
 * Delapan opsi standar SOP yang aktif di dropdown web stok & kapsul cepat SuperApp.
 * Urutan mengikuti frekuensi operasional di lapangan.
 */
export const CANONICAL_WASTE_REASONS = [
  'Trimming / Bonggol',
  'Gosong / Rusak Masak',
  'Basi / Expired',
  'Rusak Fisik / Sobek',
  'Sisa Produksi / Adonan',
  'Jatuh / Tumpah',
  'Pesanan Dibatalkan',
  'Kualitas Buruk (dari supplier)',
] as const

export type CanonicalWasteReason = (typeof CANONICAL_WASTE_REASONS)[number]

/** Bucket penampung di grafik agregat untuk catatan manual di luar 8 kategori SOP atau data historis. */
export const OTHER_MANUAL_REASON = 'Alasan Manual Lainnya' as const

export type BreakdownWasteReason = CanonicalWasteReason | typeof OTHER_MANUAL_REASON

/** Alasan yang berarti uang berpeluang diklaim balik ke supplier, bukan diserap sendiri. */
export const CLAIMABLE_REASON: CanonicalWasteReason = 'Kualitas Buruk (dari supplier)'

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_WASTE_REASONS)

/** True bila string persis sama dengan salah satu dari 8 opsi dropdown kanonik. */
export function isCanonicalReason(reason: string): boolean {
  return CANONICAL_SET.has(reason)
}

const MATCH_SUPPLIER = ['kualitas buruk', 'supplier', 'suplayer']
const MATCH_TRIMMING = [
  'bonggol',
  'bongol',
  'bogol',
  'bongkol',
  'bongok',
  'bongola',
  'nongol',
  'batang sayur',
  'barang sayur',
  'waste sayur',
  'sayur waste',
  'trimming',
]
const MATCH_CANCEL = ['batal', 'cancel', 'cancek']
const MATCH_GOSONG = ['gosong', 'rusak masak']
const MATCH_JATUH = ['jatuh', 'tumpah']
const MATCH_SISA_PRODUKSI = [
  'sisa produksi',
  'bekas',
  'frdchiken',
  'fridchiken',
  'friddchiken',
  'friedchiken',
  'fredchiken',
  'fried chicken',
  'chicken',
  'chicekn',
  'panko',
  'adonan',
  'sisa',
]
const MATCH_BASI = [
  'basi',
  'expired',
  'kadaluarsa',
  'kedaluwarsa',
  'berbau',
  'tidak layak pakai',
  'menguning',
  'busuk',
  'layu',
]
const MATCH_RUSAK_FISIK = [
  'rusak fisik',
  'sobek',
  'robek',
  'retak',
  'kering',
  'keras',
  'pecah',
  'patah',
  'lengket',
  'ancur',
  'hancur',
  'rusak',
  'ruksak',
]

function includesAny(haystack: string, keywords: readonly string[]): boolean {
  for (const kw of keywords) {
    if (haystack.includes(kw)) return true
  }
  return false
}

/**
 * Normalisasi alasan untuk grafik agregat "Breakdown per Alasan":
 * - Nilai kanonik kembali apa adanya
 * - Variasi ketikan / typo lapangan dipetakan ke kategori SOP yang relevan
 * - Sisanya masuk ke `OTHER_MANUAL_REASON` ('Alasan Manual Lainnya') sehingga
 *   jumlah seluruh bar selalu 100% sama dengan Total Kerugian.
 */
export function normalizeReason(reason: string): BreakdownWasteReason {
  const trimmed = (reason ?? '').trim()
  if (CANONICAL_SET.has(trimmed)) {
    return trimmed as CanonicalWasteReason
  }

  const s = trimmed.toLowerCase()
  if (!s) return OTHER_MANUAL_REASON

  // Urutan pencocokan disusun dari yang paling spesifik agar alasan gabungan
  // (mis. "Kualitas Buruk ... patah" atau "Bongol dan daun busuk") masuk ke
  // akar penyebab utamanya.
  if (includesAny(s, MATCH_SUPPLIER)) return 'Kualitas Buruk (dari supplier)'
  if (includesAny(s, MATCH_TRIMMING)) return 'Trimming / Bonggol'
  if (includesAny(s, MATCH_CANCEL)) return 'Pesanan Dibatalkan'
  if (includesAny(s, MATCH_GOSONG)) return 'Gosong / Rusak Masak'
  if (includesAny(s, MATCH_JATUH)) return 'Jatuh / Tumpah'
  if (includesAny(s, MATCH_SISA_PRODUKSI)) return 'Sisa Produksi / Adonan'
  if (includesAny(s, MATCH_BASI)) return 'Basi / Expired'
  if (includesAny(s, MATCH_RUSAK_FISIK)) return 'Rusak Fisik / Sobek'

  return OTHER_MANUAL_REASON
}

/** True bila alasan (termasuk variasi ketikan manualnya) tergolong klaim supplier. */
export function isClaimableReason(reason: string): boolean {
  return normalizeReason(reason) === CLAIMABLE_REASON
}

/**
 * Berapa INSIDEN yang tidak dapat dipetakan ke 8 kategori SOP dan masuk ke
 * bucket `Alasan Manual Lainnya` (mis. 'Tester' atau 'Lainnya' historis).
 */
export function countFreeTextIncidents(
  rows: { reason: string; jumlah_insiden: number }[]
): number {
  return rows.reduce(
    (sum, r) => (normalizeReason(r.reason) === OTHER_MANUAL_REASON ? sum + r.jumlah_insiden : sum),
    0
  )
}
