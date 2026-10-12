'use client'

import { useState, useMemo } from 'react'
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useEmergencyAssignments, useEmergencyOutlets } from '@/hooks/useEmergencyBackup'
import { EmergencyTable } from '@/components/modules/emergency/EmergencyTable'
import { EmergencyAssignmentModal } from '@/components/modules/emergency/EmergencyAssignmentModal'
import type { EmergencyAssignmentStatus } from '@/lib/types'

export default function EmergencyBackupPage() {
  const todayWib = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
    []
  )

  const currentMonth = useMemo(() => todayWib.slice(0, 7), [todayWib])

  // Filter States
  const [filterMode, setFilterMode] = useState<'today' | 'month' | 'custom'>('today')
  const [customDate, setCustomDate] = useState(todayWib)
  const [outletFilter, setOutletFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EmergencyAssignmentStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Query Params
  const queryParams = useMemo(() => {
    if (filterMode === 'today') {
      return { date: todayWib, status: statusFilter, outletId: outletFilter }
    }
    if (filterMode === 'custom') {
      return { date: customDate, status: statusFilter, outletId: outletFilter }
    }
    return { month: currentMonth, status: statusFilter, outletId: outletFilter }
  }, [filterMode, todayWib, customDate, currentMonth, statusFilter, outletFilter])

  const { data: assignments = [], isLoading } = useEmergencyAssignments(queryParams)
  const { data: outlets = [] } = useEmergencyOutlets()

  // Summary Metrics (Computed from current assignments or today's context)
  const stats = useMemo(() => {
    const todayAssignments = assignments.filter((a) => a.assignment_date === todayWib)
    const activeToday = todayAssignments.filter((a) => a.status === 'active')
    const attendedToday = todayAssignments.filter(
      (a) => a.status === 'active' && Boolean(a.today_attendance?.has_attended)
    )
    const distinctOutlets = new Set(todayAssignments.map((a) => a.target_outlet_id)).size

    return {
      activeToday: activeToday.length,
      attendedToday: attendedToday.length,
      totalLoaded: assignments.length,
      distinctOutlets,
    }
  }, [assignments, todayWib])

  // Filtered rows by search query
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments
    const q = searchQuery.toLowerCase()
    return assignments.filter((item) => {
      const name = item.staff?.name?.toLowerCase() || ''
      const nik = item.staff?.phone || ''
      const origin = item.origin_outlet?.name?.toLowerCase() || ''
      const target = item.target_outlet?.name?.toLowerCase() || ''
      const reason = item.reason?.toLowerCase() || ''
      return (
        name.includes(q) ||
        nik.includes(q) ||
        origin.includes(q) ||
        target.includes(q) ||
        reason.includes(q)
      )
    })
  }, [assignments, searchQuery])

  const outletOptions = useMemo(
    () => [
      { label: 'Semua Outlet', value: 'all' },
      ...outlets.map((o) => ({ label: o.name, value: o.id })),
    ],
    [outlets]
  )

  const statusOptions = [
    { label: 'Semua Status', value: 'all' },
    { label: 'Aktif', value: 'active' },
    { label: 'Selesai', value: 'completed' },
    { label: 'Dibatalkan', value: 'cancelled' },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Penugasan Darurat (BKO Sementara)"
        description="Perbantuan kru reguler ke cabang lain selama 1 hari operasional. Akses absensi, kasir, dan bonus harian di outlet darurat aktif otomatis tanpa mengubah profil tetap di Database Karyawan."
        icon={ArrowRightLeft}
      >
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-suka-orange text-white hover:bg-suka-orange/90 text-xs font-bold gap-2 shadow-sm"
        >
          <Plus size={16} /> Buat Penugasan Darurat (BKO)
        </Button>
      </PageHeader>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: BKO Aktif Hari Ini */}
        <div className="rounded-2xl border border-suka-gray-100 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400 block mb-1">
              BKO Aktif Hari Ini
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#4A1713]">
              {stats.activeToday}
            </div>
            <span className="text-[11px] font-medium text-suka-gray-500 mt-1 block">
              Kru diperbantukan
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <ArrowRightLeft size={22} />
          </div>
        </div>

        {/* Card 2: Hadir di Lokasi BKO */}
        <div className="rounded-2xl border border-suka-gray-100 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400 block mb-1">
              Hadir di Lokasi BKO
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stats.attendedToday}
            </div>
            <span className="text-[11px] font-medium text-suka-gray-500 mt-1 block">
              Sudah absen di kiosk
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Card 3: Outlet Terbantu Hari Ini */}
        <div className="rounded-2xl border border-suka-gray-100 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400 block mb-1">
              Cabang Terbantu
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#4A1713]">
              {stats.distinctOutlets}
            </div>
            <span className="text-[11px] font-medium text-suka-gray-500 mt-1 block">
              Menerima bantuan BKO
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 size={22} />
          </div>
        </div>

        {/* Card 4: Total Penugasan Sesuai Filter */}
        <div className="rounded-2xl border border-suka-gray-100 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-400 block mb-1">
              Total Catatan BKO
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#4A1713]">
              {stats.totalLoaded}
            </div>
            <span className="text-[11px] font-medium text-suka-gray-500 mt-1 block">
              Dalam periode filter
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-suka-orange/10 text-suka-orange flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-suka-gray-100 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Date Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-suka-gray-100/80 rounded-xl text-xs font-bold w-fit">
            <button
              type="button"
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'today'
                  ? 'bg-white text-suka-orange shadow-xs'
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'month'
                  ? 'bg-white text-suka-orange shadow-xs'
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('custom')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'custom'
                  ? 'bg-white text-suka-orange shadow-xs'
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              Pilih Tanggal
            </button>
          </div>

          {filterMode === 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-suka-gray-500">Tanggal:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="text-xs rounded-xl border border-suka-gray-200 px-3 py-1.5 outline-none focus:border-suka-orange bg-white text-suka-ink font-semibold"
              />
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-suka-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kru / cabang / alasan..."
              className="w-full text-xs rounded-xl border border-suka-gray-200 pl-9 pr-3 py-2 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange bg-white text-suka-ink"
            />
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-suka-gray-100">
          <div className="w-48">
            <Select
              options={outletOptions}
              value={outletFilter}
              onChange={setOutletFilter}
              placeholder="Filter Outlet"
            />
          </div>

          <div className="w-44">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as any)}
              placeholder="Filter Status"
            />
          </div>

          {(outletFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setOutletFilter('all')
                setStatusFilter('all')
                setSearchQuery('')
              }}
              className="text-xs text-suka-orange hover:underline font-bold px-2 py-1"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <EmergencyTable
        assignments={filteredAssignments}
        isLoading={isLoading}
        onOpenCreateModal={() => setIsModalOpen(true)}
      />

      {/* Modal Penugasan Baru */}
      <EmergencyAssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultDate={filterMode === 'custom' ? customDate : todayWib}
      />
    </div>
  )
}
