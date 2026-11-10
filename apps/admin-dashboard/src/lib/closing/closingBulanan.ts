import { LABA_KOTOR_INTERNAL_CLOSING_SEPT_2026, type KomponenLabaKotor } from './labaKotorInternalClosingSeptember2026'
import { PENDAPATAN_MITRA_CLOSING_SEPT_2026, type PendapatanMitraClosing } from './pendapatanMitraClosingSeptember2026'
import { LABA_KOTOR_INTERNAL_CLOSING_OKT_2026, PENDAPATAN_MITRA_CLOSING_OKT_2026 } from './closingOktober2026'
import { MITRA_CLOSING_DATA_OKTOBER_2026 } from '@/app/actions/mitraPnlClosingDataOktober2026'
import type { MitraMonthlyClosingOutlet } from '@/app/actions/mitraPnlClosingData'
import type { ExpenseRow } from '@/lib/expenseRow'

/* Closing bulanan Laba Rugi Internal (semua outlet): daftar bulan yang angkanya
 * mengikuti laporan resmi. Hanya berlaku untuk rentang tepat satu bulan penuh. */

interface BulanLabaKotor {
  label: string
  from: string
  to: string
  total: KomponenLabaKotor
  /** null = pendapatan lain-lain tetap data apa adanya. */
  pendapatanLain: number | null
}

const BULAN_LABA_KOTOR: BulanLabaKotor[] = [
  { label: 'September 2026', ...pick(LABA_KOTOR_INTERNAL_CLOSING_SEPT_2026), pendapatanLain: null },
  { label: LABA_KOTOR_INTERNAL_CLOSING_OKT_2026.label, ...pick(LABA_KOTOR_INTERNAL_CLOSING_OKT_2026), pendapatanLain: LABA_KOTOR_INTERNAL_CLOSING_OKT_2026.pendapatanLain },
]

const BULAN_PENDAPATAN_MITRA: { from: string; to: string; outlets: Record<string, PendapatanMitraClosing> }[] = [
  PENDAPATAN_MITRA_CLOSING_SEPT_2026,
  PENDAPATAN_MITRA_CLOSING_OKT_2026,
]

function pick(d: { from: string; to: string; total: KomponenLabaKotor }) {
  return { from: d.from, to: d.to, total: d.total }
}

export interface PenyesuaianLabaKotor extends KomponenLabaKotor {
  /** Nama bulan closing, untuk label baris penyesuaian. */
  label: string
  /** Pendapatan lain-lain versi closing; null = pakai data apa adanya. */
  pendapatanLain: number | null
}

/** Penyesuaian (target − live) per komponen untuk bulan closing.
 *  komisiTiktokKedua tidak punya padanan live, jadi nilainya = target penuh. */
export function penyesuaianLabaKotorClosing(
  from: string,
  to: string,
  live: { omzet: number; potongan: number; hpp: number; waste: number },
): PenyesuaianLabaKotor | null {
  const b = BULAN_LABA_KOTOR.find(m => m.from === from && m.to === to)
  if (!b) return null
  return {
    label: b.label,
    pendapatanLain: b.pendapatanLain,
    omzet: b.total.omzet - live.omzet,
    potongan: b.total.potongan - live.potongan,
    komisiTiktokKedua: b.total.komisiTiktokKedua,
    hpp: b.total.hpp - live.hpp,
    waste: b.total.waste - live.waste,
  }
}

/* Laba Rugi Mitra (semua outlet): bulan yang tabnya mengikuti laporan closing
 * per outlet mitra. September sengaja tidak termasuk (tab itu tetap data asli). */
const BULAN_LABA_RUGI_MITRA: { label: string; from: string; to: string; data: Record<string, MitraMonthlyClosingOutlet> }[] = [
  { label: 'Oktober 2026', from: '2026-10-01', to: '2026-10-31', data: MITRA_CLOSING_DATA_OKTOBER_2026 },
]

