'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  Store,
  Calendar,
  CalendarCheck,
  DollarSign,
  PackageCheck,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  RotateCcw,
  Filter,
  Search,
  UserCheck,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { todayWib } from '@/lib/dateIso'
import { useDailyOutletBonusDetail } from '@/hooks/useCrewBonus'
import { formatRupiah } from '@/lib/format'

function cleanOutletName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('id-ID').format(num)
}

interface OutletOption {
  id: string
  name: string
}

interface DailyOutletBonusViewProps {
  month: number
  year: number
  monthLabel: string
  outlets: OutletOption[]
  selectedOutletId: string
  onSelectOutletId: (id: string) => void
  onMonthYearChange?: (month: number, year: number) => void
  onOpenCrewDetail?: (crew: { id: string; name: string; role: string; subRole?: string }) => void
}

export function DailyOutletBonusView({
  month,
  year,
  monthLabel,
  outlets,
  selectedOutletId,
  onSelectOutletId,
  onMonthYearChange,
  onOpenCrewDetail,
}: DailyOutletBonusViewProps) {
  // If no outlet is selected, default to first outlet if available
  const activeOutletId = selectedOutletId || (outlets.length > 0 ? outlets[0].id : '')

  // Date filters
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unassigned' | 'sales_only' | 'normal'>('all')

  // Crew filter & search
  const [selectedCrewId, setSelectedCrewId] = useState<string>('')
  const [crewSearch, setCrewSearch] = useState<string>('')

  // Reset crew filter when outlet changes
  useEffect(() => {
    setSelectedCrewId('')
    setCrewSearch('')
  }, [activeOutletId])

  const { data: dailyRows = [], isLoading, isError, error } = useDailyOutletBonusDetail({
    month,
    year,
    outletId: activeOutletId || null,
  })

  const today = todayWib()
  const isToday = dateFrom === today && dateTo === today
  const isFiltered = Boolean(dateFrom || dateTo || statusFilter !== 'all' || selectedCrewId || crewSearch)

  const handleDateFromChange = (newDate: string) => {
    setDateFrom(newDate)
    if (newDate && dateTo && newDate > dateTo) {
      setDateTo(newDate)
    }
    if (newDate) {
      const [y, m] = newDate.split('-').map(Number)
      if (y && m && (y !== year || m !== month)) {
        onMonthYearChange?.(m, y)
      }
    }
  }

  const handleDateToChange = (newDate: string) => {
    setDateTo(newDate)
    if (newDate && dateFrom && newDate < dateFrom) {
      setDateFrom(newDate)
    }
    if (newDate) {
      const [y, m] = newDate.split('-').map(Number)
      if (y && m && (y !== year || m !== month)) {
        onMonthYearChange?.(m, y)
      }
    }
  }

  const outletOptions = useMemo(() => {
    return outlets.map((o) => ({
      label: cleanOutletName(o.name),
      value: o.id,
      icon: <Store className="w-4 h-4 text-suka-gray-400" />,
    }))
  }, [outlets])

  // Extract all unique crew members who worked at this outlet
  const crewOptions = useMemo(() => {
    const crewMap = new Map<string, { id: string; name: string; role: string; sub_role?: string }>()
    dailyRows.forEach((row) => {
      row.crew_list.forEach((c) => {
        if (!crewMap.has(c.crew_id)) {
          crewMap.set(c.crew_id, {
            id: c.crew_id,
            name: c.crew_name,
            role: c.role,
            sub_role: c.sub_role,
          })
        }
      })
    })

    const sorted = Array.from(crewMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    return [
      { label: `Semua Kru Bertugas (${sorted.length} Staf)`, value: '' },
      ...sorted.map((c) => {
        const badge = c.role === 'leader' ? 'Leader' : c.sub_role === 'crew_backup' ? 'Backup' : 'Crew'
        return {
          label: `${c.name} (${badge})`,
          value: c.id,
          icon: <Users className="w-4 h-4 text-suka-gray-400" />,
        }
      }),
    ]
  }, [dailyRows])

  const activeCrewInfo = useMemo(() => {
    if (!selectedCrewId) return null
    for (const row of dailyRows) {
      const found = row.crew_list.find((c) => c.crew_id === selectedCrewId)
      if (found) return found
    }
    return null
  }, [dailyRows, selectedCrewId])

  const statusOptions = useMemo(() => [
    { label: 'Semua Status Tanggal', value: 'all' },
    { label: 'Ada Penjualan (Pcs > 0)', value: 'sales_only' },
    { label: '⚠️ Absensi Kosong (Tertahan)', value: 'unassigned' },
    { label: 'Normal (Kru Bertugas)', value: 'normal' },
  ], [])

  const selectedOutletName = useMemo(() => {
    const found = outlets.find((o) => o.id === activeOutletId)
    return found ? cleanOutletName(found.name) : 'Outlet'
  }, [outlets, activeOutletId])

  // Filtered rows based on date range, status, crew selection, and crew search
  const filteredDailyRows = useMemo(() => {
    return dailyRows.filter((r) => {
      if (dateFrom && r.bonus_date < dateFrom) return false
      if (dateTo && r.bonus_date > dateTo) return false

      if (statusFilter === 'unassigned' && r.status !== 'unassigned_pool') return false
      if (statusFilter === 'sales_only' && r.total_pcs <= 0) return false
      if (statusFilter === 'normal' && r.status !== 'normal') return false

      if (selectedCrewId) {
        const isPresent = r.crew_list.some((c) => c.crew_id === selectedCrewId)
        if (!isPresent) return false
      }

      if (crewSearch.trim()) {
        const q = crewSearch.trim().toLowerCase()
        const hasMatchingCrew = r.crew_list.some((c) => c.crew_name.toLowerCase().includes(q))
        if (!hasMatchingCrew) return false
      }

      return true
    })
  }, [dailyRows, dateFrom, dateTo, statusFilter, selectedCrewId, crewSearch])

  // Specific stats when a crew member is selected
  const crewStats = useMemo(() => {
    if (!selectedCrewId) return null
    let daysWorked = 0
    let totalPcsWhenPresent = 0
    let totalCrewBonusEarned = 0

    filteredDailyRows.forEach((r) => {
      const match = r.crew_list.find((c) => c.crew_id === selectedCrewId)
      if (match) {
        daysWorked += 1
        totalPcsWhenPresent += r.total_pcs
        totalCrewBonusEarned += r.bonus_per_crew
      }
    })

    return {
      daysWorked,
      totalPcsWhenPresent,
      totalCrewBonusEarned,
    }
  }, [filteredDailyRows, selectedCrewId])

  // Summary statistics for the filtered rows
  const stats = useMemo(() => {
    let totalPcs = 0
    let totalPool = 0
    let totalDistributedBonus = 0
    let unassignedPool = 0
    let unassignedDaysCount = 0
    let totalCrewDays = 0

    filteredDailyRows.forEach((r) => {
      totalPcs += r.total_pcs
      totalPool += r.pool_amount
      totalCrewDays += r.crew_count

      if (r.status === 'unassigned_pool') {
        unassignedPool += r.pool_amount
        unassignedDaysCount += 1
      } else {
        totalDistributedBonus += r.bonus_per_crew * r.crew_count
      }
    })

    return {
      totalPcs,
      totalPool,
      totalDistributedBonus,
      unassignedPool,
      unassignedDaysCount,
      totalCrewDays,
    }
  }, [filteredDailyRows])

  // Export to Excel function
  const handleExportExcel = () => {
    if (!filteredDailyRows || filteredDailyRows.length === 0) return

    const exportData = filteredDailyRows.map((r) => {
      const crewNames = r.crew_list
        .map((c) => `${c.crew_name} (${c.role === 'leader' ? 'Leader' : c.sub_role === 'crew_backup' ? 'Backup' : 'Crew'})`)
        .join(', ')

      return {
        Tanggal: r.bonus_date,
        Hari: r.day_name,
        Outlet: selectedOutletName,
        'Pcs Terjual': r.total_pcs,
        'Pool Bonus (Rp)': r.pool_amount,
        'Jumlah Kru Hadir': r.crew_count,
        'Status Absensi':
          r.status === 'unassigned_pool'
            ? 'Absensi Kosong (Pool Tertahan)'
            : r.status === 'no_sales'
            ? 'Tidak Ada Transaksi'
            : 'Normal',
        'Daftar Kru Bertugas': crewNames || '-',
        'Bonus per Kru (Rp)': r.bonus_per_crew,
        'Total Bonus Terbagi (Rp)': r.bonus_per_crew * r.crew_count,
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const colWidths = [
      { wch: 12 }, // Tanggal
      { wch: 10 }, // Hari
      { wch: 22 }, // Outlet
      { wch: 12 }, // Pcs
      { wch: 15 }, // Pool
      { wch: 16 }, // Jumlah Kru
      { wch: 28 }, // Status
      { wch: 45 }, // Daftar Kru
      { wch: 18 }, // Bonus per Kru
      { wch: 22 }, // Total Terbagi
    ]
    worksheet['!cols'] = colWidths

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rincian Bonus Harian')

    const dateScopeText = dateFrom && dateTo ? `_${dateFrom}_sd_${dateTo}` : `_${monthLabel}_${year}`
    const crewScopeText = activeCrewInfo ? `_${activeCrewInfo.crew_name.replace(/\s+/g, '_')}` : ''
    const filename = `Laporan_Bonus_Harian_${selectedOutletName.replace(/\s+/g, '_')}${crewScopeText}${dateScopeText}.xlsx`
    XLSX.writeFile(workbook, filename)
  }

  return (
    <div className="space-y-5 text-suka-ink">
      {/* ── Control & Selector Bar ── */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-xs space-y-3.5">
        {/* Row 1: Outlet Selector, Crew Filter & Excel Export */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Cabang Selector */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center font-bold border border-orange-100 shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-400 block">
                  Pilih Cabang Operasional
                </span>
                <div className="w-56 mt-0.5">
                  <Select
                    options={outletOptions}
                    value={activeOutletId}
                    onChange={onSelectOutletId}
                    className="w-full"
                    placeholder="Pilih Outlet..."
                    searchable
                  />
                </div>
              </div>
            </div>

            {/* Crew Filter Selector */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-400 block">
                  Filter Kru Bertugas
                </span>
                <div className="w-64 mt-0.5">
                  <Select
                    options={crewOptions}
                    value={selectedCrewId}
                    onChange={setSelectedCrewId}
                    className="w-full"
                    placeholder="Semua Kru Bertugas..."
                    searchable
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredDailyRows.length === 0 || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel ({filteredDailyRows.length} Hari)</span>
            </button>
          </div>
        </div>

        {/* Row 2: Date Filters & Status Filters */}
        <div className="pt-3 border-t border-suka-gray-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-suka-gray-500 font-bold mr-1">
              <Calendar className="w-3.5 h-3.5 text-suka-orange" />
              <span>Filter Tanggal:</span>
            </div>

            {/* Date Pickers (Dari - Sampai) */}
            <DatePicker
              label="Dari"
              value={dateFrom}
              onChange={handleDateFromChange}
              rangeFrom={dateFrom}
              rangeTo={dateTo}
              placeholder="Awal bulan"
            />
            <DatePicker
              label="Sampai"
              value={dateTo}
              onChange={handleDateToChange}
              rangeFrom={dateFrom}
              rangeTo={dateTo}
              placeholder="Akhir bulan"
              align="right"
            />

            {/* Quick Presets */}
            <button
              type="button"
              onClick={() => {
                setDateFrom(today)
                setDateTo(today)
                const [y, m] = today.split('-').map(Number)
                if (y && m && (y !== year || m !== month)) {
                  onMonthYearChange?.(m, y)
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isToday
                  ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                  : 'bg-white text-suka-brown border-suka-gray-200 hover:border-suka-orange/60 hover:bg-orange-50/50'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Hari Ini</span>
            </button>

            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  setStatusFilter('all')
                  setSelectedCrewId('')
                  setCrewSearch('')
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-suka-gray-100 hover:bg-suka-gray-200 text-suka-gray-700 border border-suka-gray-200 transition-all cursor-pointer"
                title="Reset semua filter"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Right Toolbar: Quick Crew Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Crew Search Input */}
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
              <input
                type="text"
                placeholder="Cari nama kru..."
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-suka-gray-50 border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all text-suka-ink placeholder:text-suka-gray-400"
              />
              {crewSearch && (
                <button
                  type="button"
                  onClick={() => setCrewSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 hover:text-suka-ink cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="w-48">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as any)}
                placeholder="Semua Status Tanggal"
                className="w-full text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Crew Filter Banner (If a crew is selected) ── */}
      {activeCrewInfo && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-orange-50/80 border border-orange-200 text-xs text-suka-brown shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-suka-orange text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-suka-brown">
                  Filter Kru: {activeCrewInfo.crew_name}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white text-suka-brown border border-orange-200">
                  {activeCrewInfo.role === 'leader' ? 'Leader' : activeCrewInfo.sub_role === 'crew_backup' ? 'Mobile Backup' : 'Crew'}
                </span>
              </div>
              <p className="text-[11px] text-suka-gray-600 mt-0.5">
                Menampilkan <strong className="text-suka-brown">{crewStats?.daysWorked || 0} hari bertugas</strong> di cabang {selectedOutletName} • Total Bonus Terkumpul di Outlet Ini: <strong className="font-mono text-emerald-700 font-black">{formatRupiah(crewStats?.totalCrewBonusEarned || 0)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onOpenCrewDetail && (
              <button
                type="button"
                onClick={() =>
                  onOpenCrewDetail({
                    id: activeCrewInfo.crew_id,
                    name: activeCrewInfo.crew_name,
                    role: activeCrewInfo.role,
                    subRole: activeCrewInfo.sub_role,
                  })
                }
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-suka-brown border border-orange-200 hover:bg-stone-50 cursor-pointer shadow-2xs transition-colors"
              >
                Lihat Detail Lengkap Staf
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedCrewId('')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-suka-gray-600 bg-white/80 border border-suka-gray-200 hover:bg-white hover:text-suka-ink transition-colors cursor-pointer"
              title="Hapus filter kru"
            >
              <X className="w-3.5 h-3.5" />
              <span>Hapus Filter Kru</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Outlet Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Pcs Outlet */}
        <div className="bg-white rounded-2xl p-4 border border-suka-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400">
              Pcs Terjual ({selectedOutletName})
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <PackageCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-suka-brown tabular-nums">
            {formatNumber(stats.totalPcs)} <span className="text-xs font-normal text-suka-gray-500">pcs</span>
          </div>
          <p className="text-[11px] text-suka-gray-500 mt-1 font-medium">
            {isFiltered ? `${filteredDailyRows.length} hari terfilter` : `Periode ${monthLabel} ${year}`}
          </p>
        </div>

        {/* Card 2: Total Pool Tercipta */}
        <div className="bg-white rounded-2xl p-4 border border-suka-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400">
              Total Pool Tercipta
            </span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-suka-orange flex items-center justify-center border border-orange-100">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-suka-orange tabular-nums">
            {formatRupiah(stats.totalPool)}
          </div>
          <p className="text-[11px] text-suka-gray-500 mt-1 font-medium">
            Akumulasi harian (Pcs × Rp 100)
          </p>
        </div>

        {/* Card 3: Total Bonus Terbagi / Bonus Kru Terpilih */}
        <div className="bg-white rounded-2xl p-4 border border-suka-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400">
              {activeCrewInfo ? `Bonus ${activeCrewInfo.crew_name}` : 'Bonus Terdistribusi'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 tabular-nums">
            {formatRupiah(crewStats ? crewStats.totalCrewBonusEarned : stats.totalDistributedBonus)}
          </div>
          <p className="text-[11px] text-suka-gray-500 mt-1 font-medium">
            {activeCrewInfo
              ? `${crewStats?.daysWorked || 0} hari bertugas di ${selectedOutletName}`
              : `Terbagi ke ${stats.totalCrewDays} kru-hari aktif`}
          </p>
        </div>

        {/* Card 4: Pool Tertahan (Jika Ada) */}
        <div
          className={`bg-white rounded-2xl p-4 border shadow-xs transition-colors ${
            stats.unassignedDaysCount > 0
              ? 'border-amber-300 bg-amber-50/40'
              : 'border-suka-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400">
              Pool Belum Terbagi
            </span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                stats.unassignedDaysCount > 0
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-suka-gray-100 text-suka-gray-400 border-suka-gray-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-black font-mono tabular-nums ${
              stats.unassignedDaysCount > 0 ? 'text-amber-700' : 'text-suka-gray-400'
            }`}
          >
            {formatRupiah(stats.unassignedPool)}
          </div>
          <p className="text-[11px] text-suka-gray-500 mt-1 font-medium">
            {stats.unassignedDaysCount > 0
              ? `⚠️ ${stats.unassignedDaysCount} hari belum tercatat absensi`
              : 'Seluruh pool terdistribusi lancar'}
          </p>
        </div>
      </div>

      {/* ── Warning Alert (if unassigned pool exists) ── */}
      {stats.unassignedDaysCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-900">
              Perhatian: Terdapat {stats.unassignedDaysCount} tanggal penjualan tanpa catatan absensi kru!
            </div>
            <p className="text-amber-700 leading-relaxed">
              Terdapat pool bonus senilai <span className="font-bold">{formatRupiah(stats.unassignedPool)}</span> yang tertahan di cabang {selectedOutletName} karena tidak ada staf yang tercatat clock-in pada hari tersebut. Mohon hubungi leader/AM terkait atau input koreksi absensi manual kru yang bertugas di menu <strong>Manajemen Absensi</strong> agar bonus dapat terbagi otomatis.
            </p>
          </div>
        </div>
      )}

      {/* ── Table Container ── */}
      <div className="bg-white border border-suka-gray-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Filter Summary Bar */}
        <div className="px-5 py-3 border-b border-suka-gray-100 bg-suka-gray-50/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-suka-orange shrink-0" />
            <span className="font-medium text-suka-gray-600">
              Menampilkan <strong className="text-suka-brown font-mono">{filteredDailyRows.length}</strong> dari <span className="font-mono">{dailyRows.length}</span> hari kalender
              {dateFrom && dateTo && (
                <span className="ml-1 text-suka-orange font-bold font-mono">
                  ({dateFrom} s/d {dateTo})
                </span>
              )}
              {activeCrewInfo && (
                <span className="ml-1 text-blue-600 font-bold">
                  • Kru: {activeCrewInfo.crew_name}
                </span>
              )}
              {crewSearch && (
                <span className="ml-1 text-purple-600 font-bold">
                  • Cari: &quot;{crewSearch}&quot;
                </span>
              )}
            </span>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setStatusFilter('all')
                setSelectedCrewId('')
                setCrewSearch('')
              }}
              className="text-[11px] font-bold text-suka-orange hover:underline cursor-pointer"
            >
              Hapus Semua Filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-suka-gray-500 font-bold text-xs">
            <div className="w-8 h-8 border-3 border-suka-orange border-t-transparent rounded-full animate-spin mb-3" />
            Mengambil data penjualan &amp; absensi harian {selectedOutletName}...
          </div>
        ) : isError ? (
          <div className="py-12 px-6 text-center text-red-600 text-xs">
            Gagal memuat rincian harian: {(error as any)?.message}
          </div>
        ) : filteredDailyRows.length === 0 ? (
          <div className="py-16 px-6 text-center text-xs text-suka-gray-400 space-y-2">
            <Calendar className="w-8 h-8 text-suka-gray-300 mx-auto" />
            <p className="font-semibold text-suka-brown">Tidak ada data untuk tanggal/kru/status yang dipilih</p>
            <p className="text-[11px] text-suka-gray-400">Silakan sesuaikan filter kru, rentang tanggal, atau status Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-suka-gray-50 border-b border-suka-gray-200 text-suka-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Tanggal &amp; Hari</th>
                  <th className="px-5 py-3.5 text-right">Pcs Terjual</th>
                  <th className="px-5 py-3.5 text-right">Pool Harian</th>
                  <th className="px-5 py-3.5 text-center">Status Kehadiran</th>
                  <th className="px-5 py-3.5">
                    Kru yang Bertugas di Outlet
                    <span className="block text-[9px] font-normal text-suka-gray-400 lowercase">
                      (klik chip untuk filter staf)
                    </span>
                  </th>
                  <th className="px-5 py-3.5 text-right font-black text-emerald-800">
                    {activeCrewInfo ? `Bonus ${activeCrewInfo.crew_name}` : 'Bonus / Kru'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100 text-suka-ink">
                {filteredDailyRows.map((row) => {
                  const isUnassigned = row.status === 'unassigned_pool'
                  const isNoSales = row.status === 'no_sales'

                  return (
                    <tr
                      key={row.bonus_date}
                      className={`transition-colors ${
                        isUnassigned
                          ? 'bg-amber-50/50 hover:bg-amber-100/50'
                          : isNoSales
                          ? 'hover:bg-stone-50/60 opacity-75'
                          : 'hover:bg-suka-cream/30'
                      }`}
                    >
                      {/* Tanggal & Hari */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-suka-brown text-xs font-mono">
                            {row.bonus_date}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-suka-gray-100 text-suka-gray-600 border border-suka-gray-200">
                            {row.day_name}
                          </span>
                        </div>
                      </td>

                      {/* Pcs Terjual */}
                      <td className="px-5 py-3.5 text-right font-mono font-bold tabular-nums text-suka-brown">
                        {row.total_pcs > 0 ? (
                          <span>{formatNumber(row.total_pcs)} pcs</span>
                        ) : (
                          <span className="text-suka-gray-400 font-normal">0 pcs</span>
                        )}
                      </td>

                      {/* Pool Harian */}
                      <td className="px-5 py-3.5 text-right font-mono font-bold tabular-nums text-suka-orange">
                        {row.pool_amount > 0 ? (
                          formatRupiah(row.pool_amount)
                        ) : (
                          <span className="text-suka-gray-300 font-normal">Rp 0</span>
                        )}
                      </td>

                      {/* Status Kehadiran */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            0 Kru (Pool Tertahan)
                          </span>
                        ) : isNoSales && row.crew_count === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-suka-gray-400 bg-stone-100 px-2 py-0.5 rounded-full">
                            Tidak Ada Transaksi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <Users className="w-3 h-3 text-emerald-600" />
                            {row.crew_count} Kru Bertugas
                          </span>
                        )}
                      </td>

                      {/* Daftar Kru Hadir (Clickable) */}
                      <td className="px-5 py-3.5">
                        {row.crew_list.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {row.crew_list.map((c) => {
                              const isLeader = c.role === 'leader'
                              const isBackup = c.sub_role === 'crew_backup'
                              const isSelected = c.crew_id === selectedCrewId

                              return (
                                <button
                                  key={c.crew_id}
                                  type="button"
                                  onClick={() => setSelectedCrewId(isSelected ? '' : c.crew_id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-suka-orange text-white border-suka-orange ring-2 ring-suka-orange/30 shadow-xs'
                                      : selectedCrewId
                                      ? 'opacity-40 hover:opacity-100 bg-stone-50 text-stone-700 border-stone-200'
                                      : isLeader
                                      ? 'bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-400'
                                      : isBackup
                                      ? 'bg-purple-50 text-purple-800 border-purple-200 hover:border-purple-400'
                                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-suka-orange/50'
                                  }`}
                                  title={`Klik untuk memfilter ${c.crew_name}`}
                                >
                                  <span
                                    className={`w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-bold shrink-0 ${
                                      isSelected
                                        ? 'bg-white text-suka-orange'
                                        : isLeader
                                        ? 'bg-amber-600 text-white'
                                        : isBackup
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-stone-500 text-white'
                                    }`}
                                  >
                                    {c.crew_name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="truncate max-w-[130px]">{c.crew_name}</span>
                                  {isLeader && (
                                    <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-white' : 'text-amber-700'}`}>
                                      (L)
                                    </span>
                                  )}
                                  {isBackup && (
                                    <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-white' : 'text-purple-700'}`}>
                                      (B)
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        ) : isUnassigned ? (
                          <span className="text-[11px] text-amber-700 font-bold italic flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Menunggu input absensi oleh HR/Leader
                          </span>
                        ) : (
                          <span className="text-[11px] text-suka-gray-400 italic">
                            -
                          </span>
                        )}
                      </td>

                      {/* Nominal Bonus per Kru */}
                      <td className="px-5 py-3.5 text-right font-mono font-black tabular-nums text-sm whitespace-nowrap">
                        {row.bonus_per_crew > 0 ? (
                          <span className="text-emerald-700">
                            {formatRupiah(row.bonus_per_crew)}
                          </span>
                        ) : isUnassigned ? (
                          <span className="text-xs text-amber-600 font-semibold">
                            Tertahan
                          </span>
                        ) : (
                          <span className="text-xs text-suka-gray-300 font-normal">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Footer */}
              <tfoot className="bg-suka-gray-50 border-t-2 border-suka-gray-200 text-suka-ink font-bold">
                <tr>
                  <td className="px-5 py-3.5 text-xs text-suka-brown">
                    Total ({filteredDailyRows.length} Hari Terfilter)
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-suka-brown">
                    {formatNumber(stats.totalPcs)} pcs
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-suka-orange">
                    {formatRupiah(stats.totalPool)}
                  </td>
                  <td className="px-5 py-3.5 text-center font-mono text-xs text-suka-gray-600">
                    {activeCrewInfo ? `${crewStats?.daysWorked || 0} Hari Kerja` : `${stats.totalCrewDays} Kru-Hari`}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-right text-suka-gray-500">
                    {activeCrewInfo ? `Total Bonus ${activeCrewInfo.crew_name}:` : 'Total Bonus Terdistribusi:'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-black tabular-nums text-emerald-800 text-sm">
                    {formatRupiah(activeCrewInfo && crewStats ? crewStats.totalCrewBonusEarned : stats.totalDistributedBonus)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
