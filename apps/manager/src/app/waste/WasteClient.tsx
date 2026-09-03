'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Trash2,
  CheckSquare,
  BarChart3,
  Building2,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useApprovals } from '../../lib/ApprovalsContext'
import PendingWasteTab from './PendingWasteTab'
import WasteHistoryTab from './WasteHistoryTab'
import {
  getPendingWasteReports,
  getWasteHistory,
  getWasteSummary,
  processWasteApproval,
  type PendingWasteItem,
  type WasteHistoryItem,
  type WasteSummaryData,
  type OutletOption,
} from '../actions/waste'

interface WasteClientProps {
  initialPendingReports: PendingWasteItem[]
  initialHistory: {
    data: WasteHistoryItem[]
    totalCount: number
    page: number
    totalPages: number
  }
  initialSummary: WasteSummaryData
  accessibleOutlets: OutletOption[]
  staffRole: string
  staffName: string
  isAllOutlets: boolean
}

export default function WasteClient({
  initialPendingReports,
  initialHistory,
  initialSummary,
  accessibleOutlets,
  staffRole,
  staffName,
  isAllOutlets,
}: WasteClientProps) {
  const { refreshWasteCount } = useApprovals()

  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [selectedOutletId, setSelectedOutletId] = useState<string>('all')

  // Date range defaults to today
  const todayStr = new Date().toISOString().split('T')[0]
  const [dateRange, setDateRange] = useState({ from: todayStr, to: todayStr })
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Data states
  const [pendingItems, setPendingItems] = useState<PendingWasteItem[]>(initialPendingReports)
  const [historyItems, setHistoryItems] = useState<WasteHistoryItem[]>(initialHistory.data)
  const [summary, setSummary] = useState<WasteSummaryData>(initialSummary)
  const [totalCount, setTotalCount] = useState<number>(initialHistory.totalCount)
  const [totalPages, setTotalPages] = useState<number>(initialHistory.totalPages)

  // Loading states
  const [loadingPending, setLoadingPending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch pending reports
  const fetchPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const res = await getPendingWasteReports(selectedOutletId)
      if (res.success && res.data) {
        setPendingItems(res.data)
      } else if (res.error) {
        toast.error(res.error)
      }
    } finally {
      setLoadingPending(false)
    }
  }, [selectedOutletId])

  // Fetch history and summary
  const fetchHistoryAndSummary = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const [histRes, sumRes] = await Promise.all([
        getWasteHistory({
          from: dateRange.from,
          to: dateRange.to,
          outletId: selectedOutletId,
          status: statusFilter,
          page,
          limit: 20,
        }),
        getWasteSummary({
          from: dateRange.from,
          to: dateRange.to,
          outletId: selectedOutletId,
        }),
      ])

      if (histRes.success && histRes.data) {
        setHistoryItems(histRes.data)
        setTotalCount(histRes.totalCount)
        setTotalPages(histRes.totalPages)
      }

      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data)
      }
    } finally {
      setLoadingHistory(false)
    }
  }, [dateRange, selectedOutletId, statusFilter, page])

  // Refetch when filters change
  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  useEffect(() => {
    fetchHistoryAndSummary()
  }, [fetchHistoryAndSummary])

  // Manual refresh all
  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    await Promise.all([fetchPending(), fetchHistoryAndSummary(), refreshWasteCount()])
    setIsRefreshing(false)
    toast.success('Data waste berhasil diperbarui')
  }

  // Approve action
  const handleApprove = async (id: string) => {
    const res = await processWasteApproval(id, 'approve')
    if (res.success) {
      toast.success('Laporan waste berhasil disetujui! Stok otomatis terpotong.')
      // Optimistic update
      setPendingItems((prev) => prev.filter((item) => item.id !== id))
      fetchPending()
      fetchHistoryAndSummary()
      refreshWasteCount()
    } else {
      toast.error(res.error || 'Gagal menyetujui laporan waste')
    }
  }

  // Reject action
  const handleReject = async (id: string, reason: string) => {
    const res = await processWasteApproval(id, 'reject', reason)
    if (res.success) {
      toast.success('Laporan waste berhasil ditolak.')
      setPendingItems((prev) => prev.filter((item) => item.id !== id))
      fetchPending()
      fetchHistoryAndSummary()
      refreshWasteCount()
    } else {
      toast.error(res.error || 'Gagal menolak laporan waste')
    }
  }

  const roleLabel =
    staffRole === 'area_manager'
      ? 'Area Manager (AM)'
      : staffRole === 'regional_manager'
      ? 'Regional Manager (RM)'
      : staffRole.toUpperCase()

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-suka-brown/10 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-suka-orange/10 text-suka-orange flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-suka-brown tracking-tight">
                Pengawasan Waste Stok
              </h1>
              <p className="text-xs font-bold text-suka-gray-400 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Wewenang: <strong className="text-suka-orange">{roleLabel}</strong></span>
                {isAllOutlets ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-black">
                    Akses Seluruh Outlet
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-black">
                    {accessibleOutlets.length} Outlet Binaan
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Outlet Filter & Refresh */}
        <div className="flex items-center gap-2.5">
          {/* Dropdown Filter Outlet */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-suka-gray-400 shrink-0" />
            <select
              value={selectedOutletId}
              onChange={(e) => {
                setSelectedOutletId(e.target.value)
                setPage(1)
              }}
              className="text-xs py-2 px-3 rounded-2xl border border-suka-brown/20 bg-suka-gray-50 text-suka-brown font-bold focus:outline-none focus:border-suka-orange cursor-pointer max-w-[200px] sm:max-w-[260px] truncate"
            >
              <option value="all">
                {isAllOutlets ? 'Semua Outlet Aktif' : 'Semua Outlet Binaan Saya'}
              </option>
              {accessibleOutlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-2xl border border-suka-brown/15 bg-white flex items-center justify-center text-suka-brown hover:bg-suka-cream transition-colors cursor-pointer shrink-0"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-suka-orange' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-suka-brown/10 pb-1">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
            tab === 'pending'
              ? 'bg-suka-orange text-white shadow-sm shadow-suka-orange/20 scale-[1.02]'
              : 'text-suka-brown/70 hover:bg-white hover:text-suka-brown'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Menunggu Persetujuan</span>
          {pendingItems.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                tab === 'pending'
                  ? 'bg-white text-suka-orange'
                  : 'bg-red-500 text-white'
              }`}
            >
              {pendingItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
            tab === 'history'
              ? 'bg-suka-orange text-white shadow-sm shadow-suka-orange/20 scale-[1.02]'
              : 'text-suka-brown/70 hover:bg-white hover:text-suka-brown'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Riwayat & Analitik Data</span>
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'pending' ? (
        <PendingWasteTab
          items={pendingItems}
          loading={loadingPending}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ) : (
        <WasteHistoryTab
          summary={summary}
          historyItems={historyItems}
          loading={loadingHistory}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          statusFilter={statusFilter}
          onStatusFilterChange={(s) => {
            setStatusFilter(s)
            setPage(1)
          }}
          dateRange={dateRange}
          onDateRangeChange={(r) => {
            setDateRange(r)
            setPage(1)
          }}
        />
      )}
    </div>
  )
}
