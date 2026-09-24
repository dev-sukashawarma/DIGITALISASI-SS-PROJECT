export type GalatRpc = { pesan: string; kode: string | null; bisaDipaksa: boolean }

/**
 * Terjemahkan galat dari supabase.rpc (PostgrestError: {code, message}).
 * `bisaDipaksa` = galat yang boleh dilewati dengan p_paksa di simpan_harga_vendor:
 * dugaan salah satuan & satuan beli tak dikenali. Isi kemasan berbeda TIDAK bisa dipaksa.
 */
export function bacaGalatRpc(e: unknown): GalatRpc {
  const obj = e !== null && typeof e === 'object' ? (e as { message?: unknown; code?: unknown }) : null
  const pesanAsli =
    typeof obj?.message === 'string' && obj.message.trim() !== '' ? obj.message : 'Terjadi kesalahan'
  const kode = typeof obj?.code === 'string' ? obj.code : null
  if (kode === '42501') {
    return { pesan: `Anda tidak berhak melakukan perubahan ini. (${pesanAsli})`, kode, bisaDipaksa: false }
  }
  return { pesan: pesanAsli, kode, bisaDipaksa: /salah satuan|tidak dikenali/i.test(pesanAsli) }
}
