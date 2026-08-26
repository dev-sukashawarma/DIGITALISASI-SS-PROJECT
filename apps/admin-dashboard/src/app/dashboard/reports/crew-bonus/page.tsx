'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/components/layout/RoleContext'
import { useOutlets } from '@/hooks/useOutlets'
import {
  useMonthlyBonusSummary,
  useMonthlyCrewBonus,
  useMonthlyAMBonus,
  useMonthlyRMBonus,
  CrewBonusRow,
  AMBonusRow,
  RMBonusRow,
} from '@/hooks/useCrewBonus'
import { PageHeader } from '@/components/ui'
import { Select } from '@/components/ui/Select'
import {
  Store,
  FileText,
  AlertCircle,
  Users,
  Briefcase,
  Crown,
  Sparkles,
  Search,
  CheckCircle2,
  DollarSign,
  PackageCheck,
} from 'lucide-react'

const MONTH_OPTIONS = [
  { label: 'Januari', value: '1' },
  { label: 'Februari', value: '2' },
  { label: 'Maret', value: '3' },
  { label: 'April', value: '4' },
  { label: 'Mei', value: '5' },
  { label: 'Juni', value: '6' },
  { label: 'Juli', value: '7' },
  { label: 'Agustus', value: '8' },
  { label: 'September', value: '9' },
  { label: 'Oktober', value: '10' },
  { label: 'November', value: '11' },
  { label: 'Desember', value: '12' },
]

const YEAR_OPTIONS = [
  { label: '2024', value: '2024' },
  { label: '2025', value: '2025' },
  { label: '2026', value: '2026' },
  { label: '2027', value: '2027' },
  { label: '2028', value: '2028' },
]

function cleanOutletName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('id-ID').format(num)
}

type ActiveTab = 'crew' | 'am' | 'rm'

