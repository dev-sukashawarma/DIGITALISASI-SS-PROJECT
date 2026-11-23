/**
 * Outlet yang boleh tampil di papan monitoring stok (monitoring-live, dashboard
 * SPV/leader, notifikasi kritis, Top-3, hitungan waste hari ini).
 *
 * Masalah yang ditutup: `monitoring_view_spv` memuat SEMUA baris stok_balance
 * yang boleh dibaca pemanggil, termasuk outlet tutup (status 'inactive'), dummy
 * kantor/sistem (KANTOR PUSAT, GLOBAL OUTLET (SYSTEM)), marketplace, outlet tes,
 * dan outlet Persiapan. Saldo outlet-outlet itu tak pernah diisi ulang, jadi
 * hampir semuanya "Kritis" — ±32% baris below di papan palsu, dan Top-3 terisi
 * barang dari outlet yang sudah tutup.
 *
 * Aturan dikenali lewat `outlets.type` + `outlets.status`, BUKAN nama (nama
 * bisa diubah admin kapan saja; lihat juga `@/lib/outletFilters`):
 * - status harus 'active' (Persiapan & tutup tidak tampil);
 * - type 'internal' / 'mitra' (outlet jualan) atau 'gudang' (gudang operasional
 *   yang memegang barang, mis. GUDANG SS ONLINE);
 * - Gudang Pusat ber-type 'office' (sama dengan KANTOR PUSAT yang dummy), jadi
 *   ia dikenali lewat id — sumber yang sama dipakai `gudang_pusat_id()` di DB.
 *
 * Modul murni (tanpa React/Supabase) supaya bisa diuji.
 */
import { isTestOutlet } from '@/lib/outletFilters'

/** Gudang Pusat (HQ). Sama dengan `gudang_pusat_id()` di DB. */
export const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'

const TYPE_OPERASIONAL = new Set(['internal', 'mitra', 'gudang'])

export interface OutletTypeStatus {
  id: string
  type?: string | null
  status?: string | null
}

/** True bila outlet ini operasional dan boleh tampil di papan monitoring. */
export function isOutletPapan(o: OutletTypeStatus): boolean {
  if (!o || !o.id) return false
  if (isTestOutlet(o)) return false
  if (o.status !== 'active') return false
  if (o.id === GUDANG_PUSAT_ID) return true
  return !!o.type && TYPE_OPERASIONAL.has(o.type)
}

/** Himpunan id outlet papan dari daftar outlet. */
export function idOutletPapan(outlets: OutletTypeStatus[]): Set<string> {
  return new Set((outlets || []).filter(isOutletPapan).map((o) => o.id))
}

/** Buang item (baris monitoring/ledger) milik outlet yang bukan outlet papan. */
export function saringItemPapan<T extends { outlet_id: string }>(items: T[], outlets: OutletTypeStatus[]): T[] {
  const ids = idOutletPapan(outlets)
  return (items || []).filter((it) => ids.has(it.outlet_id))
}
