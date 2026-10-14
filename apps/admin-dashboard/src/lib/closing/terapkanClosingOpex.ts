import type { ExpenseRow } from '@/lib/expenseRow'
import { isLemburExpense } from '@/lib/expenseCategories'
import {
  BARIS_OPEX_OUTLET,
  BARIS_OPEX_PUSAT,
  CLOSING_OPEX_INTERNAL_SEPT_2026 as C,
  type BarisOpexOutlet,
  type BarisOpexPusat,
} from './opexClosingInternalSeptember2026'

/* ── Closing OPEX internal September 2026 ────────────────────────────────────
 *
 * Menyamakan tabel OPEX September 2026 dengan sheet FIXED SEPTEMBER 2026.
 * Baris data asli TIDAK diubah; untuk tiap (outlet, baris OPEX) yang berbeda
 * dari target ditambahkan satu baris "Penyesuaian closing" = target − data.
 * Hanya berlaku untuk rentang tepat 1–30 September 2026. Spec:
 * docs/superpowers/specs/2026-10-14-closing-opex-internal-september-design.md
 *
 * File ini identik dengan apps/finance/src/lib/closing/terapkanClosingOpex.ts.
 */

export const SS_ONLINE_ID = 'ss-online'
export const GUDANG_SS_ONLINE_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'
export const AWALAN_ID_PENYESUAIAN = 'closing-sep26-'

const KANTOR_PUSAT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const CATATAN_TERAPKAN = 'OPEX September 2026 disesuaikan dengan laporan closing (sheet FIXED SEPTEMBER 2026).'
const CATATAN_SEBAGIAN = 'Closing OPEX September 2026 hanya berlaku untuk rentang 1–30 September; rentang ini memakai data apa adanya.'
const ALASAN_DEFAULT = 'Menyamakan dengan laporan closing September 2026'

export interface FilterClosing { from: string; to: string; outletId: string }
export interface HasilClosing { rows: ExpenseRow[]; diterapkan: boolean; catatan: string | null }

export function rentangClosingTepat(from: string, to: string): boolean {
  return from === C.from && to === C.to
}

/** Pemetaan sama dengan ekspor Laba Rugi (profitExportService). */
export function barisOutletDari(r: Pick<ExpenseRow, 'category' | 'description'>): BarisOpexOutlet {
  const c = String(r.category ?? '').toLowerCase()
  if (isLemburExpense(c, r.description)) return 'lembur'
  if (c === 'gaji_crew_outlet' || c === 'salary' || c === 'gaji') return 'gaji_crew_outlet'
  if (c === 'bonus_crew' || c === 'bonus_leader') return 'bonus_crew'
  if (c === 'bonus_area_manager' || c === 'bonus_korlap') return 'bonus_area_manager'
  if (c === 'bonus_regional_manager') return 'bonus_regional_manager'
  if (c === 'ads' || c === 'iklan' || c === 'marketing_ads') return 'ads'
  if (c === 'endorsement' || c === 'marcom') return 'endorsement'
  if (c === 'promo' || c === 'diskon') return 'promo'
  if (c === 'pdam' || c === 'air') return 'pdam'
  if (c === 'pln' || c === 'listrik') return 'pln'
  if (c === 'internet' || c === 'wifi') return 'internet'
  if (c === 'sewa_outlet' || c === 'sewa') return 'sewa_outlet'
  return 'pengeluaran_outlet'
}

/** Baris pusat dipetakan menurut kategori saja (lembur pusat masuk Pengeluaran Global). */
export function barisPusatDari(r: Pick<ExpenseRow, 'category'>): BarisOpexPusat {
  const c = String(r.category ?? '').toLowerCase()
  if (c === 'pdam' || c === 'air') return 'pdam'
  if (c === 'pln' || c === 'listrik') return 'pln'
  if (c === 'internet' || c === 'wifi') return 'internet'
  if (c === 'gaji_staff_kantor') return 'gaji_staff_kantor'
  if (c === 'salary') return 'crew_backup'
  if (c === 'transport') return 'transport'
  if (c === 'bahan_baku') return 'bahan_baku'
  if (c === 'ads' || c === 'iklan' || c === 'marketing_ads') return 'ads'
  return 'pengeluaran_global'
}

