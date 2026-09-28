/* ── EOM Closing: tab OPEX ─────────────────────────────────────────────────
 *
 * Baris biaya berasal dari `useExpenses` — hook yang sama dengan halaman
 * Pengeluaran & Rekap Bulanan (scope 'pusat' / 'outlet' ditentukan di sana).
 * Pengelompokan: Global (pusat), Internal, Mitra (berdasarkan outlets.type).
 * Dikelompokkan per kluster beban: Tenaga Kerja, Tempat & Utilitas, Pemasaran,
 * Operasional Toko & Pusat, serta seksi khusus Non-OPEX (Bahan Baku Kas Toko).
 * Mendukung penandaan kategori nihil / memang tidak ada bulan ini.
 */

import { isTestOutlet } from '@/lib/outletFilters'
import { CATEGORY_META } from '@/lib/expenseCategories'

export type OpexGroup = 'global' | 'internal' | 'mitra'

export type OpexClusterKey = 'tenaga_kerja' | 'utilitas_sewa' | 'marketing' | 'operasional' | 'non_opex'

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

export interface OpexExemption {
  unitId: string
  category: string
  quickReason?: string | null
  notes?: string | null
  markedBy?: string | null
  markedAt?: string | null
}

export interface OpexCategoryItem {
  category: string
  label: string
  current: number
  previous: number
  diff: number
  diffPct: number | null
  status: 'normal' | 'missing' | 'added' | 'nihil'
  exemption?: OpexExemption
}

export interface OpexClusterGroup {
  key: OpexClusterKey
  label: string
  desc: string
  color: string
  isNonOpex?: boolean
  total: number
  totalPrev: number
  diff: number
  diffPct: number | null
  categories: OpexCategoryItem[]
}

export interface OpexUnit {
  /** 'PUSAT' untuk biaya global. */
  unitId: string
  unitName: string
  group: OpexGroup
  /** Total OPEX Murni (tidak termasuk Bahan Baku / Non-OPEX) */
  total: number
  totalPrev: number
  /** Belanja bahan baku darurat kas toko (Non-OPEX / COGS) */
  nonOpexTotal: number
  nonOpexTotalPrev: number
  /** Total gabungan keseluruhan */
  grandTotal: number
  grandTotalPrev: number
  byCategory: Record<string, number>
  byCategoryPrev: Record<string, number>
  /** Kategori bulan lalu yang belum diisi dan belum ditandai nihil */
  missing: string[]
  /** Kategori yang telah diverifikasi nihil / memang tidak ada bulan ini */
  exempted: string[]
  /** Kategori baru bulan ini (tidak ada bulan lalu) */
  added: string[]
  /** Pengelompokan kategori ke dalam kluster beban */
  clusters: OpexClusterGroup[]
}

export interface OpexSummary {
  units: OpexUnit[]
  totals: Record<OpexGroup, {
    total: number
    totalPrev: number
    nonOpexTotal: number
    nonOpexTotalPrev: number
    grandTotal: number
    grandTotalPrev: number
    missingCount: number
    exemptedCount: number
    unitCount: number
  }>
  clusterTotals: Record<OpexClusterKey, {
    key: OpexClusterKey
    label: string
    isNonOpex?: boolean
    total: number
    totalPrev: number
    diff: number
    diffPct: number | null
  }>
}

export const CLUSTER_CONFIG: Record<OpexClusterKey, { label: string; desc: string; color: string; isNonOpex?: boolean }> = {
  tenaga_kerja: {
    label: 'Tenaga Kerja',
    desc: 'Gaji crew outlet, staf kantor, lembur, dan bonus',
    color: '#701604',
  },
  utilitas_sewa: {
    label: 'Tempat & Utilitas',
    desc: 'Sewa outlet, listrik (PLN), air (PDAM), dan internet/wifi',
    color: '#0a7d2c',
  },
  marketing: {
    label: 'Pemasaran & Promosi',
    desc: 'Biaya iklan (Ads), endorsement/KOL, dan promo outlet',
    color: '#2563eb',
  },
  operasional: {
    label: 'Operasional Toko & Pusat',
    desc: 'Operasional harian outlet, transport, joint expense, dan biaya kantor global',
    color: '#d97706',
  },
  non_opex: {
    label: 'Pengadaan Darurat (Non-OPEX)',
    desc: 'Belanja bahan baku pasar kas toko — dipisahkan agar tidak mendistorsi OPEX murni',
    color: '#ca8a04',
    isNonOpex: true,
  },
}