export interface ClosingLabaRugiMitra {
  label: string
  from: string
  to: string
  data: Record<string, MitraMonthlyClosingOutlet>
}

/** Closing tab Laba Rugi Mitra untuk rentang tepat satu bulan closing. */
export function closingLabaRugiMitraUntuk(from: string, to: string): ClosingLabaRugiMitra | null {
  return BULAN_LABA_RUGI_MITRA.find(m => m.from === from && m.to === to) ?? null
}

/** Total fee manajemen versi closing (seluruh outlet mitra). */
export function feeManajemenClosingMitra(c: ClosingLabaRugiMitra): number {
  return Object.values(c.data).reduce((s, o) => s + o.totals.managementFeeAmount, 0)
}

/** Penyesuaian (target − live) omzet, potongan, HPP, waste untuk tab Laba Rugi Mitra. */
export function penyesuaianLabaRugiMitraClosing(
  c: ClosingLabaRugiMitra,
  live: { omzet: number; potongan: number; hpp: number; waste: number },
): PenyesuaianLabaKotor {
  const t = Object.values(c.data).reduce(
    (a, o) => ({
      omzet: a.omzet + o.totals.grossRevenue,
      potongan: a.potongan + o.totals.totalDeductions,
      hpp: a.hpp + o.totals.totalCogs,
      waste: a.waste + o.totals.totalWaste,
    }),
    { omzet: 0, potongan: 0, hpp: 0, waste: 0 },
  )
  return {
    label: c.label,
    pendapatanLain: null,
    omzet: t.omzet - live.omzet,
    potongan: t.potongan - live.potongan,
    komisiTiktokKedua: 0,
    hpp: t.hpp - live.hpp,
    waste: t.waste - live.waste,
  }
}

/** Baris OPEX penyesuaian per outlet mitra agar OPEX tiap outlet = laporan closing.
 *  Outlet mitra yang tidak ada di laporan ditargetkan nol. */
export function barisPenyesuaianOpexMitra(c: ClosingLabaRugiMitra, rows: ExpenseRow[], mitraOutletIds: Iterable<string>): ExpenseRow[] {
  const live = new Map<string, { amount: number; nama: string }>()
  for (const r of rows) {
    if (r.scope !== 'outlet' || !r.outlet_id) continue
    const cur = live.get(r.outlet_id) ?? { amount: 0, nama: r.outlet_name ?? '' }
    cur.amount += Number(r.amount) || 0
    live.set(r.outlet_id, cur)
  }
  const ids = new Set<string>([...Object.keys(c.data), ...mitraOutletIds])
  for (const id of live.keys()) ids.add(id)
  const hasil: ExpenseRow[] = []
  for (const id of ids) {
    const target = c.data[id]?.totals.totalOpex ?? 0
    const cur = live.get(id)
    const selisih = target - (cur?.amount ?? 0)
    if (Math.abs(selisih) < 0.005) continue
    const description = `Penyesuaian closing ${c.label}`
    hasil.push({
      id: `closing-mitra-${c.from}-${id}`,
      outlet_id: id,
      outlet_name: c.data[id]?.name ?? cur?.nama ?? null,
      category: 'pengeluaran_outlet',
      scope: 'outlet',
      amount: selisih,
      description,
      expense_date: c.to,
      period_month: c.from,
      source: 'monthly',
      type: 'expense',
      raw_category: 'pengeluaran_outlet',
      raw_description: description,
    })
  }
  return hasil
}

/** Total pendapatan pusat dari mitra versi closing untuk bulan closing. */
export function pendapatanMitraClosingUntuk(from: string, to: string): { feeManajemen: number; marginHpp: number } | null {
  const p = BULAN_PENDAPATAN_MITRA.find(m => m.from === from && m.to === to)
  if (!p) return null
  let feeManajemen = 0
  let marginHpp = 0
  for (const o of Object.values(p.outlets)) {
    feeManajemen += o.bagiHasilSs
    marginHpp += o.marginHpp
  }
  return { feeManajemen, marginHpp }
}
