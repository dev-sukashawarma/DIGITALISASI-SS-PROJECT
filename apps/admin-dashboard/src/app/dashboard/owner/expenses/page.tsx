// apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useOutlets } from '@/hooks/useOutlets'
import { useExpenses } from '@/hooks/useExpenses'
import { useHRPayroll } from '@/hooks/useHRPayroll'
import { useWaste } from '@/hooks/useWaste'
import { useRole } from '@/components/layout/RoleContext'
import { PageHeader, Section, StatTilesSkeleton } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import CountUp from 'react-countup'
import {
  Wallet,
  TrendingDown,
  Building2,
  Coins,
  Users,
  Award,
  Calendar,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
} from 'lucide-react'
import { CATEGORY_META } from '@/lib/expenseCategories'
import { isExcludedOutlet } from '@/lib/outletFilters'
import { withWasteSlice } from '@/lib/expenseBreakdown'
import { pct } from '@/lib/format'
import dynamic from 'next/dynamic'

const ExpenseDistributionChart = dynamic(
  () => import('@/components/ExpenseDistributionChart').then((m) => m.ExpenseDistributionChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 animate-pulse" />
    ),
  }
)

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c
const colorOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.color ?? '#cccccc'

function firstOfMonth(ym: string) {
  return `${ym}-01`
}
function lastOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

