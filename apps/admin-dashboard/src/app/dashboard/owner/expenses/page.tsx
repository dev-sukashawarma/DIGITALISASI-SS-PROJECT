'use client'

import { useMemo, useState } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import { useExpenses } from '@/hooks/useExpenses'
import { useWaste } from '@/hooks/useWaste'
import { useRole } from '@/components/layout/RoleContext'
import { PageHeader, StatTile, Section, StatTilesSkeleton } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import CountUp from 'react-countup'
import { Wallet, TrendingDown } from 'lucide-react'
import { CATEGORY_META } from '@/lib/expenseCategories'
import dynamic from 'next/dynamic'

const ExpenseDistributionChart = dynamic(
  () => import('@/components/ExpenseDistributionChart').then((m) => m.ExpenseDistributionChart),
  { ssr: false, loading: () => <div className="h-56 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c
const colorOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.color ?? '#cccccc'

function firstOfMonth(ym: string) { return `${ym}-01` }
function lastOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export default function ExpensesPage() {
  const { data: outlets = [] } = useOutlets()
  const { role } = useRole()
  const isAdmin = role === 'ADMIN'

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [target, setTarget] = useState<string>('all')       // 'all' | 'PUSAT' | outletId
  
  const isPusat = target === 'PUSAT'
  const periodMonth = firstOfMonth(month)

  const filter = useMemo(() => ({
    from: periodMonth,
    to: lastOfMonth(month),
    outletId: isPusat ? 'all' : target,
    source: 'all' as const
  }), [periodMonth, month, target, isPusat])

  const { rows, loading, error } = useExpenses(filter)
  const { rows: wasteRows, loading: wasteLoading } = useWaste(filter)

  const filteredRows = useMemo(() => {
    if (target === 'all') {
      return rows.filter(r => r.scope === 'outlet')
    } else if (target === 'PUSAT') {
      return rows.filter(r => r.scope === 'pusat')
    } else {
      return rows.filter(r => r.scope === 'outlet' && r.outlet_id === target)
    }
  }, [rows, target])

  const totalAmount = useMemo(() => filteredRows.reduce((s, r) => s + r.amount, 0), [filteredRows])
  const amountBulanan = useMemo(() => filteredRows.filter(r => r.source === 'monthly').reduce((s, r) => s + r.amount, 0), [filteredRows])
  const amountPettyCash = useMemo(() => filteredRows.filter(r => r.source === 'petty_cash').reduce((s, r) => s + r.amount, 0), [filteredRows])
  const totalWaste = useMemo(() => wasteRows.reduce((s, r) => s + r.nilai_waste, 0), [wasteRows])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    filteredRows.forEach(r => map.set(r.category, (map.get(r.category) ?? 0) + r.amount))
    return [...map.entries()].map(([category, amount]) => ({
      name: labelOf(category),
      value: amount,
      color: colorOf(category),
      categoryKey: category
    })).sort((a, b) => b.value - a.value)
  }, [filteredRows])

  const selectOptions = [
    { label: '🏪 Semua Outlet', value: 'all' },
    ...(isAdmin ? [{ label: '🏢 Pengeluaran Pusat (company-wide)', value: 'PUSAT' }] : []),
    ...outlets.map(o => ({ label: o.name, value: o.id }))
  ]

  const titleText = target === 'PUSAT' ? 'Pengeluaran Pusat' : (target === 'all' ? 'Pengeluaran Outlet (Semua)' : 'Pengeluaran Outlet')

  return (
    <div className="space-y-6">
      <PageHeader title="Pengeluaran" description="Analisis pengeluaran operasional">
        <div className="flex flex-wrap gap-3 mt-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
          <TargetCombobox 
            options={selectOptions}
            value={target}
            onChange={setTarget}
            placeholder="— Pilih target —"
          />
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data pengeluaran: {error}
        </div>
      )}

      {loading || wasteLoading ? (
        <StatTilesSkeleton count={3} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatTile
              label="Total Pengeluaran"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalAmount} duration={1} separator="." /></>}
              sub={titleText + ` (Bulanan: Rp ${(amountBulanan/1000).toLocaleString('id-ID')}k | Kas Kecil: Rp ${(amountPettyCash/1000).toLocaleString('id-ID')}k)`}
              icon={Wallet}
              accent="brown"
            />
            {!isPusat && (
              <StatTile
                label="Kerugian Waste"
                value={<><span className="text-lg align-top">Rp </span><CountUp end={totalWaste} duration={1} separator="." /></>}
                sub="Read-only, dari approval waste (bukan input manual)"
                icon={TrendingDown}
                accent="red"
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title={`Distribusi ${titleText}`} className="lg:col-span-2">
              <ExpenseDistributionChart byCategory={byCategory} totalOutlet={totalAmount} />
            </Section>
          </div>
        </>
      )}
    </div>
  )
}
