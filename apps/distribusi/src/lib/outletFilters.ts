/**
 * Outlet uji developer — JANGAN masuk perhitungan apa pun.
 *
 * Keputusan owner, 8 September 2026:
 *
 *   "outlet tes hanya untuk testing oleh developer, jadi jangan masuk ke
 *    perhitungan"
 *
 * Berlaku untuk semua angka: omzet, HPP, laba, nilai persediaan, waste,
 * laporan apa pun. Isinya angka karangan — sisa uji bug skala opname,
 * "reset ke 10x reorder point", dan percobaan lain.
 *
 * Sisi basis data sudah ditutup lewat migration 20300131000000 (nilai
 * persediaan), 20300132000000 (HPP & waste), dan 20300133000000 (omzet).
 * Berkas ini menutup sisi klien: daftar outlet yang ditarik tiap app
 * sendiri-sendiri.
 *
 * CATATAN — kenapa memakai id/type, BUKAN kecocokan nama:
 * `apps/admin-dashboard`, `apps/finance`, dan `apps/HR` punya berkas serupa
 * yang mencocokkan potongan kata pada nama ("tes"/"test"/"trial"/"demo").
 * Hari ini itu tepat (diperiksa: 29 outlet, hanya "outlet tes" yang kena),
 * tetapi nama outlet bisa diubah kapan saja oleh admin, dan potongan "tes"
 * bisa ikut menjaring nama cabang di kemudian hari. `outlets.type` diisi oleh
 * skema, bukan oleh pengetik — itulah acuan yang sama dengan yang dipakai
 * view-view di basis data.
 *
 * Jangan disamakan dengan `type='marketplace'` (Shopee/TikTok Shop):
 * marketplace tak memegang barang fisik sehingga keluar dari hitungan
 * PERSEDIAAN, tetapi omzetnya SAH dihitung.
 *
 * Jangan pula mengandalkan `is_active`: outlet tes justru `is_active = true`.
 */

export const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'

type OutletLike = { id?: string | null; type?: string | null }

export function isTestOutlet(outlet?: OutletLike | string | null): boolean {
  if (!outlet) return false
  if (typeof outlet === 'string') return outlet === TEST_OUTLET_ID
  if (outlet.id === TEST_OUTLET_ID) return true
  return (outlet.type ?? '') === 'test'
}
