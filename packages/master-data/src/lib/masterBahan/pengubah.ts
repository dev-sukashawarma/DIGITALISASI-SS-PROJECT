/** Baris dari RPC pengubah_terakhir_bahan() (migration 20261109135822). */
export type PengubahTerakhir = {
  bahan_baku_id: string
  diubah_at: string
  diubah_oleh: string | null
  nama_pengubah: string | null
  jenis: 'data' | 'harga_master' | 'harga_vendor' | string
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Waktu dalam WIB (UTC+7, tanpa DST), mis. "9 Nov 2026 14.05". */
function waktuWib(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600_000)
  const jam = `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()} ${jam}`
}

/** Label kolom "Diubah oleh". Tanpa pelaku = perubahan otomatis (trigger/migration). */
export function labelPengubah(
  p: Pick<PengubahTerakhir, 'nama_pengubah' | 'diubah_oleh' | 'diubah_at'> | undefined,
): { nama: string; waktu: string } | null {
  if (!p) return null
  const nama = p.nama_pengubah?.trim() || (p.diubah_oleh ? '(tanpa nama)' : 'Sistem')
  return { nama, waktu: waktuWib(p.diubah_at) }
}
