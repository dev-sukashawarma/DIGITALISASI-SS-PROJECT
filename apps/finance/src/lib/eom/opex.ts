/* ── EOM Closing: tab OPEX ─────────────────────────────────────────────────
 *
 * Baris biaya berasal dari `useExpenses` — hook yang sama dengan halaman
 * Pengeluaran & Rekap Bulanan (scope 'pusat' / 'outlet' ditentukan di sana).
 * Di sini baris hanya dikelompokkan: Global (pusat), Internal, Mitra
 * (berdasarkan outlets.type, sama dengan aturan HPP x1,1 dan Profit), lalu
 * dicek kelengkapannya terhadap bulan lalu. Tidak ada angka yang diubah.
 */

import { isTestOutlet } from '@/lib/outletFilters'

export type OpexGroup = 'global' | 'internal' | 'mitra'

export interface OpexRowLite {
  outlet_id: string | null
  category: string
  scope: 'outlet' | 'pusat'
  amount: number
}

export interface OutletLite {
  id: string
  name: string
  type?: string | null
  is_active?: boolean | null
}

export interface OpexUnit {
  /** 'PUSAT' untuk biaya global. */
  unitId: string
  unitName: string
  group: OpexGroup
  total: number
  totalPrev: number
  byCategory: Record<string, number>
  byCategoryPrev: Record<string, number>
  /** Kategori yang terisi bulan lalu tetapi belum ada bulan ini. */
  missing: string[]
  /** Kategori baru bulan ini (tidak ada bulan lalu) — informasi saja. */
  added: string[]
}

export interface OpexSummary {
  units: OpexUnit[]
  totals: Record<OpexGroup, { total: number; totalPrev: number; missingCount: number; unitCount: number }>
}

const PUSAT_ID = 'PUSAT'

function unitOf(row: OpexRowLite, outletById: Map<string, OutletLite>): { id: string; name: string; group: OpexGroup } | null {
  if (row.scope === 'pusat' || !row.outlet_id) return { id: PUSAT_ID, name: 'Kantor Pusat (Global)', group: 'global' }
  if (isTestOutlet(row.outlet_id)) return null
  const outlet = outletById.get(row.outlet_id)
  if (outlet && isTestOutlet(outlet)) return null
  return {
    id: row.outlet_id,
    name: outlet?.name ?? 'Outlet Tidak Dikenal',
    group: outlet?.type === 'mitra' ? 'mitra' : 'internal',
  }
}

export function buildOpexSummary(current: OpexRowLite[], previous: OpexRowLite[], outlets: OutletLite[]): OpexSummary {
  const outletById = new Map(outlets.map((o) => [o.id, o]))
  const units = new Map<string, OpexUnit & { prevCats: Set<string> }>()

  const ensure = (u: { id: string; name: string; group: OpexGroup }) => {
    let cur = units.get(u.id)
    if (!cur) {
      cur = { unitId: u.id, unitName: u.name, group: u.group, total: 0, totalPrev: 0, byCategory: {}, byCategoryPrev: {}, missing: [], added: [], prevCats: new Set() }
      units.set(u.id, cur)
    }
    return cur
  }

  for (const r of current) {
    const u = unitOf(r, outletById)
    if (!u) continue
    const cur = ensure(u)
    const amt = Number(r.amount) || 0
    cur.total += amt
    cur.byCategory[r.category] = (cur.byCategory[r.category] ?? 0) + amt
  }
  for (const r of previous) {
    const u = unitOf(r, outletById)
    if (!u) continue
    // Outlet yang sudah dinonaktifkan tidak diwajibkan mengisi bulan ini.
    if (u.id !== PUSAT_ID && outletById.get(u.id)?.is_active === false) continue
    const cur = ensure(u)
    const amt = Number(r.amount) || 0
    cur.totalPrev += amt
    cur.byCategoryPrev[r.category] = (cur.byCategoryPrev[r.category] ?? 0) + amt
    cur.prevCats.add(r.category)
  }

  const list: OpexUnit[] = [...units.values()].map(({ prevCats, ...u }) => {
    const currCats = new Set(Object.keys(u.byCategory))
    return {
      ...u,
      missing: [...prevCats].filter((c) => !currCats.has(c)).sort(),
      added: [...currCats].filter((c) => !prevCats.has(c)).sort(),
    }
  })

  const totals = {
    global: { total: 0, totalPrev: 0, missingCount: 0, unitCount: 0 },
    internal: { total: 0, totalPrev: 0, missingCount: 0, unitCount: 0 },
    mitra: { total: 0, totalPrev: 0, missingCount: 0, unitCount: 0 },
  }
  for (const u of list) {
    const t = totals[u.group]
    t.total += u.total
    t.totalPrev += u.totalPrev
    t.missingCount += u.missing.length
    t.unitCount += 1
  }

  list.sort((a, b) => b.missing.length - a.missing.length || b.total - a.total)
  return { units: list, totals }
}

/** Bulan sebelumnya dari (year, month 1-12). */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}
