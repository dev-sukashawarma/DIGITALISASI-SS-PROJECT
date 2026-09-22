'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Spinner } from '@suka/design-system'
import {
  CalendarHeart,
  CreditCard,
  CalendarPlus,
  Plus,
  Download,
  Search,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  Banknote,
  TrendingDown,
  FileCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { useLeaveRequests } from '@/hooks/useLeaveRequests'
import { useLeaveMutations } from '@/hooks/useLeaveMutations'
import { useCashAdvances, type CashAdvanceRow } from '@/hooks/useCashAdvances'
import { useCashAdvanceMutations } from '@/hooks/useCashAdvanceMutations'
import { useOutlets } from '@/hooks/useOutlets'
import { LeaveRequestForm } from '@/components/modules/LeaveRequestForm'
import { LeaveRequestTable } from '@/components/modules/LeaveRequestTable'
import { LeaveRejectDialog } from '@/components/modules/LeaveRejectDialog'
import { CashAdvanceTable } from '@/components/modules/CashAdvanceTable'
import { CashAdvanceForm } from '@/components/modules/CashAdvanceForm'
import { exportCsv } from '@/lib/exportCsv'
import { formatRupiah } from '@/lib/format'
import type { LeaveRequest, LeaveStatus, CashAdvanceStatus } from '@/lib/types'

type MainTab = 'izin' | 'kasbon'
type LeaveStatusFilter = 'all' | LeaveStatus
type KasbonStatusFilter = 'all' | CashAdvanceStatus

const leaveTabs: { key: LeaveStatusFilter; label: string }[] = [
  { key: 'all', label: 'Semua Status' },
  { key: 'pending', label: 'Menunggu Persetujuan' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

const kasbonTabs: { key: KasbonStatusFilter; label: string }[] = [
  { key: 'all', label: 'Semua Status' },
  { key: 'pending', label: 'Menunggu Persetujuan' },
  { key: 'active', label: 'Aktif / Berjalan' },
  { key: 'paid_off', label: 'Lunas' },
  { key: 'rejected', label: 'Ditolak' },
]

const leaveTypeLabel: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Lainnya',
}

interface PerizinanModuleProps {
  initialTab?: MainTab
}

export function PerizinanModule({ initialTab = 'izin' }: PerizinanModuleProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<MainTab>(initialTab)

  const handleTabChange = (tab: MainTab) => {
    setActiveTab(tab)
    router.push(`/perizinan/${tab}`)
  }

  // Common filters
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Sub-tab filters
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<LeaveStatusFilter>('all')
  const [kasbonStatusFilter, setKasbonStatusFilter] = useState<KasbonStatusFilter>('all')

  // Modals & States for Izin
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)

  // Modals & States for Kasbon
  const [showKasbonForm, setShowKasbonForm] = useState(false)
  const [payingKasbon, setPayingKasbon] = useState<CashAdvanceRow | null>(null)

  // Data fetching
  const { data: outlets = [] } = useOutlets()
  const { data: allLeaveRequests = [], isLoading: loadingLeaves } = useLeaveRequests()
  const { createRequest: createLeave, approve: approveLeave, reject: rejectLeave } = useLeaveMutations()

  const { data: allKasbon = [], isLoading: loadingKasbon } = useCashAdvances()
  const kasbonMutations = useCashAdvanceMutations()

  // Counters
  const pendingLeavesCount = useMemo(
    () => allLeaveRequests.filter((r) => r.status === 'pending').length,
    [allLeaveRequests]
  )
  const approvedLeavesCount = useMemo(
    () => allLeaveRequests.filter((r) => r.status === 'approved').length,
    [allLeaveRequests]
  )
  const rejectedLeavesCount = useMemo(
    () => allLeaveRequests.filter((r) => r.status === 'rejected').length,
    [allLeaveRequests]
  )

  const pendingKasbonCount = useMemo(
    () => allKasbon.filter((k) => k.status === 'pending').length,
    [allKasbon]
  )
  const activeKasbonCount = useMemo(
    () => allKasbon.filter((k) => k.status === 'active').length,
    [allKasbon]
  )
  const totalKasbonActiveAmount = useMemo(
    () => allKasbon.filter((k) => k.status === 'active').reduce((sum, k) => sum + (k.remaining ?? k.amount), 0),
    [allKasbon]
  )
  const totalKasbonPaidAmount = useMemo(
    () => allKasbon.reduce((sum, k) => sum + (k.amount - (k.remaining ?? k.amount)), 0),
    [allKasbon]
  )

  // Filtered Leave Rows
  const filteredLeaveRows = useMemo(() => {
    return allLeaveRequests.filter((item) => {
      if (leaveStatusFilter !== 'all' && item.status !== leaveStatusFilter) return false
      if (selectedOutlet !== 'all') {
        const staffOutletId = item.outlet_staff?.outlet_id
        if (staffOutletId !== selectedOutlet) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const name = item.outlet_staff?.name?.toLowerCase() || ''
        const reason = item.reason?.toLowerCase() || ''
        const type = (leaveTypeLabel[item.leave_type] || item.leave_type).toLowerCase()
        if (!name.includes(q) && !reason.includes(q) && !type.includes(q)) return false
      }
      return true
    })
  }, [allLeaveRequests, leaveStatusFilter, selectedOutlet, searchQuery])

  // Filtered Kasbon Rows
  const filteredKasbonRows = useMemo(() => {
    return allKasbon.filter((item) => {
      if (kasbonStatusFilter !== 'all' && item.status !== kasbonStatusFilter) return false
      if (selectedOutlet !== 'all') {
        const staffOutletId = item.outlet_staff?.outlet_id
        if (staffOutletId !== selectedOutlet) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const name = item.outlet_staff?.name?.toLowerCase() || ''
        const reason = item.reason?.toLowerCase() || ''
        if (!name.includes(q) && !reason.includes(q)) return false
      }
      return true
    })
  }, [allKasbon, kasbonStatusFilter, selectedOutlet, searchQuery])

  // Leave Handlers
  function handleCreateLeave(values: {
    staff_id: string
    leave_type: string
    start_date: string
    end_date: string
    days: number
    reason: string
    file?: File | null
  }) {
    createLeave.mutate(values, {
      onSuccess: () => {
        toast.success('Pengajuan cuti/izin berhasil dibuat!')
        setShowLeaveForm(false)
      },
      onError: (err: any) => toast.error(err.message || 'Gagal membuat pengajuan cuti/izin'),
    })
  }

  function handleApproveLeave(r: LeaveRequest) {
    const staffName = r.outlet_staff?.name ?? 'karyawan'
    if (!window.confirm(`Setujui permohonan cuti ${staffName} (${r.days} hari)?`)) return
    approveLeave.mutate(
      { id: r.id, staff_id: r.staff_id, days: r.days },
      {
        onSuccess: () => toast.success(`Cuti/izin untuk ${staffName} disetujui`),
        onError: (err: any) => toast.error(err.message || 'Gagal menyetujui'),
      }
    )
  }

  function handleRejectLeave(note: string) {
    if (!rejectTarget) return
    rejectLeave.mutate(
      { id: rejectTarget.id, rejection_note: note },
      {
        onSuccess: () => {
          toast.success('Pengajuan cuti/izin ditolak')
          setRejectTarget(null)
        },
        onError: (err: any) => toast.error(err.message || 'Gagal menolak cuti/izin'),
      }
    )
  }

  function handleExportLeaveCsv() {
    if (filteredLeaveRows.length === 0) {
      toast.error('Tidak ada data izin untuk di-export')
      return
    }
    const exportData = filteredLeaveRows.map((r) => ({
      nama: r.outlet_staff?.name ?? '-',
      jabatan: r.outlet_staff?.role ?? '-',
      cabang: r.outlet_staff?.outlets?.name ?? '-',
      tipe: leaveTypeLabel[r.leave_type] || r.leave_type,
      mulai: r.start_date,
      selesai: r.end_date,
      durasi_hari: r.days,
      alasan: r.reason ?? '-',
      status: r.status,
      tanggal_pengajuan: r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-',
    }))

    exportCsv(
      exportData,
      [
        { key: 'nama', label: 'Nama Staf' },
        { key: 'jabatan', label: 'Jabatan' },
        { key: 'cabang', label: 'Outlet/Cabang' },
        { key: 'tipe', label: 'Tipe Izin/Cuti' },
        { key: 'mulai', label: 'Tgl Mulai' },
        { key: 'selesai', label: 'Tgl Selesai' },
        { key: 'durasi_hari', label: 'Durasi (Hari)' },
        { key: 'alasan', label: 'Alasan' },
        { key: 'status', label: 'Status' },
        { key: 'tanggal_pengajuan', label: 'Tgl Pengajuan' },
      ],
      `Laporan_Perizinan_Cuti_${new Date().toISOString().split('T')[0]}`
    )
    toast.success('Data perizinan & cuti berhasil diunduh')
  }

  // Kasbon Handlers
  const handleCreateKasbon = (values: any) => {
    kasbonMutations.create.mutate(values, {
      onSuccess: () => {
        toast.success('Pengajuan kasbon berhasil dicatat!')
        setShowKasbonForm(false)
      },
      onError: (e: any) => toast.error(e.message || 'Gagal membuat kasbon'),
    })
  }

  const handleAddPayment = (values: any) => {
    if (!payingKasbon) return
    kasbonMutations.addPayment.mutate(
      {
        cash_advance_id: payingKasbon.id,
        amount: Number(values.amount),
        note: values.note ?? null,
        currentRemaining: payingKasbon.remaining,
      },
      {
        onSuccess: () => {
          toast.success('Pembayaran cicilan kasbon berhasil dicatat!')
          setPayingKasbon(null)
        },
        onError: (e: any) => toast.error(e.message || 'Gagal mencatat pembayaran'),
      }
    )
  }

  const handleApproveKasbon = (id: string) => {
    if (!confirm('Setujui pengajuan pinjaman kasbon ini?')) return
    kasbonMutations.approve.mutate(id, {
      onSuccess: () => toast.success('Kasbon disetujui'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  const handleRejectKasbon = (id: string) => {
    if (!confirm('Tolak pengajuan pinjaman kasbon ini?')) return
    kasbonMutations.reject.mutate(id, {
      onSuccess: () => toast.success('Kasbon ditolak'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleExportKasbonCsv() {
    if (filteredKasbonRows.length === 0) {
      toast.error('Tidak ada data kasbon untuk di-export')
      return
    }
    const exportData = filteredKasbonRows.map((k) => ({
      nama: k.outlet_staff?.name ?? '-',
      jabatan: k.outlet_staff?.role ?? '-',
      cabang: k.outlet_staff?.outlets?.name ?? '-',
      nominal: k.amount,
      sisa: k.remaining,
      status: k.status,
      alasan: k.reason ?? '-',
      tanggal_pengajuan: k.created_at ? new Date(k.created_at).toLocaleDateString('id-ID') : '-',
    }))

    exportCsv(
      exportData,
      [
        { key: 'nama', label: 'Nama Staf' },
        { key: 'jabatan', label: 'Jabatan' },
        { key: 'cabang', label: 'Outlet/Cabang' },
        { key: 'nominal', label: 'Nominal Pinjaman' },
        { key: 'sisa', label: 'Sisa Belum Lunas' },
        { key: 'status', label: 'Status' },
        { key: 'alasan', label: 'Alasan' },
        { key: 'tanggal_pengajuan', label: 'Tgl Pengajuan' },
      ],
      `Laporan_Kasbon_Karyawan_${new Date().toISOString().split('T')[0]}`
    )
    toast.success('Data kasbon karyawan berhasil diunduh')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeTab === 'izin' ? 'Perizinan & Cuti Karyawan' : 'Kasbon & Pinjaman Staf'}
        description={
          activeTab === 'izin'
            ? 'Kelola pengajuan perizinan kerja, sakit, cuti tahunan, dan persetujuan HR.'
            : 'Kelola permohonan pinjaman kasbon, persetujuan, dan pencatatan cicilan pelunasan staf.'
        }
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-suka-brown border border-suka-orange/20 text-xs font-bold shadow-2xs">
          <FileCheck size={14} className="text-suka-orange" />
          <span>Alur Persetujuan HR Terpadu</span>
        </div>
      </PageHeader>

      {/* Main Mode Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-suka-gray-200 pb-3">
        <button
          type="button"
          onClick={() => handleTabChange('izin')}
          className={`flex items-center gap-2 px-5 py-2.5 font-extrabold text-sm rounded-xl transition-all cursor-pointer ${
            activeTab === 'izin'
              ? 'bg-suka-brown text-white shadow-md'
              : 'bg-white text-suka-brown border border-suka-gray-200 hover:bg-suka-cream'
          }`}
        >
          <CalendarHeart size={16} className={activeTab === 'izin' ? 'text-suka-orange' : 'text-suka-gray-400'} />
          <span>Izin &amp; Cuti</span>
          {pendingLeavesCount > 0 && (
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded-full transition-colors ${
                activeTab === 'izin'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              {pendingLeavesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('kasbon')}
          className={`flex items-center gap-2 px-5 py-2.5 font-extrabold text-sm rounded-xl transition-all cursor-pointer ${
            activeTab === 'kasbon'
              ? 'bg-suka-brown text-white shadow-md'
              : 'bg-white text-suka-brown border border-suka-gray-200 hover:bg-suka-cream'
          }`}
        >
          <CreditCard size={16} className={activeTab === 'kasbon' ? 'text-suka-orange' : 'text-suka-gray-400'} />
          <span>Kasbon &amp; Pinjaman</span>
          {pendingKasbonCount > 0 && (
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded-full transition-colors ${
                activeTab === 'kasbon'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              {pendingKasbonCount}
            </span>
          )}
        </button>
      </div>

      {/* Shared Filter Bar (Outlet & Search) */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Outlet Selector */}
          <div className="flex items-center gap-2 bg-suka-gray-50 px-3 py-1.5 rounded-xl border border-suka-gray-200 text-xs font-bold text-suka-ink w-full sm:w-auto">
            <Building2 size={15} className="text-suka-orange shrink-0" />
            <span className="text-suka-gray-500 text-[11px] uppercase tracking-wider shrink-0">Outlet:</span>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              aria-label="Pilih Outlet"
              className="bg-transparent border-0 outline-none font-bold text-suka-ink cursor-pointer pr-2 text-xs flex-1"
            >
              <option value="all">Semua Outlet / Cabang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama staf atau alasan..."
              className="w-full pl-8 pr-3 py-1.5 bg-suka-gray-50 border border-suka-gray-200 rounded-xl text-xs font-semibold text-suka-ink outline-none focus:border-suka-orange focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Action Buttons for current tab */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {activeTab === 'izin' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportLeaveCsv}
                className="text-xs font-bold rounded-xl flex items-center gap-1.5 px-3 py-2 border-suka-gray-200 text-suka-ink hover:bg-suka-gray-50"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </Button>
              <Button
                type="button"
                onClick={() => setShowLeaveForm(true)}
                className="bg-suka-orange hover:bg-suka-orange/90 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 px-3.5 py-2 shadow-sm"
              >
                <CalendarPlus size={14} />
                <span>Ajukan Cuti/Izin</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportKasbonCsv}
                className="text-xs font-bold rounded-xl flex items-center gap-1.5 px-3 py-2 border-suka-gray-200 text-suka-ink hover:bg-suka-gray-50"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </Button>
              <Button
                type="button"
                onClick={() => setShowKasbonForm(true)}
                className="bg-suka-orange hover:bg-suka-orange/90 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 px-3.5 py-2 shadow-sm"
              >
                <Plus size={14} />
                <span>Tambah Kasbon</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: IZIN & CUTI */}
      {activeTab === 'izin' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center shrink-0 border border-orange-100">
                <CalendarHeart size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Total Pengajuan</p>
                <p className="text-xl font-black text-suka-ink mt-0.5">{allLeaveRequests.length}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Menunggu HR</p>
                <p className="text-xl font-black text-amber-900 mt-0.5">{pendingLeavesCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Disetujui</p>
                <p className="text-xl font-black text-emerald-900 mt-0.5">{approvedLeavesCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/20 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <XCircle size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Ditolak</p>
                <p className="text-xl font-black text-red-900 mt-0.5">{rejectedLeavesCount}</p>
              </div>
            </div>
          </div>

          {/* Sub Status Tabs */}
          <div className="flex gap-2 border-b border-suka-gray-200 pb-2 overflow-x-auto">
            {leaveTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setLeaveStatusFilter(t.key)}
                className={`px-3.5 py-1.5 font-bold text-xs rounded-lg transition-all cursor-pointer shrink-0 ${
                  leaveStatusFilter === t.key
                    ? 'bg-suka-orange text-white shadow-xs'
                    : 'bg-white text-suka-gray-600 border border-suka-gray-200 hover:bg-stone-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loadingLeaves ? (
            <div className="flex justify-center p-12 bg-white rounded-2xl border border-suka-gray-200">
              <Spinner />
            </div>
          ) : (
            <LeaveRequestTable
              rows={filteredLeaveRows}
              onApprove={handleApproveLeave}
              onReject={(r) => setRejectTarget(r)}
            />
          )}

          {/* Form Modal */}
          {showLeaveForm && (
            <LeaveRequestForm
              onSubmit={handleCreateLeave}
              submitting={createLeave.isPending}
              onCancel={() => setShowLeaveForm(false)}
            />
          )}

          {/* Reject Dialog */}
          {rejectTarget && (
            <LeaveRejectDialog
              staffName={rejectTarget.outlet_staff?.name || 'Karyawan'}
              submitting={rejectLeave.isPending}
              onSubmit={handleRejectLeave}
              onClose={() => setRejectTarget(null)}
            />
          )}
        </div>
      )}

      {/* TAB 2: KASBON & PINJAMAN */}
      {activeTab === 'kasbon' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Banknote size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Pinjaman Aktif</p>
                <p className="text-xl font-black text-suka-ink mt-0.5">{activeKasbonCount} Staf</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Menunggu HR</p>
                <p className="text-xl font-black text-amber-900 mt-0.5">{pendingKasbonCount} Staf</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-orange-200 bg-orange-50/20 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center shrink-0 border border-orange-200">
                <TrendingDown size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-suka-brown uppercase tracking-wider">Sisa Belum Lunas</p>
                <p className="text-base sm:text-lg font-black text-suka-ink mt-0.5">
                  {formatRupiah(totalKasbonActiveAmount)}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Terbayar</p>
                <p className="text-base sm:text-lg font-black text-emerald-800 mt-0.5">
                  {formatRupiah(totalKasbonPaidAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Sub Status Tabs */}
          <div className="flex gap-2 border-b border-suka-gray-200 pb-2 overflow-x-auto">
            {kasbonTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setKasbonStatusFilter(t.key)}
                className={`px-3.5 py-1.5 font-bold text-xs rounded-lg transition-all cursor-pointer shrink-0 ${
                  kasbonStatusFilter === t.key
                    ? 'bg-suka-orange text-white shadow-xs'
                    : 'bg-white text-suka-gray-600 border border-suka-gray-200 hover:bg-stone-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loadingKasbon ? (
            <div className="flex justify-center p-12 bg-white rounded-2xl border border-suka-gray-200">
              <Spinner />
            </div>
          ) : (
            <CashAdvanceTable
              rows={filteredKasbonRows}
              onAddPayment={setPayingKasbon}
              onApprove={handleApproveKasbon}
              onReject={handleRejectKasbon}
            />
          )}

          {/* Create Kasbon Modal */}
          {showKasbonForm && (
            <CashAdvanceForm
              mode="kasbon"
              onSubmit={handleCreateKasbon}
              submitting={kasbonMutations.create.isPending}
              onCancel={() => setShowKasbonForm(false)}
            />
          )}

          {/* Pay Installment Modal */}
          {payingKasbon && (
            <CashAdvanceForm
              mode="payment"
              maxAmount={payingKasbon.remaining}
              onSubmit={handleAddPayment}
              submitting={kasbonMutations.addPayment.isPending}
              onCancel={() => setPayingKasbon(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