export function getCategoryCluster(category: string): OpexClusterKey {
  switch (category) {
    case 'gaji_crew_outlet':
    case 'gaji_staff_kantor':
    case 'lembur':
    case 'bonus_leader':
    case 'bonus_area_manager':
    case 'bonus_crew':
    case 'bonus_regional_manager':
    case 'salary':
      return 'tenaga_kerja'

    case 'sewa_outlet':
    case 'pln':
    case 'pdam':
    case 'internet':
    case 'utilitas':
      return 'utilitas_sewa'

    case 'ads':
    case 'endorsement':
    case 'promo':
      return 'marketing'

    case 'bahan_baku':
      return 'non_opex'

    case 'pengeluaran_outlet':
    case 'transport':
    case 'joint_expense':
    case 'pengeluaran_global':
    case 'lainnya':
    default:
      return 'operasional'
  }
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

export function buildOpexSummary(
  current: OpexRowLite[],
  previous: OpexRowLite[],
  outlets: OutletLite[],
  exemptions: OpexExemption[] = []
): OpexSummary {
  const outletById = new Map(outlets.map((o) => [o.id, o]))
  const units = new Map<string, OpexUnit & { prevCats: Set<string> }>()

  // Map exemptions: key = `${unitId}:${category}`
  const exMap = new Map<string, OpexExemption>()
  for (const ex of exemptions) {
    exMap.set(`${ex.unitId}:${ex.category}`, ex)
  }

  const ensure = (u: { id: string; name: string; group: OpexGroup }) => {
    let cur = units.get(u.id)
    if (!cur) {
      cur = {
        unitId: u.id,
        unitName: u.name,
        group: u.group,
        total: 0,
        totalPrev: 0,
        nonOpexTotal: 0,
        nonOpexTotalPrev: 0,
        grandTotal: 0,
        grandTotalPrev: 0,
        byCategory: {},
        byCategoryPrev: {},
        missing: [],
        exempted: [],
        added: [],
        clusters: [],
        prevCats: new Set(),
      }
      units.set(u.id, cur)
    }
    return cur
  }

  for (const r of current) {
    const u = unitOf(r, outletById)
    if (!u) continue
    const cur = ensure(u)
    const amt = Number(r.amount) || 0
    if (r.category === 'bahan_baku') {
      cur.nonOpexTotal += amt
    } else {
      cur.total += amt
    }
    cur.grandTotal += amt
    cur.byCategory[r.category] = (cur.byCategory[r.category] ?? 0) + amt
  }

  for (const r of previous) {
    const u = unitOf(r, outletById)
    if (!u) continue
    // Outlet yang sudah dinonaktifkan tidak diwajibkan mengisi bulan ini.
    if (u.id !== PUSAT_ID && outletById.get(u.id)?.is_active === false) continue
    const cur = ensure(u)
    const amt = Number(r.amount) || 0
    if (r.category === 'bahan_baku') {
      cur.nonOpexTotalPrev += amt
    } else {
      cur.totalPrev += amt
    }
    cur.grandTotalPrev += amt
    cur.byCategoryPrev[r.category] = (cur.byCategoryPrev[r.category] ?? 0) + amt
    cur.prevCats.add(r.category)
  }

  const list: OpexUnit[] = [...units.values()].map(({ prevCats, ...u }) => {
    const currCats = new Set(Object.keys(u.byCategory))
    const rawMissing = [...prevCats].filter((c) => !currCats.has(c)).sort()
    
    // Pisahkan missing biasa vs yang sudah ditandai nihil
    const missing: string[] = []
    const exempted: string[] = []
    for (const c of rawMissing) {
      if (exMap.has(`${u.unitId}:${c}`)) {
        exempted.push(c)
      } else {
        missing.push(c)
      }
    }

    const added = [...currCats].filter((c) => !prevCats.has(c)).sort()

    // Susun rincian per kluster beban
    const allCatKeys = Array.from(new Set([...Object.keys(u.byCategory), ...Object.keys(u.byCategoryPrev)]))
    const clusterOrder: OpexClusterKey[] = ['tenaga_kerja', 'utilitas_sewa', 'marketing', 'operasional', 'non_opex']

    const clusters: OpexClusterGroup[] = clusterOrder.map((cKey) => {
      const meta = CLUSTER_CONFIG[cKey]
      const catsInCluster = allCatKeys.filter((c) => getCategoryCluster(c) === cKey)
      
      const items: OpexCategoryItem[] = catsInCluster
        .map((c) => {
          const now = u.byCategory[c] ?? 0
          const prev = u.byCategoryPrev[c] ?? 0
          const diff = now - prev
          const diffPct = prev > 0 ? (diff / prev) * 100 : null
          const ex = exMap.get(`${u.unitId}:${c}`)

          let status: OpexCategoryItem['status'] = 'normal'
          if (ex) {
            status = 'nihil'
          } else if (missing.includes(c)) {
            status = 'missing'
          } else if (added.includes(c)) {
            status = 'added'
          }

          const catLabel = (CATEGORY_META as Record<string, { label: string }>)[c]?.label ?? c
          return {
            category: c,
            label: catLabel,
            current: now,
            previous: prev,
            diff,
            diffPct,
            status,
            exemption: ex,
          }
        })
        .sort((a, b) => b.current - a.current || b.previous - a.previous)

      const cTotal = items.reduce((s, it) => s + it.current, 0)
      const cTotalPrev = items.reduce((s, it) => s + it.previous, 0)
      const cDiff = cTotal - cTotalPrev
      const cDiffPct = cTotalPrev > 0 ? (cDiff / cTotalPrev) * 100 : null

      return {
        key: cKey,
        label: meta.label,
        desc: meta.desc,
        color: meta.color,
        isNonOpex: meta.isNonOpex,
        total: cTotal,
        totalPrev: cTotalPrev,
        diff: cDiff,
        diffPct: cDiffPct,
        categories: items,
      }
    }).filter((cg) => cg.categories.length > 0)

    return {
      ...u,
      missing,
      exempted,
      added,
      clusters,
    }
  })

  const totals = {
    global: { total: 0, totalPrev: 0, nonOpexTotal: 0, nonOpexTotalPrev: 0, grandTotal: 0, grandTotalPrev: 0, missingCount: 0, exemptedCount: 0, unitCount: 0 },
    internal: { total: 0, totalPrev: 0, nonOpexTotal: 0, nonOpexTotalPrev: 0, grandTotal: 0, grandTotalPrev: 0, missingCount: 0, exemptedCount: 0, unitCount: 0 },
    mitra: { total: 0, totalPrev: 0, nonOpexTotal: 0, nonOpexTotalPrev: 0, grandTotal: 0, grandTotalPrev: 0, missingCount: 0, exemptedCount: 0, unitCount: 0 },
  }

  const clusterTotals: Record<OpexClusterKey, {
    key: OpexClusterKey
    label: string
    isNonOpex?: boolean
    total: number
    totalPrev: number
    diff: number
    diffPct: number | null
  }> = {
    tenaga_kerja: { key: 'tenaga_kerja', label: CLUSTER_CONFIG.tenaga_kerja.label, total: 0, totalPrev: 0, diff: 0, diffPct: null },
    utilitas_sewa: { key: 'utilitas_sewa', label: CLUSTER_CONFIG.utilitas_sewa.label, total: 0, totalPrev: 0, diff: 0, diffPct: null },
    marketing: { key: 'marketing', label: CLUSTER_CONFIG.marketing.label, total: 0, totalPrev: 0, diff: 0, diffPct: null },
    operasional: { key: 'operasional', label: CLUSTER_CONFIG.operasional.label, total: 0, totalPrev: 0, diff: 0, diffPct: null },
    non_opex: { key: 'non_opex', label: CLUSTER_CONFIG.non_opex.label, isNonOpex: true, total: 0, totalPrev: 0, diff: 0, diffPct: null },
  }

  for (const u of list) {
    const t = totals[u.group]
    t.total += u.total
    t.totalPrev += u.totalPrev
    t.nonOpexTotal += u.nonOpexTotal
    t.nonOpexTotalPrev += u.nonOpexTotalPrev
    t.grandTotal += u.grandTotal
    t.grandTotalPrev += u.grandTotalPrev
    t.missingCount += u.missing.length
    t.exemptedCount += u.exempted.length
    t.unitCount += 1

    for (const cl of u.clusters) {
      clusterTotals[cl.key].total += cl.total
      clusterTotals[cl.key].totalPrev += cl.totalPrev
    }
  }

  for (const key of Object.keys(clusterTotals) as OpexClusterKey[]) {
    const ct = clusterTotals[key]
    ct.diff = ct.total - ct.totalPrev
    ct.diffPct = ct.totalPrev > 0 ? (ct.diff / ct.totalPrev) * 100 : null
  }

  list.sort((a, b) => b.missing.length - a.missing.length || b.total - a.total)
  return { units: list, totals, clusterTotals }
}

/** Bulan sebelumnya dari (year, month 1-12). */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}
