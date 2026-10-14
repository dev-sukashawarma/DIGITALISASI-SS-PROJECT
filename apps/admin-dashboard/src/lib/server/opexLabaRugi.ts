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
import { terapkanClosingOpex } from '@/lib/closing/terapkanClosingOpex'
import { hitungRingkasanPayrollHr } from '@/lib/server/ringkasanPayrollHr'
import { getProrataAuxiliaryDataAction } from '@/app/actions/prorataAuxiliary'
import { isLemburExpense } from '@/lib/expenseCategories'
import { isTestOutlet } from '@/lib/outletFilters'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import type { ExpenseRow } from '@/lib/expenseRow'

export interface OpexLabaRugi {
  /** Beban outlet: buku kas bulanan + lembur + kas kecil. */
  outlet: number
  /** Beban kantor pusat (hanya terisi saat semua outlet). */
  pusat: number
  /** Angka kartu "Total OPEX" Laba Rugi untuk filter yang sama. */
  total: number
}

const OPEX_LIVE_TTL_MS = 30_000
const OPEX_PAST_TTL_MS = 300_000
const MAX_OPEX_MEMO_ENTRIES = 32

type RawOpexRangeBundle = {
  mentahAll: { expenses: any[]; pettyCashExpenses: any[] }
  aux: any
  hr: any
}

const opexRangeRawMemo = new Map<string, { expiresAt: number; promise: Promise<RawOpexRangeBundle> }>()
const opexResultMemo = new Map<string, { expiresAt: number; value: OpexLabaRugi }>()
const wasteRangeMemo = new Map<string, { expiresAt: number; promise: Promise<any[]> }>()

function pruneMap<K, V extends { expiresAt: number }>(map: Map<K, V>, maxEntries: number) {
  const now = Date.now()
  for (const [k, v] of map) {
    if (v.expiresAt <= now) map.delete(k)
  }
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value
    if (oldestKey === undefined) break
    map.delete(oldestKey)
  }
}