const KATEGORI_PUSAT: Record<BarisOpexPusat, ExpenseRow['category']> = {
  pdam: 'pdam',
  pln: 'pln',
  internet: 'internet',
  pengeluaran_global: 'pengeluaran_global',
  gaji_staff_kantor: 'gaji_staff_kantor',
  crew_backup: 'salary',
  transport: 'transport',
  bahan_baku: 'bahan_baku',
  ads: 'ads',
}

function cakupan(outletId: string): { outlets: string[]; pusat: boolean } {
  if (outletId === 'all') return { outlets: Object.keys(C.outlets), pusat: true }
  if (outletId === 'PUSAT' || outletId === KANTOR_PUSAT_ID) return { outlets: [], pusat: true }
  const id = outletId === GUDANG_SS_ONLINE_ID ? SS_ONLINE_ID : outletId
  return { outlets: C.outlets[id] ? [id] : [], pusat: false }
}

function barisPenyesuaian(p: {
  kunci: string
  outletId: string | null
  outletName: string
  scope: 'outlet' | 'pusat'
  category: ExpenseRow['category']
  amount: number
  alasan: string
}): ExpenseRow {
  const description = `Penyesuaian closing September 2026 — ${p.alasan}`
  return {
    id: `${AWALAN_ID_PENYESUAIAN}${p.kunci}`,
    outlet_id: p.outletId,
    outlet_name: p.outletName,
    category: p.category,
    scope: p.scope,
    amount: p.amount,
    description,
    expense_date: C.to,
    period_month: C.from,
    source: 'monthly',
    type: 'expense',
    raw_category: p.category,
    raw_description: description,
  }
}

export function terapkanClosingOpex(rows: ExpenseRow[], filter: FilterClosing): HasilClosing {
  if (!rentangClosingTepat(filter.from, filter.to)) {
    const memotong = filter.from <= C.to && filter.to >= C.from
    return { rows, diterapkan: false, catatan: memotong ? CATATAN_SEBAGIAN : null }
  }
  const lingkup = cakupan(filter.outletId)
  if (lingkup.outlets.length === 0 && !lingkup.pusat) return { rows, diterapkan: false, catatan: null }

  const dipetakan = rows.map(r =>
    r.scope === 'outlet' && r.outlet_id === GUDANG_SS_ONLINE_ID
      ? { ...r, outlet_id: SS_ONLINE_ID, outlet_name: C.outlets[SS_ONLINE_ID].nama }
      : r,
  )

  const dataOutlet = new Map<string, Record<string, number>>()
  const dataPusat: Record<string, number> = {}
  for (const r of dipetakan) {
    if (r.scope === 'outlet' && r.outlet_id && lingkup.outlets.includes(r.outlet_id)) {
      const m = dataOutlet.get(r.outlet_id) ?? {}
      const k = barisOutletDari(r)
      m[k] = (m[k] ?? 0) + (Number(r.amount) || 0)
      dataOutlet.set(r.outlet_id, m)
    } else if (r.scope === 'pusat' && lingkup.pusat) {
      const k = barisPusatDari(r)
      dataPusat[k] = (dataPusat[k] ?? 0) + (Number(r.amount) || 0)
    }
  }

  const tambahan: ExpenseRow[] = []
  for (const id of lingkup.outlets) {
    const o = C.outlets[id]
    const data = dataOutlet.get(id) ?? {}
    for (const b of BARIS_OPEX_OUTLET) {
      const selisih = o.target[b] - (data[b] ?? 0)
      if (Math.abs(selisih) < 0.005) continue
      tambahan.push(barisPenyesuaian({
        kunci: `${id}-${b}`,
        outletId: id,
        outletName: o.nama,
        scope: 'outlet',
        category: b,
        amount: selisih,
        alasan: o.alasan[b] ?? ALASAN_DEFAULT,
      }))
    }
  }
  if (lingkup.pusat) {
    for (const b of BARIS_OPEX_PUSAT) {
      const selisih = C.pusat.target[b] - (dataPusat[b] ?? 0)
      if (Math.abs(selisih) < 0.005) continue
      tambahan.push(barisPenyesuaian({
        kunci: `pusat-${b}`,
        outletId: null,
        outletName: 'Kantor Pusat',
        scope: 'pusat',
        category: KATEGORI_PUSAT[b],
        amount: selisih,
        alasan: C.pusat.alasan[b] ?? ALASAN_DEFAULT,
      }))
    }
  }

  return { rows: [...dipetakan, ...tambahan], diterapkan: true, catatan: CATATAN_TERAPKAN }
}
