/** Kunci yang diterima RPC simpan_supplier (migration 20260924100000). */
export const KUNCI_DATA_SUPPLIER = [
  'nama', 'kontak', 'alamat', 'kategori', 'catatan', 'termin_hari', 'vendor_induk_id', 'bahan_baku_ids',
] as const

/** RPC menolak kunci lain dengan 22023 — saring sebelum dikirim. */
export function saringDataSupplier(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of KUNCI_DATA_SUPPLIER) if (k in p) out[k] = p[k]
  return out
}
