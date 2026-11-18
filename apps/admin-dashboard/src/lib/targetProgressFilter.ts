import {
  GLOBAL_SYSTEM_OUTLET_ID,
  GUDANG_PUSAT_OUTLET_ID,
  GUDANG_SS_ONLINE_OUTLET_ID,
  isTestOutlet,
  KANTOR_PUSAT_OUTLET_ID,
  SAWANGAN_INTERNAL_OUTLET_ID,
  TEST_OUTLET_ID,
} from '@/lib/outletFilters'

const HIDDEN_TARGET_OUTLET_IDS = new Set<string>([
  TEST_OUTLET_ID,
  KANTOR_PUSAT_OUTLET_ID,
  GLOBAL_SYSTEM_OUTLET_ID,
  GUDANG_PUSAT_OUTLET_ID,
  GUDANG_SS_ONLINE_OUTLET_ID,
  SAWANGAN_INTERNAL_OUTLET_ID,
])

const HIDDEN_TARGET_NAME_PATTERNS = [
  'kantor pusat',
  'global outlet',
  'gudang pusat',
  'gudang ss online',
  'sawangan (internal)',
  'sawangan internal',
] as const

/**
 * Menentukan apakah sebuah entri outlet ditampilkan di papan Target Penjualan Harian.
 * Menyembunyikan outlet uji coba, entitas non-ritel (Kantor Pusat, Global Outlet,
 * Gudang Pusat, Gudang SS Online), serta Sawangan (Internal) yang sudah tutup.
 */
export function isTargetProgressOutletVisible(row: {
  outlet_id?: string | null
  outlet_name?: string | null
}): boolean {
  const id = (row.outlet_id ?? '').trim().toLowerCase()
  const name = (row.outlet_name ?? '').trim().toLowerCase()

  if (id && HIDDEN_TARGET_OUTLET_IDS.has(id)) return false
  if (isTestOutlet(row.outlet_id) || isTestOutlet(row.outlet_name)) return false

  return !HIDDEN_TARGET_NAME_PATTERNS.some((pattern) => name.includes(pattern))
}
