// DIBANGKITKAN oleh scripts/closing/bangkitkan_closing_oktober2026.py — jangan diedit tangan.
// Sumber: bismillah fixed oktober SS LAP. LABA RUGI 2026 (1).xlsx — OKTOBER 2026.

import type { KomponenLabaKotor } from './labaKotorInternalClosingSeptember2026'
import type { PendapatanMitraClosing } from './pendapatanMitraClosingSeptember2026'

/* Closing Oktober 2026 untuk Laba Rugi Internal (semua outlet).
 * Laba kotor kolom B–L dalam konvensi layar (omzet kotor, TikTok GO kotor), termasuk
 * komisi TikTok GO yang di laporan terpotong dua kali. Pendapatan pusat dari mitra =
 * baris NET PROFIT SS + NET PROFIT HPP kolom M–Y. Pendapatan lain-lain tidak dihitung. */

export const LABA_KOTOR_INTERNAL_CLOSING_OKT_2026 = {
  label: 'Oktober 2026',
  from: '2026-10-01',
  to: '2026-10-31',
  sumber: 'bismillah fixed oktober SS LAP. LABA RUGI 2026 (1).xlsx — OKTOBER 2026 B3:L33',
  /** Pendapatan lain-lain (Income Lainnya) yang dipakai closing. */
  pendapatanLain: 0,
  outlets: {
    'ss-online': { kolomExcel: 'B', omzet: 0.0, potongan: 0.0, komisiTiktokKedua: 0.0, hpp: 0.0, waste: 0.0 },
    '550e8400-e29b-41d4-a716-446655440001': { kolomExcel: 'C', omzet: 76138598.0, potongan: 32646371.0, komisiTiktokKedua: 77063.0, hpp: 35589739.0, waste: 0.0 },
    '550e8400-e29b-41d4-a716-446655440002': { kolomExcel: 'D', omzet: 181254442.0, potongan: 40409837.0, komisiTiktokKedua: 1043150.0, hpp: 95807569.0, waste: 679895.0 },
    '550e8400-e29b-41d4-a716-446655440004': { kolomExcel: 'E', omzet: 184126175.0, potongan: 53088907.0, komisiTiktokKedua: 835615.0, hpp: 94980423.0, waste: 885916.0 },
    '550e8400-e29b-41d4-a716-446655440005': { kolomExcel: 'F', omzet: 78227362.0, potongan: 17286058.0, komisiTiktokKedua: 686177.0, hpp: 41662278.0, waste: 361544.0 },
    '550e8400-e29b-41d4-a716-446655440006': { kolomExcel: 'G', omzet: 75295390.0, potongan: 19965675.0, komisiTiktokKedua: 727457.0, hpp: 38984133.0, waste: 747291.0 },
    '550e8400-e29b-41d4-a716-446655440007': { kolomExcel: 'H', omzet: 123381000.0, potongan: 42269276.0, komisiTiktokKedua: 509817.0, hpp: 60936847.0, waste: 494618.0 },
    '550e8400-e29b-41d4-a716-446655440009': { kolomExcel: 'I', omzet: 66198436.0, potongan: 18647325.0, komisiTiktokKedua: 458431.0, hpp: 34204664.0, waste: 871222.0 },
    '550e8400-e29b-41d4-a716-446655440010': { kolomExcel: 'J', omzet: 70436000.0, potongan: 24721460.0, komisiTiktokKedua: 624551.0, hpp: 34999447.0, waste: 664014.0 },
    '550e8400-e29b-41d4-a716-446655440011': { kolomExcel: 'K', omzet: 91264022.0, potongan: 27463934.0, komisiTiktokKedua: 539302.0, hpp: 46324452.0, waste: 269924.0 },
    '550e8400-e29b-41d4-a716-446655440013': { kolomExcel: 'L', omzet: 145897194.0, potongan: 43530455.0, komisiTiktokKedua: 1267953.0, hpp: 74820669.0, waste: 1144033.0 },
  } as Record<string, KomponenLabaKotor & { kolomExcel: string }>,
  total: { omzet: 1092218619.0, potongan: 320029298.0, komisiTiktokKedua: 6769516.0, hpp: 558310221.0, waste: 6118457.0 } as KomponenLabaKotor,
}

export const PENDAPATAN_MITRA_CLOSING_OKT_2026 = {
  label: 'Oktober 2026',
  from: '2026-10-01',
  to: '2026-10-31',
  sumber: 'bismillah fixed oktober SS LAP. LABA RUGI 2026 (1).xlsx — OKTOBER 2026 M53:Y54',
  outlets: {
    '550e8400-e29b-41d4-a716-446655440014': { nama: 'MITRA CIBINONG', kolomExcel: 'M', bagiHasilSs: 6819548.0, marginHpp: 8953484.0 },
    '550e8400-e29b-41d4-a716-446655440017': { nama: 'MITRA CISEENG', kolomExcel: 'N', bagiHasilSs: 0.0, marginHpp: 1531008.5 },
    '550e8400-e29b-41d4-a716-446655440018': { nama: 'MITRA PEKAYON', kolomExcel: 'O', bagiHasilSs: 0.0, marginHpp: 4496027.3 },
    '550e8400-e29b-41d4-a716-446655440019': { nama: 'MITRA KALISARI', kolomExcel: 'P', bagiHasilSs: 0.0, marginHpp: 4218693.8 },
    '5a4df577-5237-476e-b54c-9eb642a5a516': { nama: 'MITRA SAWANGAN DTC', kolomExcel: 'Q', bagiHasilSs: 0.0, marginHpp: 5716739.2 },
    '43b7bbd1-1fd4-44b5-87ca-b07a271151af': { nama: 'MITRA SENTUL', kolomExcel: 'R', bagiHasilSs: 2008612.56, marginHpp: 4728806.0 },
    '3f38c41d-11e3-49ce-a189-d7303e45f9ad': { nama: 'MITRA CIBUBUR', kolomExcel: 'S', bagiHasilSs: 2008541.16, marginHpp: 5410530.0 },
    'd9a2ef93-c298-4501-a471-1c5e2b3dff08': { nama: 'MITRA CICURUG', kolomExcel: 'T', bagiHasilSs: 4313885.73, marginHpp: 11077081.3 },
    '550e8400-e29b-41d4-a716-446655440003': { nama: 'MITRA PALEDANG', kolomExcel: 'U', bagiHasilSs: 383554.68, marginHpp: 913756.3 },
    'bba67dba-2dca-4e98-bdb2-6a9e265e288c': { nama: 'MITRA PAMULANG', kolomExcel: 'V', bagiHasilSs: 4019769.27, marginHpp: 10207931.9 },
    '62a56103-2085-4dd5-9d25-a3c0cffc88ff': { nama: 'MITRA CILEUNGSI', kolomExcel: 'W', bagiHasilSs: 5785971.21, marginHpp: 18371365.0 },
    '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7': { nama: 'MITRA CILEUDUG', kolomExcel: 'X', bagiHasilSs: 2228690.49, marginHpp: 6918685.0 },
    '48b980da-5a42-4a9b-a952-86ab5db6666a': { nama: 'MITRA PONDOK AREN', kolomExcel: 'Y', bagiHasilSs: 445238.4, marginHpp: 1438870.0 },
  } as Record<string, PendapatanMitraClosing>,
}

/** Total Net Profit Internal laporan (B77), untuk tes. */
export const NET_PROFIT_INTERNAL_OKT_2026 = 2561618.800000012
