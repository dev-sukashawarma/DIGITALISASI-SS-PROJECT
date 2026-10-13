/* ── Joint Expense tidak dihitung lagi mulai Oktober 2026 ────────────────────
 *
 * Keputusan owner 13 Okt 2026: joint expense "disembunyikan dari laporan"
 * mulai 1 Oktober 2026 dan seterusnya. Barisnya TIDAK dihapus dari tabel
 * `expenses` — hanya tidak ikut dijumlahkan di laporan mana pun (Analisis
 * Pengeluaran, Laba Rugi, ekspor, dashboard mitra, Bot CEO).
 *
 * Agustus & September 2026 tetap dihitung apa adanya (sudah closing).
 */

export const JOINT_EXPENSE_BERHENTI_SEJAK = '2026-10-01'

/** Pesan penolakan saat ada yang mencoba menginput joint expense Oktober 2026 ke atas. */
export const PESAN_JOINT_EXPENSE_DITOLAK =
  'Joint Expense tidak dipakai lagi mulai Oktober 2026. Pilih kategori lain untuk pengeluaran ini.'

const KATEGORI_JOINT = new Set(['joint_expense', 'joint_expanse'])

/** `true` = baris ini joint expense yang tidak boleh ikut dihitung. */
export function adalahJointExpenseDisembunyikan(
  row: { category?: string | null; expense_date?: string | null } | null | undefined,
): boolean {
  if (!row) return false
  const cat = (row.category ?? '').trim().toLowerCase()
  if (!KATEGORI_JOINT.has(cat)) return false
  return (row.expense_date ?? '').slice(0, 10) >= JOINT_EXPENSE_BERHENTI_SEJAK
}