export default function CrewBonusPage() {
  const { outletId: userOutletId, isReadOnly } = useRole()
  const { data: outlets = [], isLoading: loadingOutlets } = useOutlets()

  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [year, setYear] = useState<number>(() => new Date().getFullYear())
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('crew')
  const [searchQuery, setSearchQuery] = useState('')

  // Lock outlet filter to user's profile outletId if isReadOnly (MITRA)
  useEffect(() => {
    if (isReadOnly && userOutletId) {
      setSelectedOutletId(userOutletId)
      setActiveTab('crew')
    }
  }, [isReadOnly, userOutletId])

  // Queries
  const { data: summary, isLoading: loadingSummary } = useMonthlyBonusSummary({ month, year })
  const {
    data: crewBonuses = [],
    isLoading: loadingCrew,
    isError: isCrewError,
    error: crewError,
  } = useMonthlyCrewBonus({
    month,
    year,
    outletId: selectedOutletId || null,
  })
  const {
    data: amBonuses = [],
    isLoading: loadingAM,
    isError: isAMError,
    error: amError,
  } = useMonthlyAMBonus({ month, year })
  const {
    data: rmBonuses = [],
    isLoading: loadingRM,
    isError: isRMError,
    error: rmError,
  } = useMonthlyRMBonus({ month, year })

  const outletOptions = useMemo(() => {
    return [
      { label: 'Semua Outlet', value: '', icon: <Store className="w-4 h-4 text-orange-500" /> },
      ...outlets.map((o) => ({
        label: cleanOutletName(o.name),
        value: o.id,
        icon: <Store className="w-4 h-4 text-stone-400" />,
      })),
    ]
  }, [outlets])

  const selectedMonthLabel = MONTH_OPTIONS.find((m) => m.value === month.toString())?.label || ''

  // Filtered rows for Search
  const filteredCrew = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return crewBonuses
    return crewBonuses.filter(
      (c) =>
        c.crew_name.toLowerCase().includes(q) ||
        c.outlet_name.toLowerCase().includes(q)
    )
  }, [crewBonuses, searchQuery])

  const filteredAM = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return amBonuses
    return amBonuses.filter(
      (a) =>
        a.staff_name.toLowerCase().includes(q) ||
        a.managed_outlet_names.some((name) => name.toLowerCase().includes(q))
    )
  }, [amBonuses, searchQuery])

  const filteredRM = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rmBonuses
    return rmBonuses.filter((r) => r.staff_name.toLowerCase().includes(q))
  }, [rmBonuses, searchQuery])

  // Calculated totals for table footer reconciliation
  const crewTotalBonus = useMemo(
    () => filteredCrew.reduce((acc, c) => acc + c.total_bonus, 0),
    [filteredCrew]
  )

  const amTotalBonus = useMemo(
    () => filteredAM.reduce((acc, a) => acc + a.total_bonus, 0),
    [filteredAM]
  )

  const rmTotalBonus = useMemo(
    () => filteredRM.reduce((acc, r) => acc + r.total_bonus, 0),
    [filteredRM]
  )

  const isLoading =
    loadingOutlets ||
    loadingSummary ||
    (activeTab === 'crew' && loadingCrew) ||
    (activeTab === 'am' && loadingAM) ||
    (activeTab === 'rm' && loadingRM)

  const isError =
    (activeTab === 'crew' && isCrewError) ||
    (activeTab === 'am' && isAMError) ||
    (activeTab === 'rm' && isRMError)

  const activeError = crewError || amError || rmError

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-stone-800">
      {/* ── Page Header (Clean & Refined) ── */}
      <div className="relative z-30">
        <PageHeader
          title="Laporan Bonus & Insentif"
          description="Rekapitulasi pembagian insentif porsi menu terjual untuk Crew & Leader Outlet, Area Manager, dan Regional Manager."
        >
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto items-stretch sm:items-center">
            {/* Month Picker */}
            <Select
              options={MONTH_OPTIONS}
              value={month.toString()}
              onChange={(val) => setMonth(Number(val))}
              className="w-full sm:w-[140px]"
              placeholder="Bulan..."
            />

            {/* Year Picker */}
            <Select
              options={YEAR_OPTIONS}
              value={year.toString()}
              onChange={(val) => setYear(Number(val))}
              className="w-full sm:w-[110px]"
              placeholder="Tahun..."
            />
          </div>
        </PageHeader>
      </div>

      {/* ── Executive Metric Bento Grid (Crisp & Balanced) ── */}
      {!isReadOnly && summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Pengeluaran Bonus */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs hover:border-orange-200 transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Total Beban Bonus
                </span>
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 font-mono tabular-nums">
                {formatRupiah(summary.grand_total_bonus)}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 font-medium">
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium text-[11px]">
                <CheckCircle2 className="w-3 h-3" /> Berjalan Otomatis
              </span>
              <span>Periode {selectedMonthLabel} {year}</span>
            </div>
          </div>

          {/* Card 2: Total Pcs Terjual Global */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs hover:border-emerald-200 transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Total Pcs Terjual
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <PackageCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 font-mono tabular-nums">
                {formatNumber(summary.total_pcs_global)}{' '}
                <span className="text-sm font-normal text-stone-500">pcs</span>
              </div>
            </div>
            <p className="text-xs text-stone-500 mt-3 pt-3 border-t border-stone-100 font-normal">
              Seluruh transaksi menu berhasil di outlet operasional aktif
            </p>
          </div>

          {/* Card 3: Rincian Alokasi Peran */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Alokasi per Posisi
              </span>
              <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                {summary.active_crew_count + summary.active_am_count + summary.active_rm_count} Orang
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-stone-100">
                <span className="text-stone-600 flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-orange-500" /> Crew & Leader ({summary.active_crew_count} staf)
                </span>
                <span className="font-mono font-semibold text-stone-900 tabular-nums">
                  {formatRupiah(summary.total_crew_bonus)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-100">
                <span className="text-stone-600 flex items-center gap-1.5 font-medium">
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" /> Area Manager ({summary.active_am_count} staf)
                </span>
                <span className="font-mono font-semibold text-stone-900 tabular-nums">
                  {formatRupiah(summary.total_am_bonus)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-600 flex items-center gap-1.5 font-medium">
                  <Crown className="w-3.5 h-3.5 text-amber-500" /> Regional Manager ({summary.active_rm_count} staf)
                </span>
                <span className="font-mono font-semibold text-stone-900 tabular-nums">
                  {formatRupiah(summary.total_rm_bonus)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Switcher (Segmented Control) ── */}
      {!isReadOnly && (
        <div className="inline-flex p-1 bg-stone-100 rounded-xl border border-stone-200/70 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('crew')
              setSearchQuery('')
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              activeTab === 'crew'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${activeTab === 'crew' ? 'text-orange-600' : 'text-stone-400'}`} />
            <span>Crew & Leader Outlet</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md ${
                activeTab === 'crew' ? 'bg-orange-50 text-orange-700 font-medium' : 'bg-stone-200/70 text-stone-500'
              }`}
            >
              {crewBonuses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('am')
              setSearchQuery('')
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              activeTab === 'am'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Briefcase className={`w-3.5 h-3.5 ${activeTab === 'am' ? 'text-blue-600' : 'text-stone-400'}`} />
            <span>Area Manager (AM)</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md ${
                activeTab === 'am' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-stone-200/70 text-stone-500'
              }`}
            >
              {amBonuses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('rm')
              setSearchQuery('')
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              activeTab === 'rm'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Crown className={`w-3.5 h-3.5 ${activeTab === 'rm' ? 'text-amber-600' : 'text-stone-400'}`} />
            <span>Regional Manager (RM)</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md ${
                activeTab === 'rm' ? 'bg-amber-50 text-amber-700 font-medium' : 'bg-stone-200/70 text-stone-500'
              }`}
            >
              {rmBonuses.length}
            </span>
          </button>
        </div>
      )}

      {/* ── Filter Controls & Formula Context Bar ── */}
      <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
        {/* Formula Transparency Context */}
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 block">
              Rumus Perhitungan
            </span>
            <p className="text-xs font-medium text-stone-700">
              {activeTab === 'crew' && (
                <>
                  <span className="text-orange-700 font-semibold">Pool Cabang (Pcs × Rp 100)</span> ÷ Jumlah Staf Cabang (Crew + Leader)
                </>
              )}
              {activeTab === 'am' && (
                <>
                  <span className="text-blue-700 font-semibold">Total Pcs Cabang Binaan</span> × Rp 50 / pcs
                </>
              )}
              {activeTab === 'rm' && (
                <>
                  <span className="text-amber-700 font-semibold">Total Pcs Seluruh Cabang</span> × Rp 50 / pcs
                </>
              )}
            </p>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Outlet filter specifically for Crew tab */}
          {activeTab === 'crew' && (
            isReadOnly ? (
              <div className="flex items-center gap-2 pl-3 pr-4 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs font-medium text-stone-800">
                <Store className="w-4 h-4 text-stone-500 shrink-0" />
                <span className="truncate">
                  {cleanOutletName(outlets.find((o) => o.id === selectedOutletId)?.name ?? 'Outlet Saya')}
                </span>
              </div>
            ) : (
              <Select
                options={outletOptions}
                value={selectedOutletId}
                onChange={setSelectedOutletId}
                className="w-full sm:w-[210px]"
                placeholder="Pilih Outlet..."
                searchable
              />
            )
          )}

          {/* Live Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'crew'
                  ? 'Cari nama kru, leader, atau cabang...'
                  : activeTab === 'am'
                  ? 'Cari nama AM / binaan...'
                  : 'Cari nama RM...'
              }
              className="w-full pl-8.5 pr-3 py-1.5 rounded-xl text-xs text-stone-800 bg-stone-50/70 border border-stone-200 outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all placeholder:text-stone-400"
            />
          </div>
        </div>
      </div>

      {/* ── Data Tables & States ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-600 font-medium text-xs bg-white rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
          Memuat data laporan insentif & bonus...
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 bg-red-50/50 rounded-2xl border border-red-200 text-red-700">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-3 text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Gagal Memuat Data</h3>
          <p className="text-xs text-stone-500 text-center max-w-sm">
            Terjadi kendala saat mengambil data: {activeError?.message}
          </p>
        </div>
      ) : activeTab === 'crew' && filteredCrew.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-stone-200 shadow-xs border-dashed text-center">
          <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center mb-3 text-stone-400">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-800 mb-1">Tidak Ada Data Kru & Leader</h3>
          <p className="text-xs text-stone-500 max-w-sm">
            Tidak ditemukan kru atau leader aktif eligible atau transaksi penjualan pada periode {selectedMonthLabel} {year}.
          </p>
        </div>
      ) : activeTab === 'am' && filteredAM.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-stone-200 shadow-xs border-dashed text-center">
          <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center mb-3 text-stone-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-800 mb-1">Tidak Ada Data Area Manager</h3>
          <p className="text-xs text-stone-500 max-w-sm">
            Tidak ditemukan staf aktif dengan role Area Manager yang memiliki cabang binaan.
          </p>
        </div>
      ) : activeTab === 'rm' && filteredRM.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-stone-200 shadow-xs border-dashed text-center">
          <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center mb-3 text-stone-400">
            <Crown className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-800 mb-1">Tidak Ada Data Regional Manager</h3>
          <p className="text-xs text-stone-500 max-w-sm">
            Tidak ditemukan staf aktif dengan role Regional Manager di sistem.
          </p>
        </div>
      ) : (
        /* ── TABLE VIEW (Refined Density & Readable Weights) ── */
        <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            {/* ── TAB 1: CREW & LEADER TABLE ── */}
            {activeTab === 'crew' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Nama Staf</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Outlet & Pool Cabang</th>
                    <th className="px-5 py-3.5 text-right">Bonus Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {filteredCrew.map((row) => (
                    <tr key={row.crew_id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-[10px] shrink-0 ${
                              row.role === 'leader'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {row.crew_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-stone-900">{row.crew_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border ${
                            row.role === 'leader'
                              ? 'bg-amber-50 text-amber-800 border-amber-200/70 font-semibold'
                              : 'bg-stone-100 text-stone-600 border-stone-200/60'
                          }`}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{cleanOutletName(row.outlet_name)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono">
                            <span className="text-stone-600 font-medium">
                              {formatNumber(row.total_pcs_outlet)} pcs
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="text-orange-700 font-medium bg-orange-50 px-1.5 py-0.2 rounded border border-orange-100">
                              Pool {formatRupiah(row.total_pcs_outlet * row.bonus_rate)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums font-semibold text-emerald-700 text-sm">
                        {formatRupiah(row.total_bonus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer Reconciliation */}
                <tfoot className="bg-stone-50/90 border-t-2 border-stone-200 text-stone-700 font-medium">
                  <tr>
                    <td colSpan={2} className="px-5 py-3 text-xs">
                      Total ({filteredCrew.length} staf kru & leader)
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-stone-500">
                      Total Bonus Kru & Leader:
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-bold text-sm text-emerald-800">
                      {formatRupiah(crewTotalBonus)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ── TAB 2: AREA MANAGER TABLE ── */}
            {activeTab === 'am' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Nama Area Manager</th>
                    <th className="px-5 py-3.5">Cabang Binaan</th>
                    <th className="px-5 py-3.5 text-right">Total Pcs Binaan</th>
                    <th className="px-5 py-3.5 text-right">Tarif Bonus</th>
                    <th className="px-5 py-3.5 text-right">Total Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {filteredAM.map((row) => (
                    <tr key={row.staff_id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px] shrink-0">
                            {row.staff_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-stone-900">{row.staff_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {row.managed_outlet_names.length > 0 ? (
                            row.managed_outlet_names.map((name, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/50"
                              >
                                {cleanOutletName(name)}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-400 italic text-[11px]">Belum ada cabang binaan</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-stone-700">
                        {formatNumber(row.total_pcs)}{' '}
                        <span className="text-[10px] text-stone-400">pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-stone-500">
                        {formatRupiah(row.bonus_rate)}{' '}
                        <span className="text-[10px] text-stone-400">/ pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatRupiah(row.total_bonus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer Reconciliation */}
                <tfoot className="bg-stone-50/90 border-t-2 border-stone-200 text-stone-700 font-medium">
                  <tr>
                    <td colSpan={2} className="px-5 py-3 text-xs">
                      Total ({filteredAM.length} Area Manager)
                    </td>
                    <td colSpan={2} className="px-5 py-3 text-right text-xs text-stone-500">
                      Total Bonus AM:
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-bold text-sm text-emerald-800">
                      {formatRupiah(amTotalBonus)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ── TAB 3: REGIONAL MANAGER TABLE ── */}
            {activeTab === 'rm' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Nama Regional Manager</th>
                    <th className="px-5 py-3.5">Cakupan Wilayah</th>
                    <th className="px-5 py-3.5 text-right">Total Pcs Global</th>
                    <th className="px-5 py-3.5 text-right">Tarif Bonus</th>
                    <th className="px-5 py-3.5 text-right">Total Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {filteredRM.map((row) => (
                    <tr key={row.staff_id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold text-[10px] shrink-0">
                            {row.staff_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-stone-900">{row.staff_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
                          <Crown className="w-3 h-3 text-amber-600" />
                          {row.scope_description}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-stone-700">
                        {formatNumber(row.total_pcs_global)}{' '}
                        <span className="text-[10px] text-stone-400">pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-stone-500">
                        {formatRupiah(row.bonus_rate)}{' '}
                        <span className="text-[10px] text-stone-400">/ pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatRupiah(row.total_bonus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer Reconciliation */}
                <tfoot className="bg-stone-50/90 border-t-2 border-stone-200 text-stone-700 font-medium">
                  <tr>
                    <td colSpan={2} className="px-5 py-3 text-xs">
                      Total ({filteredRM.length} Regional Manager)
                    </td>
                    <td colSpan={2} className="px-5 py-3 text-right text-xs text-stone-500">
                      Total Bonus RM:
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-bold text-sm text-emerald-800">
                      {formatRupiah(rmTotalBonus)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
