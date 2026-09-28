/* ── Kapan kas kecil (petty_cash_expenses) TIDAK ikut dijumlahkan ────────────
 *
 * Saat closing Agustus 2026, kas kecil tiap outlet dirangkum lalu diimpor ke
 * `expenses` sebagai baris "OPEX Agustus 2026 - Bahan Baku (Petty Cash)",
 * "... - Operasional Outlet", "... - Transport & Logistik Cabang". Untuk
 * outlet-bulan seperti itu, nota kas kecil harian sudah terwakili rangkuman,
 * jadi menjumlahkannya lagi = dobel.
 *
 * Aturan lama menganggap outlet "sudah diaudit" begitu ada SATU baris
 * expenses berkategori pengeluaran_outlet/bahan_baku/transport/dst — di bulan
 * mana pun dalam rentang. Di September 2026 baris seperti itu justru biaya
 * satuan (banner, brosur, Lalamove), sehingga seluruh kas kecil harian 4
 * outlet terbuang (Rp 9,18 jt; dua di antaranya mitra → bagi hasil kelebihan).
 *
 * Aturan baru: kas kecil outlet X di bulan M dilewati HANYA bila expenses
 * outlet X di bulan M memuat baris rangkuman berpola "OPEX <Bulan> <Tahun> - ".
 * Terverifikasi pada data: Agustus 61/61 baris pemicu berpola ini (perilaku
 * Agustus tidak berubah), September 0/37.
 */

const POLA_REKAP_OPEX = /^\s*OPEX\s+\S+\s+\d{4}\s+-\s/i

export function adalahRekapOpexBulanan(description: string | null | undefined): boolean {
  return !!description && POLA_REKAP_OPEX.test(description)
}

interface BarisExpense {
  outlet_id: string | null
  description?: string | null
  expense_date: string
}

interface BarisKasKecil {
  outlet_id: string | null
  expense_date: string
}

/** Kembalikan predikat: `true` = kas kecil ini tetap dijumlahkan. */
export function buatSaringanKasKecil(expenses: BarisExpense[]): (p: BarisKasKecil) => boolean {
  const teraudit = new Set<string>()
  for (const e of expenses) {
    if (e.outlet_id && adalahRekapOpexBulanan(e.description)) {
      teraudit.add(`${e.outlet_id}|${e.expense_date.slice(0, 7)}`)
    }
  }
  return (p) => !p.outlet_id || !teraudit.has(`${p.outlet_id}|${p.expense_date.slice(0, 7)}`)
}
