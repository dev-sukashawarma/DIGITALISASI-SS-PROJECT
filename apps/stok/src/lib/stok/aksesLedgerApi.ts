// Aturan akses murni untuk route /api/ledger & /api/ledger/invalidate.
// Bagian yang menyentuh sesi/DB ada di aksesLedgerApi.server.ts.

// Role yang aksesnya mencakup SEMUA outlet. Mirror dari daftar privileged di
// assertStaffCanAccessOutlet (lib/stok/outletAccess.ts) — ubah keduanya bersamaan.
const ROLE_SEMUA_OUTLET = [
  'admin', 'admin_hr', 'hr', 'owner', 'spv', 'kitchen',
  'admin_finance', 'finance', 'purchasing', 'developer', 'regional_manager',
] as const

/**
 * Invalidasi cache ledger tanpa outletId mengosongkan cache SEMUA outlet —
 * hanya untuk role pusat (dipakai penyesuaian Gudang Pusat multi-vendor).
 */
export function bolehInvalidasiSemuaOutlet(role: string | null | undefined): boolean {
  return !!role && (ROLE_SEMUA_OUTLET as readonly string[]).includes(role)
}

/** assertStaffCanAccessOutlet melempar "DB error: ..." untuk galat database. */
export function statusHttpGalatAkses(err: unknown): 403 | 500 {
  const pesan = err instanceof Error ? err.message : String(err)
  return pesan.startsWith('DB error') ? 500 : 403
}
