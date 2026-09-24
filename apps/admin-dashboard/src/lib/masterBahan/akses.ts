/**
 * Hak ubah master bahan baku di LAYAR. WAJIB sama dengan _peran_master() di DB
 * (Tahap 1): lingkup 'data' = admin/owner, 'harga' = admin/owner/purchasing.
 * Layar hanya menyembunyikan tombol; penjaga sesungguhnya ada di RPC.
 * Role datang dari useRole() — selalu huruf besar.
 */
export function bolehUbahData(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER'
}

export function bolehUbahHarga(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER' || role === 'PURCHASING'
}
