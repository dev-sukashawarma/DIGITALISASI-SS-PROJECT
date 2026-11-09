/**
 * Hak ubah master bahan baku di LAYAR. WAJIB sama dengan _peran_master() di DB
 * (Tahap 1): lingkup 'data' = admin/owner, 'harga' = admin/owner/purchasing,
 * 'tambah' (membuat bahan baru saja, migration 20261106130000) = admin/owner/purchasing.
 * Layar hanya menyembunyikan tombol; penjaga sesungguhnya ada di RPC.
 * Role datang dari useRole() — selalu huruf besar.
 */
export function bolehUbahData(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER'
}

/** Membuat bahan BARU. Mengubah, menonaktifkan, dan SKU tetap bolehUbahData. */
export function bolehTambahBahan(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER' || role === 'PURCHASING'
}

/** Ganti Satuan bahan ber-riwayat stok — lingkup 'satuan' di _peran_master (migration 20261109135822). */
export function bolehGantiSatuan(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER' || role === 'PURCHASING'
}

export function bolehUbahHarga(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER' || role === 'PURCHASING'
}
