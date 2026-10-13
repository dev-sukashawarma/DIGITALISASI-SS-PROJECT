/* ── OPEX versi Laba Rugi, dihitung di server ────────────────────────────────
 *
 * BUKAN berkas 'use server'. Ringkasan Bisnis memakai fungsi ini supaya kartu
 * "Beban Operasional (OPEX)"-nya sama dengan Laba Rugi Global dan Buku Kas
 * (OPEX) — dua halaman itu sumber kebenarannya.
 *
 * Urutan hitungnya sengaja sama persis dengan ProfitView (scope 'all'):
 *   1. baris `expenses` + kas kecil            (ambilPengeluaranMentah → susunBarisPengeluaran)
 *   2. mesin prorata beban tetap                (calculateProratedExpenses)
 *   3. gaji staf kantor pusat dari slip HR      (hanya saat semua outlet)
 *   4. gaji & bonus outlet diganti ringkasan HR (gantiPayrollDenganHr)
 * Kalau urutan di ProfitView berubah, ubah di sini juga.
 */
import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { ambilPengeluaranMentah } from '@/lib/pengeluaran/ambilPengeluaran'
import { susunBarisPengeluaran } from '@/lib/pengeluaran/susunBaris'
import { calculateProratedExpenses, getJakartaCurrentMonthInfo } from '@/lib/opexProrata'
import { susunBarisGajiKantor, gabungGajiKantor } from '@/lib/gajiKantorPusat'
import { barisPayrollDariHr, gantiPayrollDenganHr } from '@/lib/opexDariHr'
import { hitungRingkasanPayrollHr } from '@/lib/server/ringkasanPayrollHr'
import { getProrataAuxiliaryDataAction } from '@/app/actions/prorataAuxiliary'
import { isLemburExpense } from '@/lib/expenseCategories'
import { isTestOutlet } from '@/lib/outletFilters'
import type { ExpenseRow } from '@/lib/expenseRow'

export interface OpexLabaRugi {
  /** Beban outlet: buku kas bulanan + lembur + kas kecil. */
  outlet: number
  /** Beban kantor pusat (hanya terisi saat semua outlet). */
  pusat: number
  /** Angka kartu "Total OPEX" Laba Rugi untuk filter yang sama. */
  total: number
}

/** Jumlahkan baris OPEX dengan aturan kartu Laba Rugi. Murni, bisa diuji. */
export function jumlahkanOpexLabaRugi(rows: ExpenseRow[], semuaOutlet: boolean): OpexLabaRugi {
  let outlet = 0
  let pusat = 0
  for (const r of rows) {
    if (r.scope === 'pusat') {
      pusat += r.amount
      continue
    }
    if (r.scope !== 'outlet') continue
    if (isTestOutlet(r.outlet_id) || isTestOutlet(r.outlet_name)) continue
    // Lembur dihitung dari sumber mana pun; selain itu hanya buku kas bulanan & kas kecil.
    if (isLemburExpense(r.category, r.description) || r.source === 'monthly' || r.source === 'petty_cash') {
      outlet += r.amount
    }
  }
  if (!semuaOutlet) pusat = 0
  return { outlet, pusat, total: outlet + pusat }
}

export async function hitungOpexLabaRugi(
  filter: { from: string; to: string; outletId: string },
  outlets: { id: string; name: string; type?: string; is_active?: boolean }[],
): Promise<OpexLabaRugi> {
  // Memuat pengeluaran & gaji semua outlet lewat service client.
  await requireRole(PERAN_KEUANGAN)

  const semuaOutlet = !filter.outletId || filter.outletId === 'all'
  const f = { from: filter.from, to: filter.to, outletId: semuaOutlet ? 'all' : filter.outletId, source: 'all' as const }

  const [mentah, aux, hr] = await Promise.all([
    ambilPengeluaranMentah(createServiceClient(), f),
    getProrataAuxiliaryDataAction({ from: f.from, to: f.to }),
    // HR gagal → angka mesin prorata tetap dipakai, sama seperti di Laba Rugi.
    hitungRingkasanPayrollHr({ from: f.from, to: f.to, outletId: 'ALL_OUTLETS' }).catch(err => {
      console.error('[opex-laba-rugi] ringkasan payroll HR gagal:', err)
      return null
    }),
  ])

  const hasil = calculateProratedExpenses({
    filter: f,
    rawExpenses: susunBarisPengeluaran(mentah.expenses, mentah.pettyCashExpenses),
    payrollRecords: aux.payrollRecords || [],
    staffFinancials: aux.staffFinancials || [],
    lastMonthExpenses: aux.lastMonthExpenses || [],
    crewBonusRecords: aux.crewBonusRecords || [],
    outlets: outlets.filter(o => o.type !== 'marketplace' && o.type !== 'online'),
    managerAssignments: aux.managerAssignments || [],
    operationalOutletIds: aux.operationalOutletIds || [],
  })

  let rows = hasil.rows
  if (semuaOutlet) {
    rows = gabungGajiKantor(rows, susunBarisGajiKantor({
      from: f.from,
      to: f.to,
      officePayrollRecords: aux.officePayrollRecords || [],
      officeStaffMonthlyTotal: aux.officeStaffMonthlyTotal || 0,
      currentMonthFirstDay: getJakartaCurrentMonthInfo().firstDay,
    }))
  }

  let barisHr = barisPayrollDariHr({ hr: hr ?? undefined, from: f.from, to: f.to })
  if (barisHr && !semuaOutlet) barisHr = barisHr.filter(r => r.outlet_id === f.outletId)

  return jumlahkanOpexLabaRugi(gantiPayrollDenganHr(rows, barisHr), semuaOutlet)
}
