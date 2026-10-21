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