export function clearOpexLabaRugiMemo() {
  opexRangeRawMemo.clear()
  opexResultMemo.clear()
  wasteRangeMemo.clear()
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

async function getRawOpexRangeBundle(from: string, to: string): Promise<RawOpexRangeBundle> {
  const key = `${from}|${to}`
  const now = Date.now()
  const hit = opexRangeRawMemo.get(key)
  if (hit && hit.expiresAt > now) {
    opexRangeRawMemo.delete(key)
    opexRangeRawMemo.set(key, hit)
    return hit.promise
  }

  const today = jakartaDate(new Date())
  const ttl = to >= today ? OPEX_LIVE_TTL_MS : OPEX_PAST_TTL_MS

  const promise = Promise.all([
    ambilPengeluaranMentah(createServiceClient(), { from, to, outletId: 'all', source: 'all' }),
    getProrataAuxiliaryDataAction({ from, to }),
    // HR gagal → angka mesin prorata tetap dipakai, sama seperti di Laba Rugi.
    hitungRingkasanPayrollHr({ from, to, outletId: 'ALL_OUTLETS' }).catch(err => {
      console.error('[opex-laba-rugi] ringkasan payroll HR gagal:', err)
      return null
    }),
  ]).then(([mentahAll, aux, hr]) => ({ mentahAll, aux, hr }))

  opexRangeRawMemo.set(key, { expiresAt: now + ttl, promise })
  promise.catch(() => {
    if (opexRangeRawMemo.get(key)?.promise === promise) opexRangeRawMemo.delete(key)
  })
  pruneMap(opexRangeRawMemo, MAX_OPEX_MEMO_ENTRIES)
  return promise
}

/** Baris OPEX versi Laba Rugi (sudah termasuk penyesuaian closing). Tanpa cek peran & memo hasil. */
export async function susunBarisOpexLabaRugi(
  filter: { from: string; to: string; outletId: string },
  outlets: { id: string; name: string; type?: string; is_active?: boolean }[],
): Promise<{ rows: ExpenseRow[]; semuaOutlet: boolean }> {
  const semuaOutlet = !filter.outletId || filter.outletId === 'all'
  const f = { from: filter.from, to: filter.to, outletId: semuaOutlet ? 'all' : filter.outletId, source: 'all' as const }
  const { mentahAll, aux, hr } = await getRawOpexRangeBundle(f.from, f.to)

  const filteredExpenses = semuaOutlet
    ? mentahAll.expenses
    : f.outletId === 'PUSAT'
      ? mentahAll.expenses.filter((e: any) => !e.outlet_id || e.outlet_id === 'ffffffff-ffff-ffff-ffff-ffffffffffff')
      : mentahAll.expenses.filter((e: any) => e.outlet_id === f.outletId)

  const filteredPettyCash = semuaOutlet
    ? mentahAll.pettyCashExpenses
    : f.outletId === 'PUSAT'
      ? []
      : mentahAll.pettyCashExpenses.filter((p: any) => p.outlet_id === f.outletId)

  const hasil = calculateProratedExpenses({
    filter: f,
    rawExpenses: susunBarisPengeluaran(filteredExpenses, filteredPettyCash),
    payrollRecords: aux.payrollRecords || [],
    staffFinancials: aux.staffFinancials || [],
    lastMonthExpenses: aux.lastMonthExpenses || [],
    crewBonusRecords: aux.crewBonusRecords || [],
    outlets: outlets.filter(o => o.type !== 'marketplace' && o.type !== 'online'),
    managerAssignments: aux.managerAssignments || [],
    operationalOutletIds: aux.operationalOutletIds || [],
  })

  let rowsProrataDanKantor = hasil.rows
  if (semuaOutlet) {
    rowsProrataDanKantor = gabungGajiKantor(rowsProrataDanKantor, susunBarisGajiKantor({
      from: f.from,
      to: f.to,
      officePayrollRecords: aux.officePayrollRecords || [],
      officeStaffMonthlyTotal: aux.officeStaffMonthlyTotal || 0,
      currentMonthFirstDay: getJakartaCurrentMonthInfo().firstDay,
    }))
  }

  let barisHr = barisPayrollDariHr({ hr: hr ?? undefined, from: f.from, to: f.to })
  if (barisHr && !semuaOutlet) barisHr = barisHr.filter(r => r.outlet_id === f.outletId)

  const rows = terapkanClosingOpex(gantiPayrollDenganHr(rowsProrataDanKantor, barisHr), {
    from: f.from,
    to: f.to,
    outletId: f.outletId,
  }).rows
  return { rows, semuaOutlet }
}

export async function hitungOpexLabaRugi(
  filter: { from: string; to: string; outletId: string },
  outlets: { id: string; name: string; type?: string; is_active?: boolean }[],
  opts?: { skipRoleCheck?: boolean },
): Promise<OpexLabaRugi> {
  // Memuat pengeluaran & gaji semua outlet lewat service client.
  if (!opts?.skipRoleCheck) {
    await requireRole(PERAN_KEUANGAN)
  }

  const semuaOutlet = !filter.outletId || filter.outletId === 'all'
  const f = { from: filter.from, to: filter.to, outletId: semuaOutlet ? 'all' : filter.outletId, source: 'all' as const }

  const resultKey = `${f.from}|${f.to}|${f.outletId}|${outlets.length}`
  const now = Date.now()
  const cachedResult = opexResultMemo.get(resultKey)
  if (cachedResult && cachedResult.expiresAt > now) {
    opexResultMemo.delete(resultKey)
    opexResultMemo.set(resultKey, cachedResult)
    return cachedResult.value
  }

  const { rows } = await susunBarisOpexLabaRugi(filter, outlets)
  const computed = jumlahkanOpexLabaRugi(rows, semuaOutlet)
  const today = jakartaDate(new Date())
  const ttl = f.to >= today ? OPEX_LIVE_TTL_MS : OPEX_PAST_TTL_MS
  opexResultMemo.set(resultKey, { expiresAt: Date.now() + ttl, value: computed })
  pruneMap(opexResultMemo, MAX_OPEX_MEMO_ENTRIES * 2)

  return computed
}

export async function hitungWastePeriode(
  supabase: any,
  filter: { from: string; to: string; outletId: string },
): Promise<number> {
  const key = `${filter.from}|${filter.to}`
  const now = Date.now()
  let hit = wasteRangeMemo.get(key)
  if (!hit || hit.expiresAt <= now) {
    const today = jakartaDate(new Date())
    const ttl = filter.to >= today ? OPEX_LIVE_TTL_MS : OPEX_PAST_TTL_MS
    const promise = Promise.resolve(
      supabase.rpc('get_waste_periode', { p_from: filter.from, p_to: filter.to })
    ).then((res: any) => {
      if (res.error) throw res.error
      return (res.data ?? []) as any[]
    })
    hit = { expiresAt: now + ttl, promise }
    wasteRangeMemo.set(key, hit)
    promise.catch(() => {
      if (wasteRangeMemo.get(key)?.promise === promise) wasteRangeMemo.delete(key)
    })
    pruneMap(wasteRangeMemo, MAX_OPEX_MEMO_ENTRIES)
  } else {
    wasteRangeMemo.delete(key)
    wasteRangeMemo.set(key, hit)
  }

  const rows = await hit.promise
  const semuaOutlet = !filter.outletId || filter.outletId === 'all'
  let total = 0
  for (const r of rows) {
    if (isTestOutlet(r.outlet_id)) continue
    if (!semuaOutlet && r.outlet_id !== filter.outletId) continue
    total += Number(r.nilai_waste) || 0
  }
  return total
}
