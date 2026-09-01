'use client'

import { useState, useMemo } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import {
  useMonthlyBonusSummary,
  useMonthlyCrewBonus,
  useMonthlyAMBonus,
  useMonthlyRMBonus,
} from '@/hooks/useCrewBonus'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { formatRupiah } from '@/lib/format'
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

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('id-ID').format(num)
}

type ActiveTab = 'crew' | 'am' | 'rm'

export default function CrewBonusPage() {
  const { data: outlets = [], isLoading: loadingOutlets } = useOutlets()

  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [year, setYear] = useState<number>(() => new Date().getFullYear())
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('crew')
  const [searchQuery, setSearchQuery] = useState('')

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
      { label: 'Semua Outlet', value: '', icon: <Store className="w-4 h-4 text-suka-orange" /> },
      ...outlets.map((o) => ({
        label: cleanOutletName(o.name),
        value: o.id,
        icon: <Store className="w-4 h-4 text-suka-gray-400" />,
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
    <div className="space-y-6 max-w-7xl mx-auto text-suka-ink">
      {/* ── Page Header ── */}
      <PageHeader
        title="Laporan Bonus &amp; Insentif Penjualan"
        description="Rekapitulasi pembagian insentif porsi menu terjual untuk Crew &amp; Leader Outlet, Area Manager (AM), dan Regional Manager (RM)."
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

      {/* ── Metric Bento Grid ── */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Pengeluaran Bonus */}
          <div className="bg-white rounded-2xl p-5 border border-suka-gray-200 shadow-xs hover:border-suka-orange/50 transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-suka-gray-500">
                  Total Beban Bonus
                </span>
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-suka-orange flex items-center justify-center border border-orange-100 font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-suka-brown font-mono tabular-nums">
                {formatRupiah(summary.grand_total_bonus)}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-suka-gray-100 text-xs text-suka-gray-500 font-medium">
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                <CheckCircle2 className="w-3 h-3" /> Terkoneksi POS
              </span>
              <span>Periode {selectedMonthLabel} {year}</span>
            </div>
          </div>

          {/* Card 2: Total Pcs Terjual Global */}
          <div className="bg-white rounded-2xl p-5 border border-suka-gray-200 shadow-xs hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-suka-gray-500">
                  Total Pcs Terjual
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 font-bold">
                  <PackageCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-900 font-mono tabular-nums">
                {formatNumber(summary.total_pcs_global)}{' '}
                <span className="text-sm font-normal text-suka-gray-500">pcs</span>
              </div>
            </div>
            <p className="text-xs text-suka-gray-500 mt-3 pt-3 border-t border-suka-gray-100 font-normal">
              Seluruh transaksi menu berhasil di outlet operasional aktif
            </p>
          </div>

          {/* Card 3: Rincian Alokasi Peran */}
          <div className="bg-white rounded-2xl p-5 border border-suka-gray-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-suka-gray-500">
                Alokasi per Posisi
              </span>
              <span className="text-[11px] font-bold text-suka-ink bg-suka-gray-100 px-2 py-0.5 rounded-md">
                {summary.active_crew_count + summary.active_am_count + summary.active_rm_count} Orang
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-suka-gray-100">
                <span className="text-suka-ink flex items-center gap-1.5 font-bold">
                  <Users className="w-3.5 h-3.5 text-suka-orange" /> Crew &amp; Leader ({summary.active_crew_count} staf)
                </span>
                <span className="font-mono font-bold text-suka-brown tabular-nums">
                  {formatRupiah(summary.total_crew_bonus)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-suka-gray-100">
                <span className="text-suka-ink flex items-center gap-1.5 font-bold">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" /> Area Manager ({summary.active_am_count} staf)
                </span>
                <span className="font-mono font-bold text-suka-brown tabular-nums">
                  {formatRupiah(summary.total_am_bonus)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-suka-ink flex items-center gap-1.5 font-bold">
                  <Crown className="w-3.5 h-3.5 text-amber-600" /> Regional Manager ({summary.active_rm_count} staf)
                </span>
                <span className="font-mono font-bold text-suka-brown tabular-nums">
                  {formatRupiah(summary.total_rm_bonus)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Switcher ── */}
      <div className="inline-flex p-1 bg-suka-gray-100 rounded-2xl border border-suka-gray-200 gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('crew')
            setSearchQuery('')
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
            activeTab === 'crew'
              ? 'bg-white text-suka-brown shadow-xs'
              : 'text-suka-gray-500 hover:text-suka-ink hover:bg-white/50'
          }`}
        >
          <Users className={`w-3.5 h-3.5 ${activeTab === 'crew' ? 'text-suka-orange' : 'text-suka-gray-400'}`} />
          <span>Crew &amp; Leader Outlet</span>
          <span
            className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md ${
              activeTab === 'crew' ? 'bg-orange-50 text-suka-orange font-bold' : 'bg-suka-gray-200 text-suka-gray-500'
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
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
            activeTab === 'am'
              ? 'bg-white text-suka-brown shadow-xs'
              : 'text-suka-gray-500 hover:text-suka-ink hover:bg-white/50'
          }`}
        >
          <Briefcase className={`w-3.5 h-3.5 ${activeTab === 'am' ? 'text-blue-600' : 'text-suka-gray-400'}`} />
          <span>Area Manager (AM)</span>
          <span
            className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md ${
              activeTab === 'am' ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-suka-gray-200 text-suka-gray-500'
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
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
            activeTab === 'rm'
              ? 'bg-white text-suka-brown shadow-xs'
              : 'text-suka-gray-500 hover:text-suka-ink hover:bg-white/50'
          }`}
        >
          <Crown className={`w-3.5 h-3.5 ${activeTab === 'rm' ? 'text-amber-600' : 'text-suka-gray-400'}`} />
          <span>Regional Manager (RM)</span>
          <span
            className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md ${
              activeTab === 'rm' ? 'bg-amber-50 text-amber-700 font-bold' : 'bg-suka-gray-200 text-suka-gray-500'
            }`}
          >
            {rmBonuses.length}
          </span>
        </button>
      </div>

      {/* ── Filter Controls & Formula Context Bar ── */}
      <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-suka-gray-200 shadow-xs">
        {/* Formula Transparency */}
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-suka-orange flex items-center justify-center shrink-0 border border-orange-100 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-400 block">
              Rumus Perhitungan
            </span>
            <p className="text-xs font-medium text-suka-ink">
              {activeTab === 'crew' && (
                <>
                  <span className="text-suka-orange font-bold">Pool Cabang (Pcs × Rp 100)</span> ÷ Jumlah Staf Cabang (Crew + Leader)
                </>
              )}
              {activeTab === 'am' && (
                <>
                  <span className="text-blue-700 font-bold">Total Pcs Cabang Binaan</span> × Rp 50 / pcs
                </>
              )}
              {activeTab === 'rm' && (
                <>
                  <span className="text-amber-700 font-bold">Total Pcs Seluruh Cabang</span> × Rp 50 / pcs
                </>
              )}
            </p>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {activeTab === 'crew' && (
            <Select
              options={outletOptions}
              value={selectedOutletId}
              onChange={setSelectedOutletId}
              className="w-full sm:w-[210px]"
              placeholder="Pilih Outlet..."
              searchable
            />
          )}

          {/* Live Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'crew'
                  ? 'Cari kru, leader, cabang...'
                  : activeTab === 'am'
                  ? 'Cari nama AM / binaan...'
                  : 'Cari nama RM...'
              }
              className="w-full pl-8.5 pr-3 py-2 rounded-xl text-xs font-semibold text-suka-ink bg-suka-gray-50 border border-suka-gray-200 outline-none focus:bg-white focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all placeholder:text-suka-gray-400"
            />
          </div>
        </div>
      </div>

      {/* ── Data Tables & States ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-suka-gray-500 font-bold text-xs bg-white rounded-2xl border border-suka-gray-200 shadow-xs">
          <div className="w-8 h-8 border-3 border-suka-orange border-t-transparent rounded-full animate-spin mb-3" />
          Memuat data laporan insentif &amp; bonus...
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 bg-red-50 rounded-2xl border border-red-200 text-red-700">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-3 text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold mb-1">Gagal Memuat Data</h3>
          <p className="text-xs text-suka-gray-500 text-center max-w-sm">
            Terjadi kendala saat mengambil data: {activeError?.message}
          </p>
        </div>
      ) : activeTab === 'crew' && filteredCrew.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-suka-gray-200 shadow-xs border-dashed text-center">
          <div className="w-12 h-12 bg-suka-gray-100 rounded-xl flex items-center justify-center mb-3 text-suka-gray-400">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-suka-brown mb-1">Tidak Ada Data Kru &amp; Leader</h3>
          <p className="text-xs text-suka-gray-500 max-w-sm">
            Tidak ditemukan kru atau leader aktif eligible atau transaksi penjualan pada periode {selectedMonthLabel} {year}.
          </p>
        </div>
      ) : activeTab === 'am' && filteredAM.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-suka-gray-200 shadow-xs border-dashed text-center">
          <div className="w-12 h-12 bg-suka-gray-100 rounded-xl flex items-center justify-center mb-3 text-suka-gray-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-suka-brown mb-1">Tidak Ada Data Area Manager</h3>
          <p className="text-xs text-suka-gray-500 max-w-sm">
            Tidak ditemukan staf aktif dengan role Area Manager yang memiliki cabang binaan.
          </p>
        </div>
      ) : activeTab === 'rm' && filteredRM.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-suka-gray-200 shadow-xs border-dashed text-center">
          <div className="w-12 h-12 bg-suka-gray-100 rounded-xl flex items-center justify-center mb-3 text-suka-gray-400">
            <Crown className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-suka-brown mb-1">Tidak Ada Data Regional Manager</h3>
          <p className="text-xs text-suka-gray-500 max-w-sm">
            Tidak ditemukan staf aktif dengan role Regional Manager di sistem.
          </p>
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white border border-suka-gray-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            {/* ── TAB 1: CREW & LEADER TABLE ── */}
            {activeTab === 'crew' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-suka-gray-50 border-b border-suka-gray-200 text-suka-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Nama Staf</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Outlet &amp; Pool Cabang</th>
                    <th className="px-5 py-3.5 text-right">Bonus Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 text-suka-ink">
                  {filteredCrew.map((row) => (
                    <tr key={row.crew_id} className="hover:bg-suka-cream/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              row.role === 'leader'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-orange-100 text-suka-orange'
                            }`}
                          >
                            {row.crew_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-suka-brown">{row.crew_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            row.role === 'leader'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-suka-gray-100 text-suka-gray-600 border-suka-gray-200'
                          }`}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="font-bold text-suka-brown flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-suka-gray-400 shrink-0" />
                            <span>{cleanOutletName(row.outlet_name)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono">
                            <span className="text-suka-gray-600 font-medium">
                              {formatNumber(row.total_pcs_outlet)} pcs
                            </span>
                            <span className="text-suka-gray-300">•</span>
                            <span className="text-suka-orange font-bold bg-orange-50 px-1.5 py-0.2 rounded border border-orange-100">
                              Pool {formatRupiah(row.total_pcs_outlet * row.bonus_rate)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums font-black text-emerald-700 text-sm">
                        {formatRupiah(row.total_bonus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer */}
                <tfoot className="bg-suka-gray-50 border-t-2 border-suka-gray-200 text-suka-ink font-bold">
                  <tr>
                    <td colSpan={2} className="px-5 py-3 text-xs">
                      Total ({filteredCrew.length} staf kru &amp; leader)
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-suka-gray-500">
                      Total Bonus Kru &amp; Leader:
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-black text-sm text-emerald-800">
                      {formatRupiah(crewTotalBonus)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ── TAB 2: AREA MANAGER TABLE ── */}
            {activeTab === 'am' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-suka-gray-50 border-b border-suka-gray-200 text-suka-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Nama Area Manager</th>
                    <th className="px-5 py-3.5">Cabang Binaan</th>
                    <th className="px-5 py-3.5 text-right">Total Pcs Binaan</th>
                    <th className="px-5 py-3.5 text-right">Tarif Bonus</th>
                    <th className="px-5 py-3.5 text-right">Total Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 text-suka-ink">
                  {filteredAM.map((row) => (
                    <tr key={row.staff_id} className="hover:bg-suka-cream/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {row.staff_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-suka-brown">{row.staff_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {row.managed_outlet_names.length > 0 ? (
                            row.managed_outlet_names.map((name, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {cleanOutletName(name)}
                              </span>
                            ))
                          ) : (
                            <span className="text-suka-gray-400 italic text-[11px]">Belum ada cabang binaan</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-suka-ink font-semibold">
                        {formatNumber(row.total_pcs)}{' '}
                        <span className="text-[10px] text-suka-gray-400">pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-suka-gray-500">
                        {formatRupiah(row.bonus_rate)}{' '}
                        <span className="text-[10px] text-suka-gray-400">/ pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums font-black text-emerald-700">
                        {formatRupiah(row.total_bonus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer */}
                <tfoot className="bg-suka-gray-50 border-t-2 border-suka-gray-200 text-suka-ink font-bold">
                  <tr>
                    <td colSpan={2} className="px-5 py-3 text-xs">
                      Total ({filteredAM.length} Area Manager)
                    </td>
                    <td colSpan={2} className="px-5 py-3 text-right text-xs text-suka-gray-500">
                      Total Bonus AM:
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-black text-sm text-emerald-800">
                      {formatRupiah(amTotalBonus)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ── TAB 3: REGIONAL MANAGER TABLE ── */}
            {activeTab === 'rm' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-suka-gray-50 border-b border-suka-gray-200 text-suka-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Nama Regional Manager</th>
                    <th className="px-5 py-3.5">Cakupan Wilayah</th>
                    <th className="px-5 py-3.5 text-right">Total Pcs Global</th>
                    <th className="px-5 py-3.5 text-right">Tarif Bonus</th>
                    <th className="px-5 py-3.5 text-right">Total Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 text-suka-ink">
                  {filteredRM.map((row) => (
                    <tr key={row.staff_id} className="hover:bg-suka-cream/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {row.staff_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-suka-brown">{row.staff_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Crown className="w-3 h-3 text-amber-600" />
                          {row.scope_description}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-suka-ink font-semibold">
                        {formatNumber(row.total_pcs_global)}{' '}
                        <span className="text-[10px] text-suka-gray-400">pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-suka-gray-500">
                        {formatRupiah(row.bonus_rate)}{' '}
                        <span className="text-[10px] text-suka-gray-400">/ pcs</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums font-black text-emerald-700">
                        {formatRupiah(row.total_bonus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer */}
                <tfoot className="bg-suka-gray-50 border-t-2 border-suka-gray-200 text-suka-ink font-bold">
                  <tr>
                    <td colSpan={2} className="px-5 py-3 text-xs">
                      Total ({filteredRM.length} Regional Manager)
                    </td>
                    <td colSpan={2} className="px-5 py-3 text-right text-xs text-suka-gray-500">
                      Total Bonus RM:
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-black text-sm text-emerald-800">
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
