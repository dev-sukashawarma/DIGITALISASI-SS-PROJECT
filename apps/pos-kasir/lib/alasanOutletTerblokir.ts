/**
 * Alasan kasir diblokir karena status outletnya, atau null bila outlet boleh dipakai.
 * Outlet berstatus Persiapan (`status = 'pending'`, dari Wizard Pembukaan Outlet)
 * tetap diblokir sampai Go-Live, tetapi pesannya jangan menyebut "dinonaktifkan".
 */
export function alasanOutletTerblokir(
  outlet: { is_active?: boolean | null; status?: string | null; inactive_reason?: string | null } | null | undefined,
): string | null {
  if (!outlet || outlet.is_active !== false) return null
  if (outlet.status === 'pending') {
    return 'Outlet ini belum dibuka (status Persiapan). Kasir aktif setelah Go-Live.'
  }
  return outlet.inactive_reason || 'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.'
}