function StatKpiCard({
  label,
  value,
  sub,
  footer,
  icon: Icon,
  accent = 'brown',
  tooltip,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  footer?: string
  icon: React.ElementType
  accent?: 'brown' | 'blue' | 'orange' | 'red'
  tooltip?: string
}) {
  const accentStyles = {
    brown: 'bg-suka-cream text-suka-brown',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
  }[accent]

  return (
    <div className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">{label}</span>
            {tooltip && (
              <div className="group relative flex items-center">
                <HelpCircle className="w-3.5 h-3.5 text-suka-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-suka-ink text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed">
                  {tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-suka-ink" />
                </div>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-2xl ${accentStyles}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-suka-brown font-extrabold text-2xl sm:text-3xl tracking-tight tabular-nums">
            {value}
          </div>
          {sub && <p className="text-xs font-bold text-suka-gray-500 mt-2">{sub}</p>}
        </div>
      </div>

      {footer && (
        <div className="mt-4 pt-3 border-t border-suka-gray-100 flex items-center justify-between text-[11px] text-suka-gray-400 font-medium">
          <span className="truncate">{footer}</span>
        </div>
      )}
    </div>
  )
}

export default function ExpensesPage() {
  const { data: outlets = [] } = useOutlets()
  const { role } = useRole()
  const isAdmin = role === 'ADMIN' || role === 'OWNER'

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [target, setTarget] = useState<string>('all') // 'all' | 'ALL_OUTLETS' | 'PUSAT' | outletId

  const isPusat = target === 'PUSAT'
  const isAllOutlets = target === 'ALL_OUTLETS'
  const periodMonth = firstOfMonth(month)

  const filter = useMemo(
    () => ({
      from: periodMonth,
      to: lastOfMonth(month),
      outletId: isPusat || isAllOutlets ? 'all' : target,
      source: 'all' as const,
    }),
    [periodMonth, month, target, isPusat, isAllOutlets]
  )

  const { rows, loading, error } = useExpenses(filter)
  const { rows: wasteRows, loading: wasteLoading } = useWaste(filter)

  const hrPayrollFilter = useMemo(
    () => ({
      from: periodMonth,
      to: lastOfMonth(month),
      outletId: target,
    }),
    [periodMonth, month, target]
  )
  const { data: hrPayroll } = useHRPayroll(hrPayrollFilter)

  const filteredRows = useMemo(() => {
    if (target === 'all') {
      return rows
    } else if (target === 'ALL_OUTLETS') {
      return rows.filter((r) => r.scope === 'outlet')
    } else if (target === 'PUSAT') {
      return rows.filter((r) => r.scope === 'pusat')
    } else {
      return rows.filter((r) => r.scope === 'outlet' && r.outlet_id === target)
    }
  }, [rows, target])

  const totalAmount = useMemo(() => filteredRows.reduce((s, r) => s + r.amount, 0), [filteredRows])
  const amountBulanan = useMemo(
    () => filteredRows.filter((r) => r.source === 'monthly').reduce((s, r) => s + r.amount, 0),
    [filteredRows]
  )
  const amountPettyCash = useMemo(
    () => filteredRows.filter((r) => r.source === 'petty_cash').reduce((s, r) => s + r.amount, 0),
    [filteredRows]
  )
  const totalWaste = useMemo(() => wasteRows.reduce((s, r) => s + r.nilai_waste, 0), [wasteRows])
  const totalTransaksi = filteredRows.length

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    filteredRows.forEach((r) => map.set(r.category, (map.get(r.category) ?? 0) + r.amount))
    return [...map.entries()]
      .map(([category, amount]) => ({
        name: labelOf(category),
        value: amount,
        color: colorOf(category),
        categoryKey: category,
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredRows])

  // Waste ikut sebagai satu kategori DI TAMPILAN saja
  const includeWaste = !isPusat && totalWaste > 0
  const byCategoryAll = useMemo(
    () => withWasteSlice(byCategory, totalWaste, includeWaste),
    [byCategory, totalWaste, includeWaste]
  )
  const totalBeban = totalAmount + (includeWaste ? totalWaste : 0)

  const topCategory = byCategoryAll.length > 0 ? byCategoryAll[0].name : '-'

  const validOutlets = useMemo(() => outlets.filter((o) => !isExcludedOutlet(o)), [outlets])

  const selectOptions = useMemo(
    () => [
      { label: '🏢 Semua Unit (Pusat & Outlet)', value: 'all' },
      { label: '🏪 Semua Outlet (Khusus Cabang)', value: 'ALL_OUTLETS' },
      ...(isAdmin ? [{ label: '🏢 Kantor Pusat (OPEX Pusat)', value: 'PUSAT' }] : []),
      ...validOutlets.map((o) => ({ label: o.name, value: o.id })),
    ],
    [isAdmin, validOutlets]
  )

  const titleText =
    target === 'PUSAT'
      ? 'Pengeluaran Pusat'
      : target === 'ALL_OUTLETS'
      ? 'Pengeluaran Outlet (Khusus Cabang)'
      : target === 'all'
      ? 'Semua Unit (Pusat & Outlet)'
      : outlets.find((o) => o.id === target)?.name || 'Pengeluaran Outlet'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Halaman & Toolbar Kontrol */}
      <PageHeader
        title="Analisis Pengeluaran"
        description="Sebaran beban operasional per kategori, termasuk estimasi payroll & kerugian waste. Untuk rincian pencatatan per nota, buka Buku Kas (OPEX)."
        icon={Wallet}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Custom Month Picker */}
          <div className="relative flex items-center bg-white border border-suka-gray-200 rounded-2xl px-3 py-1.5 shadow-2xs hover:border-suka-orange transition-colors">
            <Calendar className="w-4 h-4 text-suka-gray-400 mr-2 shrink-0" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-xs font-bold text-suka-brown outline-none bg-transparent cursor-pointer"
            />
          </div>

          {/* Target Combobox */}
          <div className="w-64">
            <TargetCombobox
              options={selectOptions}
              value={target}
              onChange={setTarget}
              placeholder="— Pilih target unit —"
            />
          </div>

          {/* CTA Buku Kas */}
          <Link
            href="/dashboard/reports/input-pengeluaran"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-suka-orange hover:bg-amber-600 text-white font-bold rounded-2xl text-xs transition-all shadow-xs cursor-pointer active:scale-95 ml-auto"
            title="Buka rincian per nota di Buku Kas"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Buka Buku Kas (OPEX)</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
          </Link>
        </div>
      </PageHeader>

      {/* Pesan Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>Gagal memuat data pengeluaran: {error}</span>
        </div>
      )}

      {loading || wasteLoading ? (
        <div className="space-y-6">
          <StatTilesSkeleton count={4} />
          <div className="h-96 bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 animate-pulse" />
        </div>
      ) : (
        <>
          {/* ── BARIS 1: 4 KARTU KPI EKSEKUTIF (TOP ROW) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Beban */}
            <StatKpiCard
              label="Total Beban Operasional"
              value={
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-suka-gray-400">Rp</span>
                  <CountUp end={totalBeban} duration={1} separator="." />
                </div>
              }
              sub={`${totalTransaksi.toLocaleString('id-ID')} transaksi tercatat`}
              footer={titleText}
              icon={Wallet}
              accent="brown"
              tooltip="Akumulasi beban operasional periode ini: Biaya Bulanan + Kas Kecil (Petty Cash) + Kerugian Waste."
            />

            {/* 2. Biaya Bulanan */}
            <StatKpiCard
              label="Biaya Bulanan (Fixed)"
              value={
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-suka-gray-400">Rp</span>
                  <CountUp end={amountBulanan} duration={1} separator="." />
                </div>
              }
              sub={`${pct(amountBulanan, totalBeban)}% dari total beban`}
              footer="Sewa, utilitas, langganan terpusat"
              icon={Building2}
              accent="blue"
              tooltip="Beban operasional tetap atau terjadwal bulanan yang dibayarkan kantor pusat."
            />

            {/* 3. Kas Kecil */}
            <StatKpiCard
              label="Kas Kecil (Petty Cash)"
              value={
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-suka-gray-400">Rp</span>
                  <CountUp end={amountPettyCash} duration={1} separator="." />
                </div>
              }
              sub={`${pct(amountPettyCash, totalBeban)}% dari total beban`}
              footer="Operasional harian & kasbon cabang"
              icon={Coins}
              accent="orange"
              tooltip="Pengeluaran belanja operasional kas kecil langsung di cabang/outlet."
            />

            {/* 4. Waste / Kategori Terbesar */}
            {!isPusat ? (
              <StatKpiCard
                label="Kerugian Waste"
                value={
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-rose-500">Rp</span>
                    <CountUp end={totalWaste} duration={1} separator="." />
                  </div>
                }
                sub={`${pct(totalWaste, totalBeban)}% dari total beban`}
                footer="Otomatis dari approval waste bahan"
                icon={TrendingDown}
                accent="red"
                tooltip="Beban nilai bahan baku yang rusak/terbuang dan disetujui. Otomatis masuk ke Total Beban."
              />
            ) : (
              <StatKpiCard
                label="Kategori Beban Terbesar"
                value={<span className="text-xl sm:text-2xl truncate block">{topCategory}</span>}
                sub={
                  byCategoryAll.length > 0
                    ? `Rp ${((byCategoryAll[0].value || 0) / 1000).toLocaleString('id-ID')}k`
                    : 'Belum ada data'
                }
                footer={`${byCategoryAll.length > 0 ? pct(byCategoryAll[0].value, totalBeban) : 0}% porsi beban`}
                icon={Award}
                accent="orange"
                tooltip="Kategori pengeluaran dengan nominal terbesar pada unit pusat."
              />
            )}
          </div>

          {/* ── BARIS 2: BANNER STATUS PAYROLL & HR (Transparansi Finansial) ── */}
          <div className="bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-suka-brown text-sm tracking-tight">
                    Estimasi Beban Gaji &amp; Payroll HR
                  </h4>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      hrPayroll?.status === 'finalized'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                        : 'bg-amber-50 text-amber-800 border border-amber-200/70'
                    }`}
                  >
                    {hrPayroll?.status === 'finalized'
                      ? `Sudah Difinalisasi (${hrPayroll.totalStaff} staf)`
                      : `Draft HR (${hrPayroll?.draftCount ?? 0} staf) · Belum Dibukukan`}
                  </span>
                </div>
                <p className="text-xs text-suka-gray-500 font-medium mt-1 leading-relaxed">
                  {hrPayroll?.status === 'finalized'
                    ? `Total gaji staf ${hrPayroll?.totalStaff ?? 0} orang telah difinalisasi dan dapat diverifikasi di modul HR.`
                    : 'Angka ini adalah estimasi dari modul HR dan belum dijurnal ke dalam Total Beban OPEX di atas hingga statusnya final.'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] font-bold text-suka-gray-400 uppercase tracking-wider block">
                Total Estimasi Gaji
              </span>
              <div className="flex items-baseline gap-1 text-suka-brown font-extrabold text-xl sm:text-2xl tabular-nums mt-0.5">
                <span className="text-sm font-bold text-suka-gray-400">Rp</span>
                <CountUp end={hrPayroll?.totalSalary || 0} duration={1} separator="." />
              </div>
            </div>
          </div>

          {/* ── BARIS 3: ANALISIS DISTRIBUSI PENGELUARAN (FULL WIDTH 2-COL BALANCE) ── */}
          <Section title={`Distribusi ${titleText}`} className="space-y-4">
            <ExpenseDistributionChart
              byCategory={byCategoryAll}
              totalOutlet={totalBeban}
              amountBulanan={amountBulanan}
              amountPettyCash={amountPettyCash}
              totalWaste={totalWaste}
              includeWaste={includeWaste}
            />
          </Section>
        </>
      )}
    </div>
  )
}
