'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { Button, Spinner } from '@suka/design-system'
import { CalendarPlus, Download, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useLeaveRequests } from '@/hooks/useLeaveRequests'
import { useLeaveMutations } from '@/hooks/useLeaveMutations'
import { LeaveRequestForm } from '@/components/LeaveRequestForm'
import { LeaveRequestTable } from '@/components/LeaveRequestTable'
import { LeaveRejectDialog } from '@/components/LeaveRejectDialog'
import { exportCsv } from '@/lib/exportCsv'
import type { LeaveRequest, LeaveStatus } from '@/lib/types'

type Tab = 'all' | LeaveStatus
const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

const leaveTypeLabel: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Lainnya',
}

function formatDateDDMMYYYY(dateStr: string): string {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function LeavePage() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [showForm, setShowForm] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)

  const { data: allRequests = [], isLoading } = useLeaveRequests()
  const { createRequest, approve, reject } = useLeaveMutations()

  // Filtered rows based on tab
  const filteredRows = useMemo(() => {
    if (activeTab === 'all') return allRequests
    return allRequests.filter((r) => r.status === activeTab)
  }, [allRequests, activeTab])

  // Summary counts
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const pendingCount = allRequests.filter((r) => r.status === 'pending').length
  const approvedThisMonth = allRequests.filter((r) => {
    if (r.status !== 'approved' || !r.approved_at) return false
    const d = new Date(r.approved_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length
  const rejectedThisMonth = allRequests.filter((r) => {
    if (r.status !== 'rejected') return false
    const d = new Date(r.created_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  // Handlers
  function handleCreate(values: {
    staff_id: string
    leave_type: string
    start_date: string
    end_date: string
    days: number
    reason: string
  }) {
    createRequest.mutate(values, {
      onSuccess: () => {
        toast.success('Pengajuan cuti berhasil dibuat')
        setShowForm(false)
      },
      onError: (err: Error) => toast.error(err.message || 'Gagal membuat pengajuan'),
    })
  }

  function handleApprove(r: LeaveRequest) {
    const staffName = r.outlet_staff?.name ?? 'karyawan'
    if (!window.confirm(`Setujui cuti ${staffName} selama ${r.days} hari?`)) return
    approve.mutate(
      { id: r.id, staff_id: r.staff_id, days: r.days },
      {
        onSuccess: () => toast.success(`Cuti ${staffName} disetujui`),
        onError: (err: Error) => toast.error(err.message || 'Gagal menyetujui'),
      },
    )
  }

  function handleReject(note: string) {
    if (!rejectTarget) return
    reject.mutate(
      { id: rejectTarget.id, rejection_note: note },
      {
        onSuccess: () => {
          toast.success('Pengajuan cuti ditolak')
          setRejectTarget(null)
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal menolak'),
      },
    )
  }

  function handleExportCsv() {
    if (filteredRows.length === 0) {
      toast.error('Tidak ada data untuk di-export')
      return
    }

    const csvRows = filteredRows.map((r) => ({
      nama: r.outlet_staff?.name ?? '-',
      jenis_cuti: leaveTypeLabel[r.leave_type] ?? r.leave_type,
      tanggal_mulai: formatDateDDMMYYYY(r.start_date),
      tanggal_selesai: formatDateDDMMYYYY(r.end_date),
      durasi: r.days,
      alasan: r.reason ?? '',
      status: r.status,
      sisa_kuota: r.outlet_staff?.leave_quota ?? 0,
    }))

    exportCsv(
      csvRows,
      [
        { key: 'nama', label: 'Nama' },
        { key: 'jenis_cuti', label: 'Jenis Cuti' },
        { key: 'tanggal_mulai', label: 'Tanggal Mulai' },
        { key: 'tanggal_selesai', label: 'Tanggal Selesai' },
        { key: 'durasi', label: 'Durasi (hari)' },
        { key: 'alasan', label: 'Alasan' },
        { key: 'status', label: 'Status' },
        { key: 'sisa_kuota', label: 'Sisa Kuota' },
      ],
      `cuti-izin-${new Date().toISOString().slice(0, 10)}`,
    )
    toast.success('CSV berhasil di-export')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-suka-ink">Cuti &amp; Izin</h1>
          <p className="text-sm text-suka-gray-500">Kelola pengajuan cuti dan izin karyawan.</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleExportCsv}
            className="rounded-xl border border-suka-gray-200 gap-1.5"
          >
            <Download size={16} /> Export CSV
          </Button>
          <Button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl gap-1.5"
          >
            <CalendarPlus size={16} /> Ajukan Cuti
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Menunggu</p>
            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Disetujui Bulan Ini</p>
            <p className="text-2xl font-bold text-emerald-700">{approvedThisMonth}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <XCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Ditolak Bulan Ini</p>
            <p className="text-2xl font-bold text-red-700">{rejectedThisMonth}</p>
          </div>
        </div>
      </div>

      {/* Form (toggled) */}
      {showForm && (
        <LeaveRequestForm
          onSubmit={handleCreate}
          submitting={createRequest.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Tab filter */}
      <div className="flex gap-1 rounded-xl bg-suka-gray-50 p-1 w-fit border border-suka-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-white text-suka-ink shadow-sm'
                : 'text-gray-500 hover:text-suka-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table or loading */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <LeaveRequestTable
          rows={filteredRows}
          onApprove={handleApprove}
          onReject={(r) => setRejectTarget(r)}
        />
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <LeaveRejectDialog
          staffName={rejectTarget.outlet_staff?.name ?? '-'}
          onSubmit={handleReject}
          onClose={() => setRejectTarget(null)}
          submitting={reject.isPending}
        />
      )}
    </div>
  )
}
