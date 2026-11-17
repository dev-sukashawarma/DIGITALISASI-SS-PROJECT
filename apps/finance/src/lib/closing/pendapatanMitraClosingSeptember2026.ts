// DIBANGKITKAN oleh scripts/closing/bangkitkan_pendapatan_mitra_sept2026.py — jangan diedit tangan.
// Sumber: SS LAP. LABA RUGI 2026 fixxxxx.xlsx, sheet FIXED SEPTEMBER 2026, baris 53–54 kolom N–X.

/* Pendapatan pusat dari mitra versi closing September 2026. Excel menghitung
 * "TOTAL NET PROFIT INTERNAL" (B75) = laba 12 outlet internal + N55:X55, dengan
 * N55 = NET PROFIT SS (bagi hasil/fee manajemen) + NET PROFIT HPP (margin HPP).
 * Rumus ini berbeda dari hitungan live (fee 3% + 10% HPP dasar) dan memang
 * dipakai apa adanya untuk September saja. */

export interface PendapatanMitraClosing {
  nama: string
  kolomExcel: string
  /** Baris 53 NET PROFIT SS. */
  bagiHasilSs: number
  /** Baris 54 NET PROFIT HPP. */
  marginHpp: number
}

export const PENDAPATAN_MITRA_CLOSING_SEPT_2026 = {
  from: '2026-09-01',
  to: '2026-09-30',
  sumber: 'SS LAP. LABA RUGI 2026 fixxxxx.xlsx — FIXED SEPTEMBER 2026 N53:X54',
  outlets: {
    '550e8400-e29b-41d4-a716-446655440014': { nama: 'MITRA CIBINONG', kolomExcel: 'N', bagiHasilSs: 9504785.5, marginHpp: 7181463.2 },
    '550e8400-e29b-41d4-a716-446655440017': { nama: 'MITRA CISEENG', kolomExcel: 'O', bagiHasilSs: 0.0, marginHpp: 2894192.0 },
    '550e8400-e29b-41d4-a716-446655440018': { nama: 'MITRA PEKAYON', kolomExcel: 'P', bagiHasilSs: 0.0, marginHpp: 3202852.3 },
    '550e8400-e29b-41d4-a716-446655440019': { nama: 'MITRA KALISARI', kolomExcel: 'Q', bagiHasilSs: 0.0, marginHpp: 2087060.4 },
    '5a4df577-5237-476e-b54c-9eb642a5a516': { nama: 'MITRA SAWANGAN DTC', kolomExcel: 'R', bagiHasilSs: 0.0, marginHpp: 654339.1 },
    '43b7bbd1-1fd4-44b5-87ca-b07a271151af': { nama: 'MITRA SENTUL', kolomExcel: 'S', bagiHasilSs: 1927173.6, marginHpp: 4406551.5 },
    '3f38c41d-11e3-49ce-a189-d7303e45f9ad': { nama: 'MITRA CIBUBUR', kolomExcel: 'T', bagiHasilSs: 2122597.32, marginHpp: 5672968.4 },
    'd9a2ef93-c298-4501-a471-1c5e2b3dff08': { nama: 'MITRA CICURUG', kolomExcel: 'U', bagiHasilSs: 3933046.02, marginHpp: 9883897.3 },
    '550e8400-e29b-41d4-a716-446655440003': { nama: 'MITRA PALEDANG', kolomExcel: 'V', bagiHasilSs: 0.0, marginHpp: 2631753.0 },
    'bba67dba-2dca-4e98-bdb2-6a9e265e288c': { nama: 'MITRA PAMULANG', kolomExcel: 'W', bagiHasilSs: 1987068.12, marginHpp: 5299795.5 },
    '62a56103-2085-4dd5-9d25-a3c0cffc88ff': { nama: 'MITRA CILEUNGSI', kolomExcel: 'X', bagiHasilSs: 6448296.9, marginHpp: 20632135.0 },
  } as Record<string, PendapatanMitraClosing>,
}

/** Total pendapatan pusat dari mitra versi closing, hanya untuk rentang tepat 1–30 September 2026. */
export function pendapatanMitraClosingUntuk(from: string, to: string): { feeManajemen: number; marginHpp: number } | null {
  const P = PENDAPATAN_MITRA_CLOSING_SEPT_2026
  if (from !== P.from || to !== P.to) return null
  let feeManajemen = 0
  let marginHpp = 0
  for (const o of Object.values(P.outlets)) {
    feeManajemen += o.bagiHasilSs
    marginHpp += o.marginHpp
  }
  return { feeManajemen, marginHpp }
}
