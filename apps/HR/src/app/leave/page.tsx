'use client'

import { useState, useMemo } from 'react'
import { Button, Spinner } from '@suka/design-system'
import { CalendarPlus, Download, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { useLeaveRequests } from '@/hooks/useLeaveRequests'
import { useLeaveMutations } from '@/hooks/useLeaveMutations'
import { LeaveRequestForm } from '@/components/modules/LeaveRequestForm'
import { LeaveRequestTable } from '@/components/modules/LeaveRequestTable'
import { LeaveRejectDialog } from '@/components/modules/LeaveRejectDialog'
import { exportCsv } from '@/lib/exportCsv'
import type { LeaveRequest, LeaveStatus } from '@/lib/types'

type Tab = 'all' | LeaveStatus
const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Semua Pengajuan' },
  { key: 'pending', label: 'Menunggu Persetujuan' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

const leaveTypeLabel: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Lainnya',
}

export default function LeavePage() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [showForm, setShowForm] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)

  const { data: allRequests = [], isLoading } = useLeaveRequests()
  const { createRequest, approve, reject } = useLeaveMutations()

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (activeTab === 'all') return allRequests
    return allRequests.filter((r) => r.status === activeTab)
  }, [allRequests, activeTab])

  // Summary counts
  const pendingCount = allRequests.filter((r) => r.status === 'pending').length
  const approvedCount = allRequests.filter((r) => r.status === 'approved').length
  const rejectedCount = allRequests.filter((r) => r.status === 'rejected').length

  function handleCreate(values: {
    staff_id: string
    leave_type: string
    start_date: string
    end_date: string
    days: number
    reason: string
    file?: File | null
  }) {
    createRequest.mutate(values, {
      onSuccess: () => {
        toast.success('Pengajuan cuti/izin berhasil dibuat!')
        setShowForm(false)
      },
      onError: (err: any) => toast.error(err.message || 'Gagal membuat pengajuan'),
    })
  }

  function handleApprove(r: LeaveRequest) {
    const staffName = r.outlet_staff?.name ?? 'karyawan'
    if (!window.confirm(`Setujui permohonan cuti ${staffName} (${r.days} hari)?`)) return
    approve.mutate(
      { id: r.id, staff_id: r.staff_id, days: r.days },
      {
        onSuccess: () => toast.success(`Cuti untuk ${staffName} disetujui`),
        onError: (err: any) => toast.error(err.message || 'Gagal menyetujui'),
      }
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
        onError: (err: any) => toast.error(err.message || 'Gagal menolak cuti'),
      }
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
      mulai: r.start_date,
      selesai: r.end_date,
      durasi: r.days,
      alasan: r.reason ?? '',
      status: r.status,
      sisa_kuota: r.outlet_staff?.leave_quota ?? 0,
    }))

    exportCsv(
      csvRows,
      [
        { key: 'nama', label: 'Nama Staf' },
        { key: 'jenis_cuti', label: 'Jenis Cuti' },
        { key: 'mulai', label: 'Tanggal Mulai' },
        { key: 'selesai', label: 'Tanggal Selesai' },
        { key: 'durasi', label: 'Durasi (Hari)' },
        { key: 'alasan', label: 'Alasan' },
        { key: 'status', label: 'Status' },
        { key: 'sisa_kuota', label: 'Sisa Kuota Cuti' },
      ],
      `Rekap_Cuti_Izin_SukaHR_${new Date().toISOString().split('T')[0]}`
    )
    toast.success('Rekap cuti berhasil di-export ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengajuan &amp; Persetujuan Cuti / Izin"
        description="Kelola hak cuti tahunan, izin darurat, cuti melahirkan, dan verifikasi surat keterangan sakit."
      >
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleExportCsv}
            className="rounded-xl border border-suka-gray-200 gap-1.5 font-bold"
          >
            <Download size={15} /> Export CSV
          </Button>
          <Button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl gap-1.5 font-bold bg-suka-orange hover:bg-suka-orange/90 text-white"
          >
            <CalendarPlus size={16} /> Ajukan Cuti
          </Button>
        </div>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Menunggu Persetujuan</p>
            <p className="text-2xl font-black text-amber-900 mt-0.5">{pendingCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Disetujui</p>
            <p className="text-2xl font-black text-emerald-900 mt-0.5">{approvedCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700 font-bold">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Ditolak</p>
            <p className="text-2xl font-black text-red-900 mt-0.5">{rejectedCount}</p>
          </div>
        </div>
      </div>

      {/* Form (Toggled) */}
      {showForm && (
        <LeaveRequestForm
          onSubmit={handleCreate}
          submitting={createRequest.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Tab Filter */}
      <div className="flex gap-1.5 rounded-2xl bg-white p-1.5 w-fit border border-suka-gray-200 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === t.key
                ? 'bg-suka-brown text-white shadow-xs'
                : 'text-suka-gray-500 hover:text-suka-ink hover:bg-stone-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
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

      {/* Reject Dialog */}
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
