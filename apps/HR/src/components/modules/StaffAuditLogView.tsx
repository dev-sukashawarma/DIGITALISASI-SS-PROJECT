'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  History,
  UserPlus,
  ArrowLeftRight,
  PowerOff,
  Edit,
  Search,
  Building2,
  RefreshCw,
  Calendar,
  X,
} from 'lucide-react'
import { Avatar, Button, Spinner } from '@suka/design-system'
import type { Outlet } from '@/lib/types'
import {
  getAllStaffActivityLogs,
  type GlobalStaffActivityLog,
} from '@/app/actions/users'
import { DatePicker } from '@/components/ui/DatePicker'
import { Pagination, clampPage } from '@/components/ui/Pagination'
import { todayWib } from '@/lib/dateIso'

interface StaffAuditLogViewProps {
  outlets: Outlet[]
}

const ACTION_TYPE_OPTIONS = [
  { value: 'all', label: 'Semua Aktivitas' },
  { value: 'CREATED', label: '🟢 Pendaftaran Karyawan Baru' },
  { value: 'MUTATED_OUTLET', label: '🟣 Mutasi Cabang Outlet' },
  { value: 'DEACTIVATED', label: '🔴 Penonaktifan & Resign' },
  { value: 'UPDATED_PROFILE', label: '🟡 Pembaruan Profil & Gaji' },
]

type TimePreset = 'all' | 'today' | 'this_month' | 'last_month' | 'this_year' | 'custom'

const TIME_PRESET_OPTIONS: { value: TimePreset; label: string }[] = [
  { value: 'all', label: 'Semua Waktu' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'this_month', label: 'Bulan Ini' },
  { value: 'last_month', label: 'Bulan Lalu' },
  { value: 'this_year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Kustom Tanggal' },
]

