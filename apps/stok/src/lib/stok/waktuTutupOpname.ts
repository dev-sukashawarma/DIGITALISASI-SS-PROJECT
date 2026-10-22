/**
 * Batas waktu sebuah opname di ledger = saat opname DIFINALISASI, bukan saat
 * drafnya dibuat (`opname.created_at`).
 *
 * `finalize_opname` menulis `opname_selisih` = fisik − saldo sistem SAAT
 * finalisasi, jadi semua penjualan sebelum finalisasi sudah "termakan" oleh
 * hitungan fisik. Kalau jendela jurnal berhenti di `created_at`, penjualan
 * antara draf dibuka dan finalisasi hilang dari periode ini (selisih tampak
 * lebih minus) lalu terhitung lagi di periode berikutnya (tampak surplus).
 * Contoh: MITRA CIBUBUR 21 Okt 2026 — draf 17:34, finalisasi 22:13, 27 dari
 * 33 order hari itu jatuh di antaranya. 31 dari 268 opname 14 hari terakhir
 * berjeda > 30 menit.
 *
 * Urutan sumber: baris ledger `opname_selisih` pertama milik opname itu →
 * `updated_at` (opname tanpa selisih apa pun tak menulis ledger) → `created_at`.
 */
export function pilihWaktuTutupOpname(
  opname: { created_at: string; updated_at?: string | null; status?: string | null },
  waktuLedgerPertama: string | null | undefined
): string {
  if (waktuLedgerPertama) return waktuLedgerPertama
  if (opname.status === 'finalized' && opname.updated_at) return opname.updated_at
  return opname.created_at
}

type ClientLike = {
  from: (table: string) => any
}

export async function ambilWaktuTutupOpname(
  supabase: ClientLike,
  opname: { id: string; created_at: string; updated_at?: string | null; status?: string | null }
): Promise<string> {
  const { data } = await supabase
    .from('ledger_stok')
    .select('created_at')
    .eq('ref_opname_id', opname.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return pilihWaktuTutupOpname(opname, data?.created_at)
}
