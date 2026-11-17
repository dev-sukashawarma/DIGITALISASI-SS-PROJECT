/* ── Gaji staf kantor pusat (HR) sebagai biaya pusat di Laba Rugi ────────────
 *
 * Keputusan owner 13 Okt 2026. Sebelumnya Laba Rugi hanya mengambil gaji kru
 * outlet + manajer dari slip HR; slip staf kantor pusat (staff_pusat,
 * developer, admin_hr, admin_finance, purchasing, dst.) tidak masuk ke mana
 * pun, sehingga laba perusahaan kelebihan ±Rp 74 juta per bulan.
 *
 * Berlaku mulai September 2026. Agustus 2026 TIDAK disentuh: gaji kantornya
 * sudah diinput manual saat closing dan dibagi ke outlet (`gaji_staff_kantor`).
 */

import type { ExpenseRow } from '@/lib/expenseRow'
import { getPeriodsInRange } from '@/lib/opexDateRangeProrata'

export const GAJI_KANTOR_HR_BERLAKU_SEJAK = '2026-09-01'

export interface OfficePayrollRecord {
  period_month: number
  period_year: number
  total_salary: number
}

export interface BarisGajiKantorInput {
  from: string
  to: string
  /** Slip gaji HR staf kantor pusat (sudah disaring dari akun tes/bot). */
  officePayrollRecords?: OfficePayrollRecord[]
  /** Total gaji bulanan master staf kantor aktif — cadangan bulan berjalan sebelum slip dibuat. */
  officeStaffMonthlyTotal?: number
  /** Bulan berjalan (WIB), format YYYY-MM-01. Cadangan master hanya dipakai untuk bulan ini. */
  currentMonthFirstDay?: string
}

/**
 * Baris biaya pusat "Gaji Staff Kantor" per bulan dalam rentang, diprorata
 * menurut jumlah hari yang tercakup (sama dengan gaji kru outlet).
 */
export function susunBarisGajiKantor(input: BarisGajiKantorInput): ExpenseRow[] {
  const { from, to, officePayrollRecords = [], officeStaffMonthlyTotal = 0, currentMonthFirstDay } = input
  const rows: ExpenseRow[] = []

  for (const p of getPeriodsInRange(from, to)) {
    if (p.firstDay < GAJI_KANTOR_HR_BERLAKU_SEJAK) continue

    let bulanan = officePayrollRecords
      .filter(r => r.period_month === p.month && r.period_year === p.year)
      .reduce((s, r) => s + (Number(r.total_salary) || 0), 0)
    let sumber = 'HR Payroll'

    if (bulanan <= 0 && currentMonthFirstDay === p.firstDay && officeStaffMonthlyTotal > 0) {
      bulanan = officeStaffMonthlyTotal
      sumber = 'Master Gaji HR'
    }
    if (bulanan <= 0) continue

    const keterangan = p.isFullMonth
      ? `Gaji Staff Kantor Pusat (${sumber})`
      : `Prorata Gaji Staff Kantor Pusat (${p.overlapDays}/${p.totalDays} bln · ${sumber})`

    rows.push({
      id: `hr-gaji-kantor-${p.year}-${p.month}`,
      outlet_id: null,
      outlet_name: 'Kantor Pusat',
      category: 'gaji_staff_kantor',
      scope: 'pusat',
      amount: Math.round(bulanan * p.ratio),
      description: keterangan,
      expense_date: p.lastDay < to ? p.lastDay : to,
      period_month: p.firstDay,
      source: 'monthly',
    })
  }

  return rows
}

/**
 * Gabungkan baris gaji kantor dari HR ke daftar pengeluaran. Baris manual
 * `gaji_staff_kantor` scope pusat pada bulan yang sama dibuang supaya tidak
 * terhitung dua kali.
 */
export function gabungGajiKantor(rows: ExpenseRow[], barisHr: ExpenseRow[]): ExpenseRow[] {
  if (barisHr.length === 0) return rows
  const bulanHr = new Set(barisHr.map(r => r.period_month.slice(0, 7)))
  const sisa = rows.filter(r => !(
    r.scope === 'pusat' &&
    r.category === 'gaji_staff_kantor' &&
    bulanHr.has((r.expense_date || r.period_month || '').slice(0, 7))
  ))
  return [...sisa, ...barisHr]
}