export function StaffAuditLogView({ outlets }: StaffAuditLogViewProps) {
  const [logs, setLogs] = useState<GlobalStaffActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [actionType, setActionType] = useState('all')
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Time Filters
  const [timePreset, setTimePreset] = useState<TimePreset>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const handleTimePresetChange = (preset: TimePreset) => {
    setTimePreset(preset)
    if (preset === 'all') {
      setDateFrom('')
      setDateTo('')
      return
    }

    const todayStr = todayWib()
    const [y, m] = todayStr.split('-').map(Number)

    if (preset === 'today') {
      setDateFrom(todayStr)
      setDateTo(todayStr)
    } else if (preset === 'this_month') {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const mm = String(m).padStart(2, '0')
      setDateFrom(`${y}-${mm}-01`)
      setDateTo(`${y}-${mm}-${String(lastDay).padStart(2, '0')}`)
    } else if (preset === 'last_month') {
      const prevDate = new Date(Date.UTC(y, m - 2, 1))
      const py = prevDate.getUTCFullYear()
      const pm = prevDate.getUTCMonth() + 1
      const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate()
      const pmm = String(pm).padStart(2, '0')
      setDateFrom(`${py}-${pmm}-01`)
      setDateTo(`${py}-${pmm}-${String(lastDay).padStart(2, '0')}`)
    } else if (preset === 'this_year') {
      setDateFrom(`${y}-01-01`)
      setDateTo(`${y}-12-31`)
    } else if (preset === 'custom') {
      if (!dateFrom) setDateFrom(`${y}-${String(m).padStart(2, '0')}-01`)
      if (!dateTo) setDateTo(todayStr)
    }
  }

  const handleResetTimeFilter = () => {
    setTimePreset('all')
    setDateFrom('')
    setDateTo('')
  }

  const handleSetDateFrom = (d: string) => {
    setDateFrom(d)
    if (dateTo && dateTo < d) {
      setDateTo(d)
    }
    setTimePreset('custom')
  }

  const handleSetDateTo = (d: string) => {
    setDateTo(d)
    if (dateFrom && dateFrom > d) {
      setDateFrom(d)
    }
    setTimePreset('custom')
  }

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const res = await getAllStaffActivityLogs({
        actionType: actionType !== 'all' ? actionType : undefined,
        outletId: selectedOutlet !== 'all' ? selectedOutlet : undefined,
        search: searchQuery.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 1000,
      })
      if (res.ok) {
        setLogs(res.data)
      }
    } catch (e) {
      console.error('Error fetching logs:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [actionType, selectedOutlet, dateFrom, dateTo])

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [actionType, selectedOutlet, searchQuery, dateFrom, dateTo, pageSize])

  // Hitung KPI
  const stats = useMemo(() => {
    let created = 0
    let mutated = 0
    let deactivated = 0
    let updated = 0

    logs.forEach((l) => {
      if (l.action_type === 'CREATED') created++
      else if (l.action_type === 'MUTATED_OUTLET') mutated++
      else if (l.action_type === 'DEACTIVATED') deactivated++
      else updated++
    })

    return { total: logs.length, created, mutated, deactivated, updated }
  }, [logs])

  // Filter pencarian client-side tambahan
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase().trim()
    return logs.filter((l) => {
      const name = l.staff?.name?.toLowerCase() || ''
      const desc = l.description?.toLowerCase() || ''
      const title = l.title?.toLowerCase() || ''
      const actor = l.actor_name?.toLowerCase() || ''
      return name.includes(q) || desc.includes(q) || title.includes(q) || actor.includes(q)
    })
  }, [logs, searchQuery])

  // Pagination slicing
  const paginatedLogs = useMemo(() => {
    const validPage = clampPage(currentPage, filteredLogs.length, pageSize)
    const start = (validPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, currentPage, pageSize])

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Total Log */}
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-suka-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Riwayat</span>
            <History size={16} className="text-suka-orange" />
          </div>
          <div className="text-2xl font-black text-suka-brown">{stats.total}</div>
          <p className="text-[11px] text-stone-400 mt-0.5">Catatan audit log personalia</p>
        </div>

        {/* Pendaftaran Baru */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Crew Baru</span>
            <UserPlus size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900">{stats.created}</div>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">Pendaftaran karyawan baru</p>
        </div>

        {/* Mutasi Cabang */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-indigo-800 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Mutasi Cabang</span>
            <ArrowLeftRight size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900">{stats.mutated}</div>
          <p className="text-[11px] text-indigo-700/80 mt-0.5">Perpindahan penugasan outlet</p>
        </div>

        {/* Nonaktif / Resign */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-800 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Nonaktif / Resign</span>
            <PowerOff size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-900">{stats.deactivated}</div>
          <p className="text-[11px] text-rose-700/80 mt-0.5">Exit &amp; penonaktifan staf</p>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search Bar */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama staf, admin, catatan..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-suka-gray-200 bg-stone-50/50 focus:bg-white focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none transition-all"
              />
            </div>

            {/* Filter Jenis Aktivitas */}
            <div className="flex items-center gap-1.5">
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="text-xs font-bold rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-suka-brown outline-none focus:border-suka-orange cursor-pointer"
              >
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Cabang Outlet */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                className="text-xs font-bold rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-suka-brown outline-none focus:border-suka-orange cursor-pointer max-w-[200px]"
              >
                <option value="all">Semua Outlet Cabang</option>
                {outlets
                  .filter((o) => o.is_active !== false)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Filter Waktu Preset */}
            <div className="flex items-center gap-1.5">
              <select
                value={timePreset}
                onChange={(e) => handleTimePresetChange(e.target.value as TimePreset)}
                className={`text-xs font-bold rounded-xl border px-3 py-2 outline-none cursor-pointer transition-colors ${
                  timePreset !== 'all'
                    ? 'border-suka-orange bg-amber-50/60 text-suka-brown font-extrabold'
                    : 'border-suka-gray-200 bg-white text-suka-brown focus:border-suka-orange'
                }`}
              >
                {TIME_PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={fetchLogs}
              disabled={isLoading}
              className="rounded-xl border border-suka-gray-200 gap-1.5 text-xs font-bold cursor-pointer"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin text-suka-orange' : ''} />
              <span>Segarkan</span>
            </Button>
          </div>
        </div>

        {/* Date Pickers Row (visible when timePreset !== 'all') */}
        {timePreset !== 'all' && (
          <div className="flex items-center gap-2 pt-2.5 border-t border-suka-gray-100 flex-wrap animate-in fade-in duration-150">
            <span className="text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar size={13} className="text-suka-orange" />
              Rentang Tanggal:
            </span>
            <DatePicker
              label="Dari"
              value={dateFrom}
              onChange={handleSetDateFrom}
              rangeFrom={dateFrom}
              rangeTo={dateTo}
            />
            <span className="text-xs text-suka-gray-400 font-bold">-</span>
            <DatePicker
              label="Sampai"
              value={dateTo}
              onChange={handleSetDateTo}
              rangeFrom={dateFrom}
              rangeTo={dateTo}
              align="right"
            />
            <button
              type="button"
              onClick={handleResetTimeFilter}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-suka-gray-600 hover:text-red-600 bg-suka-gray-100 hover:bg-red-50 border border-suka-gray-200 hover:border-red-200 transition-colors cursor-pointer ml-1"
              title="Reset Filter Tanggal"
            >
              <X size={12} />
              <span>Reset Waktu</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Log Table */}
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-xs">
        <div className="px-5 py-3.5 border-b border-suka-gray-100 flex items-center justify-between bg-stone-50/60">
          <div className="flex items-center gap-2">
            <History size={16} className="text-suka-orange" />
            <h3 className="font-extrabold text-sm text-suka-brown">
              Rekam Jejak Log Personalia Keseluruhan
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-suka-gray-500 font-semibold">
              Total <strong>{filteredLogs.length}</strong> catatan
            </span>
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span>Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs font-bold rounded-lg border border-suka-gray-200 bg-white px-2 py-1 text-suka-brown outline-none cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Spinner />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-2">
            <History size={36} className="mx-auto text-stone-300" />
            <p className="text-sm font-bold text-stone-600">Tidak ada riwayat aktivitas yang cocok</p>
            <p className="text-xs text-stone-400">
              Coba ganti kata kunci pencarian atau sesuaikan filter jenis aktivitas / rentang tanggal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-suka-gray-200 font-bold text-suka-brown text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">Waktu</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Karyawan</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Aktivitas</th>
                  <th className="px-4 py-3.5">Detail &amp; Deskripsi</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Outlet Cabang</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Dicatat Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {paginatedLogs.map((log) => {
                  const isCreated = log.action_type === 'CREATED'
                  const isMutated = log.action_type === 'MUTATED_OUTLET'
                  const isDeactivated = log.action_type === 'DEACTIVATED'
                  const isUpdated = log.action_type === 'UPDATED_PROFILE'

                  const badgeStyle = isCreated
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isMutated
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                    : isDeactivated
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'

                  const staffName = log.staff?.name || 'Karyawan'
                  const staffRole = (log.staff?.role || log.metadata?.role || 'staff').replace(/_/g, ' ')
                  const outletName =
                    log.staff?.outlets?.name ||
                    log.metadata?.outlet_name ||
                    log.metadata?.target_outlet_name ||
                    'Kantor Pusat'

                  const createdDate = new Date(log.created_at)

                  return (
                    <tr key={log.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* Waktu */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-stone-600">
                        <div className="font-bold text-stone-800">
                          {createdDate.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {createdDate.toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Karyawan */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={staffName} size={30} />
                          <div>
                            <div className="font-bold text-suka-ink text-xs">{staffName}</div>
                            <div className="text-[10px] text-suka-gray-500 uppercase font-semibold">
                              {staffRole}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Aktivitas Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}
                        >
                          {isCreated && <UserPlus size={11} className="shrink-0" />}
                          {isMutated && <ArrowLeftRight size={11} className="shrink-0" />}
                          {isDeactivated && <PowerOff size={11} className="shrink-0" />}
                          {isUpdated && <Edit size={11} className="shrink-0" />}
                          {log.title}
                        </span>
                      </td>

                      {/* Deskripsi */}
                      <td className="px-4 py-3.5 text-stone-700 text-xs leading-relaxed max-w-md">
                        <div>{log.description}</div>
                        {log.metadata?.notes && (
                          <div className="text-[11px] text-stone-500 italic mt-0.5">
                            Catatan: &ldquo;{log.metadata.notes}&rdquo;
                          </div>
                        )}
                        {log.metadata?.effective_date && (
                          <div className="text-[10px] font-mono text-indigo-700 font-semibold mt-0.5">
                            Efektif per: {log.metadata.effective_date}
                          </div>
                        )}
                      </td>

                      {/* Outlet */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-stone-700">
                          <Building2 size={12} className="text-stone-400 shrink-0" />
                          {outletName}
                        </span>
                      </td>

                      {/* Dicatat Oleh */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                          {log.actor_name || 'Sistem / HR'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredLogs.length > 0 && (
          <div className="px-5 py-3.5 border-t border-suka-gray-100 bg-stone-50/60">
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={filteredLogs.length}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
