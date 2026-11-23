// DIBANGKITKAN oleh scripts/closing/bangkitkan_laba_kotor_internal_sept2026.py — jangan diedit tangan.
// Sumber: SS LAP. LABA RUGI 2026 fixxxxx.xlsx, sheet FIXED SEPTEMBER 2026, kolom B–M.

/* Target laba kotor outlet internal versi closing September 2026, dalam konvensi
 * layar Laba Rugi (omzet kotor, TikTok GO kotor). Termasuk keanehan Excel yang
 * dipilih owner: komisi TikTok GO terpotong dua kali (komisiTiktokKedua). */

export interface KomponenLabaKotor {
  omzet: number
  potongan: number
  komisiTiktokKedua: number
  hpp: number
  waste: number
}

export const LABA_KOTOR_INTERNAL_CLOSING_SEPT_2026 = {
  from: '2026-09-01',
  to: '2026-09-30',
  sumber: 'SS LAP. LABA RUGI 2026 fixxxxx.xlsx — FIXED SEPTEMBER 2026 B3:M33',
  outlets: {
    'ss-online': { kolomExcel: 'B', omzet: 33244063.0, potongan: 7738296.0, komisiTiktokKedua: 0.0, hpp: 17127049.0, waste: 0.0 },
    '550e8400-e29b-41d4-a716-446655440001': { kolomExcel: 'C', omzet: 56572074.0, potongan: 24388449.0, komisiTiktokKedua: 84380.0, hpp: 26089120.0, waste: 0.0 },
    '550e8400-e29b-41d4-a716-446655440002': { kolomExcel: 'D', omzet: 160108842.0, potongan: 32830667.0, komisiTiktokKedua: 809700.0, hpp: 83011271.0, waste: 375268.0 },
    '550e8400-e29b-41d4-a716-446655440004': { kolomExcel: 'E', omzet: 156216576.0, potongan: 44534322.0, komisiTiktokKedua: 582870.0, hpp: 76944183.0, waste: 189473.0 },
    '550e8400-e29b-41d4-a716-446655440005': { kolomExcel: 'F', omzet: 91601540.0, potongan: 21259176.0, komisiTiktokKedua: 758590.0, hpp: 44113848.0, waste: 666776.0 },
    '550e8400-e29b-41d4-a716-446655440006': { kolomExcel: 'G', omzet: 73183502.0, potongan: 18007926.0, komisiTiktokKedua: 640470.0, hpp: 35090256.0, waste: 754692.0 },
    '550e8400-e29b-41d4-a716-446655440007': { kolomExcel: 'H', omzet: 93100000.0, potongan: 34156445.0, komisiTiktokKedua: 399800.0, hpp: 41254671.0, waste: 1655476.0 },
    '550e8400-e29b-41d4-a716-446655440008': { kolomExcel: 'I', omzet: 33240696.0, potongan: 11192705.0, komisiTiktokKedua: 149530.0, hpp: 15329918.0, waste: 103742.0 },
    '550e8400-e29b-41d4-a716-446655440009': { kolomExcel: 'J', omzet: 60938532.0, potongan: 17750234.0, komisiTiktokKedua: 275560.0, hpp: 30269599.0, waste: 519558.0 },
    '550e8400-e29b-41d4-a716-446655440010': { kolomExcel: 'K', omzet: 59211000.0, potongan: 20502205.0, komisiTiktokKedua: 425690.0, hpp: 28400755.0, waste: 858530.0 },
    '550e8400-e29b-41d4-a716-446655440011': { kolomExcel: 'L', omzet: 87798192.0, potongan: 27755023.0, komisiTiktokKedua: 504840.0, hpp: 42239850.0, waste: 278596.0 },
    '550e8400-e29b-41d4-a716-446655440013': { kolomExcel: 'M', omzet: 108311716.0, potongan: 32104004.0, komisiTiktokKedua: 1023250.0, hpp: 54725945.0, waste: 895235.0 },
  } as Record<string, KomponenLabaKotor & { kolomExcel: string }>,
  total: { omzet: 1013526733.0, potongan: 292219452.0, komisiTiktokKedua: 5654680.0, hpp: 494596465.0, waste: 6297346.0 } as KomponenLabaKotor,
}

/** Penyesuaian (target − live) per komponen, hanya untuk rentang tepat 1–30 September 2026.
 *  komisiTiktokKedua tidak punya padanan live, jadi nilainya = target penuh. */
export function penyesuaianLabaKotorClosing(
  from: string,
  to: string,
  live: { omzet: number; potongan: number; hpp: number; waste: number },
): KomponenLabaKotor | null {
  const L = LABA_KOTOR_INTERNAL_CLOSING_SEPT_2026
  if (from !== L.from || to !== L.to) return null
  return {
    omzet: L.total.omzet - live.omzet,
    potongan: L.total.potongan - live.potongan,
    komisiTiktokKedua: L.total.komisiTiktokKedua,
    hpp: L.total.hpp - live.hpp,
    waste: L.total.waste - live.waste,
  }
}
