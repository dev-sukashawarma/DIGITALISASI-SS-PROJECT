/**
 * Kolom satuan BESAR di form opname disembunyikan di outlet bila barang dikirim
 * ke outlet dalam satuan TENGAH (mis. HAND GLOVE: Dus/Box/Lembar, dikirim per Box).
 * Outlet tak pernah memegang satu satuan besar utuh, jadi kolom itu hanya jadi
 * tempat salah ketik (21 Sep 2026: "5 Box + 40 Lembar" tercatat 5 Dus + 40 Box).
 *
 * Sementara hanya berlaku untuk bahan di BAHAN_TANPA_KOLOM_BESAR (keputusan owner
 * 22 Sep 2026: mulai dari HAND GLOVE, dievaluasi dulu sebelum diperluas ke bahan
 * lain yang juga dikirim per satuan tengah, mis. FOIL, KEJU, KENTANG).
 *
 * Gudang Pusat tetap melihat kolom besar karena di sana barang disimpan per Dus.
 * Kolom tetap tampil kalau isiannya sudah terisi (draft lama), supaya tak ada
 * angka yang ikut terhitung tanpa terlihat.
 */
export const BAHAN_TANPA_KOLOM_BESAR = ['HAND GLOVE']

export function sembunyikanKolomBesar(
  b: { nama?: string | null; satuan?: string | null; satuan_tengah?: string | null; satuan_distribusi?: string | null },
  opts: { isGudangPusat: boolean; nilaiBesar?: string | null },
): boolean {
  if (opts.isGudangPusat) return false
  if (!BAHAN_TANPA_KOLOM_BESAR.includes((b.nama || '').trim().toUpperCase())) return false
  if (opts.nilaiBesar && Number(opts.nilaiBesar) !== 0) return false
  const tengah = b.satuan_tengah?.trim().toLowerCase()
  const distribusi = b.satuan_distribusi?.trim().toLowerCase()
  return !!tengah && tengah === distribusi
}

/**
 * Bahan dianggap punya satuan kecil bila label satuan_kecil diisi dan
 * TIDAK sama dengan satuan besar (mis. Pcs dan Pcs dianggap satu tingkat,
 * bukan dua tingkat — mencegah form merender 2 kolom input identik yang
 * dijumlahkan).
 */
export function adaSatuanKecil(b: { satuan?: string | null; satuan_kecil?: string | null }): boolean {
  if (!b.satuan_kecil) return false
  const besar = (b.satuan || '').trim().toLowerCase()
  const kecil = b.satuan_kecil.trim().toLowerCase()
  return kecil.length > 0 && kecil !== besar
}

