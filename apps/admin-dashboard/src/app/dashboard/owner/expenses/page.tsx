'use client'

import { useMemo } from 'react'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useExpenses } from '@/hooks/useExpenses'
import { PeriodFilter } from '@/components/PeriodFilter'
import { rupiah, pct } from '@/lib/format'
import { PageHeader, StatTile, Section, StatTilesSkeleton } from '@/components/ui'
import CountUp from 'react-countup'
import { Wallet, Building2, Receipt } from 'lucide-react'
import { CATEGORY_META, OUTLET_CATEGORIES } from '@/lib/expenseCategories'
import dynamic from 'next/dynamic'

const ExpenseDistributionChart = dynamic(
  () => import('@/components/ExpenseDistributionChart').then((m) => m.ExpenseDistributionChart),
  { ssr: false, loading: () => <div className="h-56 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)
const ExpenseTrendChart = dynamic(
  () => import('@/components/ExpenseTrendChart').then((m) => m.ExpenseTrendChart),
  { ssr: false, loading: () => <div className="h-72 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c
const colorOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.color ?? '#cccccc'
const iconOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.icon ?? Wallet

export default function ExpensesPage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  const { rows, loading, error } = useExpenses(filter)

  const isAllOutlets = filter.outletId === 'all'

  // Pisah scope: distribusi/tren/kategori = biaya OUTLET; pusat ditampilkan terpisah.
  const outletRows = useMemo(() => rows.filter(r => r.scope === 'outlet'), [rows])
  const pusatRows = useMemo(() => rows.filter(r => r.scope === 'pusat'), [rows])
  const totalOutlet = useMemo(() => outletRows.reduce((s, r) => s + r.amount, 0), [outletRows])
  const totalPusat = useMemo(() => pusatRows.reduce((s, r) => s + r.amount, 0), [pusatRows])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    outletRows.forEach(r => map.set(r.category, (map.get(r.category) ?? 0) + r.amount))
    return [...map.entries()].map(([category, amount]) => ({
      name: labelOf(category),
      value: amount,
      color: colorOf(category),
      categoryKey: category
    })).sort((a, b) => b.value - a.value)
  }, [outletRows])

  // Top-3 kategori outlet untuk kartu KPI.
  const topCategories = useMemo(() => byCategory.slice(0, 3), [byCategory])

  // Group by date untuk Bar Chart (seed 12 kategori outlet = 0).
  const byDate = useMemo(() => {
    const seed = () => Object.fromEntries(OUTLET_CATEGORIES.map(c => [c, 0])) as Record<string, number>
    const map = new Map<string, Record<string, number>>()
    outletRows.forEach(r => {
      const dateStr = r.expense_date
      const current = map.get(dateStr) ?? seed()
      current[r.category] = (current[r.category] ?? 0) + r.amount
      map.set(dateStr, current)
    })

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, categories]) => ({
        date,
        ...categories
      }))
  }, [outletRows])

  return (
    <div className="space-y-6">
      <PageHeader title="Pengeluaran" description="Analisis pengeluaran operasional outlet">
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} />
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data pengeluaran: {error}
        </div>
      )}

      {loading ? (
        <StatTilesSkeleton count={3} />
      ) : (
        <>
          {/* 3 angka headline: Total Pengeluaran + (Biaya Pusat) + Kategori Teratas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Total Pengeluaran"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalOutlet} duration={1} separator="." /></>}
              sub="Biaya Operasional Outlet"
              icon={Wallet}
              accent="brown"
            />
            {isAllOutlets && (
              <StatTile
                label="Biaya Pusat"
                value={<><span className="text-lg align-top">Rp </span><CountUp end={totalPusat} duration={1} separator="." /></>}
                sub="Company-wide (tak dibebankan ke outlet)"
                icon={Building2}
                accent="red"
              />
            )}
            {topCategories.slice(0, isAllOutlets ? 1 : 2).map((cat) => (
              <StatTile
                key={cat.categoryKey}
                label={cat.name}
                value={<><span className="text-lg align-top">Rp </span><CountUp end={cat.value} duration={1} separator="." /></>}
                sub={`${totalOutlet > 0 ? pct(cat.value, totalOutlet) : 0}% dari biaya outlet`}
                icon={iconOf(cat.categoryKey)}
                accent="orange"
              />
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Section title="Distribusi Pengeluaran Outlet" className="lg:col-span-2">
              <ExpenseDistributionChart byCategory={byCategory} totalOutlet={totalOutlet} />
            </Section>
            <Section title="Tren Biaya Operasional" className="lg:col-span-3">
              <ExpenseTrendChart byDate={byDate} />
            </Section>
          </div>

          {/* Raw Transaction Table */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-suka-gray-100 flex justify-between items-center">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Rincian Transaksi Pengeluaran</h3>
              <span className="text-xs font-bold text-suka-orange bg-suka-cream px-3 py-1 rounded-full border border-suka-brown/5">
                {rows.length} Transaksi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                    <th className="py-3 px-6 w-12 text-center">#</th>
                    <th className="py-3 px-6">Outlet</th>
                    <th className="py-3 px-6">Kategori</th>
                    <th className="py-3 px-6">Tanggal</th>
                    <th className="py-3 px-6">Catatan / Deskripsi</th>
                    <th className="py-3 px-6 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 font-medium">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-suka-gray-400">Belum ada data pengeluaran pada periode ini</td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const color = colorOf(row.category)
                      const label = labelOf(row.category)
                      const outletLabel = row.outlet_name ? row.outlet_name.replace('SUKA SHAWARMA ', '') : 'PUSAT'

                      return (
                        <tr key={row.id} className="hover:bg-suka-cream/20 transition-colors">
                          <td className="py-3.5 px-6 text-center text-suka-gray-400 font-bold">{index + 1}</td>
                          <td className="py-3.5 px-6 text-suka-ink font-bold">{outletLabel}</td>
                          <td className="py-3.5 px-6">
                            <span
                              className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
                              style={{ color: color, backgroundColor: `${color}10`, border: `1px solid ${color}20` }}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-suka-gray-500 font-bold">
                            {new Date(row.expense_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3.5 px-6 text-suka-gray-600 text-xs italic">
                            {row.description}
                            {row.receipt_url && (
                              <a href={row.receipt_url} target="_blank" rel="noreferrer" className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                <Receipt className="w-3 h-3" />
                                Lihat Struk
                              </a>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right text-suka-brown font-extrabold">{rupiah(row.amount)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
