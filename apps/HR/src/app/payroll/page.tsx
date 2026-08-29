'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Download, Plus, DollarSign, Users, CreditCard, MessageSquare, Zap } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePayroll } from '@/hooks/usePayroll'
import { usePayrollMutations } from '@/hooks/usePayrollMutations'
import { useCashAdvances } from '@/hooks/useCashAdvances'
import { useCashAdvanceMutations } from '@/hooks/useCashAdvanceMutations'
import { PayrollTable } from '@/components/modules/PayrollTable'
import { PayrollSlipForm } from '@/components/modules/PayrollSlipForm'
import { CashAdvanceTable } from '@/components/modules/CashAdvanceTable'
import { CashAdvanceForm } from '@/components/modules/CashAdvanceForm'
import { BulkWAModal } from '@/components/modules/BulkWAModal'
import { formatRupiah } from '@/lib/format'
import { exportCsv } from '@/lib/exportCsv'
import type { PayrollRecord } from '@/lib/types'
import type { CashAdvanceRow } from '@/hooks/useCashAdvances'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<'payroll' | 'kasbon'>('payroll')

  // Payroll states
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [editingSlip, setEditingSlip] = useState<PayrollRecord | null>(null)
  const [showBulkWAModal, setShowBulkWAModal] = useState(false)

  // Kasbon states
  const [showKasbonForm, setShowKasbonForm] = useState(false)
  const [payingKasbon, setPayingKasbon] = useState<CashAdvanceRow | null>(null)

  // Hooks
  const { data: payrollData = [], isLoading: loadingPayroll } = usePayroll(month, year)
  const payrollMutations = usePayrollMutations()

  const { data: kasbonData = [], isLoading: loadingKasbon } = useCashAdvances()
  const kasbonMutations = useCashAdvanceMutations()

  // Payroll Actions
  const handleGenerate = () => {
    if (!confirm(`Generate slip gaji untuk semua staf aktif periode ${MONTHS[month - 1]} ${year}?`)) return

    payrollMutations.generate.mutate(
      { month, year },
      {
        onSuccess: (count) =>
          toast.success(
            `Berhasil membuat ${count} slip gaji (Denda keterlambatan Rp 1.000/menit otomatis terkalkulasi)`
          ),
        onError: (e: any) => toast.error(e.message || 'Gagal generate slip'),
      }
    )
  }

  const handleSyncAttendance = () => {
    payrollMutations.syncAttendanceDeductions.mutate(
      { month, year },
      {
        onSuccess: (count) =>
          toast.success(
            `Berhasil menyinkronkan denda keterlambatan absensi otomatis (Rp 1.000/mnt) untuk ${count} slip gaji!`
          ),
        onError: (e: any) => toast.error(e.message || 'Gagal menyinkronkan absensi'),
      }
    )
  }

  const handleFinalize = () => {
    if (!confirm(`Finalize semua slip? Slip yang sudah final tidak bisa diedit.`)) return

    payrollMutations.finalizeAll.mutate(
      { month, year },
      {
        onSuccess: () => toast.success(`Semua slip gaji berhasil di-finalize`),
        onError: (e: any) => toast.error(e.message || 'Gagal finalize slip'),
      }
    )
  }

  const handleUpdateSlip = (values: any) => {
    if (!editingSlip) return
    payrollMutations.updateSlip.mutate(values, {
      onSuccess: () => {
        toast.success(`Slip gaji ${editingSlip.outlet_staff?.name} berhasil diperbarui`)
        setEditingSlip(null)
      },
      onError: (e: any) => toast.error(e.message || 'Gagal memperbarui slip'),
    })
  }

  const handleExportPayroll = () => {
    if (!payrollData.length) {
      toast.error('Tidak ada data payroll untuk diexport')
      return
    }

    const rows = payrollData.map((r) => ({
      Nama: r.outlet_staff?.name || '-',
      Role: r.outlet_staff?.role || '-',
      Outlet: r.outlet_staff?.outlets?.name || 'Pusat',
      Periode: `${r.period_month}/${r.period_year}`,
      'Gaji Pokok': r.basic_salary,
      'Tunjangan Jabatan': r.allowance_position,
      'Tunjangan Hadir': r.allowance_presence,
      Bonus: r.bonus,
      'Catatan Bonus': r.bonus_note || '-',
      Potongan: r.deductions,
      'Catatan Potongan': r.deduction_note || '-',
      'Total Gaji Bersih': r.total_salary,
      Status: r.status,
    }))

    exportCsv(
      rows,
      Object.keys(rows[0]).map((k) => ({ key: k as any, label: k })),
      `Payroll_SukaHR_${MONTHS[month - 1]}_${year}`
    )
    toast.success('Data payroll berhasil diexport ke CSV')
  }

  // Kasbon Actions
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
    if (!confirm('Setujui pengajuan kasbon ini?')) return
    kasbonMutations.approve.mutate(id, {
      onSuccess: () => toast.success('Kasbon disetujui'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  const handleRejectKasbon = (id: string) => {
    if (!confirm('Tolak pengajuan kasbon ini?')) return
    kasbonMutations.reject.mutate(id, {
      onSuccess: () => toast.success('Kasbon ditolak'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penggajian (Payroll) &amp; Kasbon"
        description="Kalkulasi gaji otomatis, cetak slip resmi A5, pengiriman slip via WhatsApp (WAHA), dan cicilan kasbon."
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Live Realtime Sync Aktif</span>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-suka-gray-200 pb-3">
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer ${
            activeTab === 'payroll'
              ? 'bg-suka-brown text-white shadow-md'
              : 'bg-white text-suka-brown border border-suka-gray-200 hover:bg-suka-cream'
          }`}
        >
          Slip Gaji Karyawan
        </button>
        <button
          onClick={() => setActiveTab('kasbon')}
          className={`px-4 py-2 font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer ${
            activeTab === 'kasbon'
              ? 'bg-suka-brown text-white shadow-md'
              : 'bg-white text-suka-brown border border-suka-gray-200 hover:bg-suka-cream'
          }`}
        >
          Kasbon &amp; Pinjaman
        </button>
      </div>

      {activeTab === 'payroll' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-suka-orange bg-white text-suka-ink"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-bold font-mono outline-none focus:border-suka-orange bg-white text-suka-ink"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                onClick={() => {
                  if (payrollData.length === 0) {
                    toast.error('Belum ada slip gaji untuk dikirim. Klik "Generate Slip" terlebih dahulu.')
                    return
                  }
                  setShowBulkWAModal(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                <MessageSquare size={15} />
                <span>Kirim Massal WhatsApp (WAHA)</span>
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={payrollMutations.generate.isPending}
                className="bg-suka-orange hover:bg-suka-orange/90 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                {payrollMutations.generate.isPending ? <Spinner size={16} /> : 'Generate Slip'}
              </Button>
              <Button
                type="button"
                onClick={handleSyncAttendance}
                disabled={payrollMutations.syncAttendanceDeductions.isPending || payrollData.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                title="Hitung ulang denda keterlambatan absensi otomatis (Rp 1.000/menit) untuk seluruh slip draft"
              >
                {payrollMutations.syncAttendanceDeductions.isPending ? (
                  <Spinner size={16} />
                ) : (
                  <>
                    <Zap size={14} />
                    <span>Sinkron Absensi (Auto)</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleFinalize}
                disabled={payrollMutations.finalizeAll.isPending}
                className="bg-suka-brown hover:bg-suka-brown/90 text-white font-bold rounded-xl text-xs"
              >
                {payrollMutations.finalizeAll.isPending ? <Spinner size={16} /> : 'Finalize Semua'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleExportPayroll}
                className="border border-suka-gray-200 font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Download size={14} /> Export CSV
              </Button>
            </div>
          </div>

          {/* Summaries */}
          {payrollData.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center font-bold">
                  <DollarSign size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase">Total Gaji Bulan Ini</p>
                  <p className="text-xl font-black text-suka-ink mt-0.5">
                    {formatRupiah(payrollData.reduce((acc, r) => acc + r.total_salary, 0))}
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase">Rata-rata Gaji</p>
                  <p className="text-xl font-black text-suka-ink mt-0.5">
                    {formatRupiah(
                      payrollData.length
                        ? payrollData.reduce((acc, r) => acc + r.total_salary, 0) / payrollData.length
                        : 0
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Users size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-800 uppercase">Jumlah Staf</p>
                  <p className="text-xl font-black text-emerald-900 mt-0.5">{payrollData.length} Orang</p>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          {loadingPayroll ? (
            <div className="flex justify-center p-12">
              <Spinner />
            </div>
          ) : (
            <PayrollTable rows={payrollData} onEdit={setEditingSlip} />
          )}

          {/* Edit Slip Form Modal */}
          {editingSlip && (
            <PayrollSlipForm
              record={editingSlip}
              onSubmit={handleUpdateSlip}
              submitting={payrollMutations.updateSlip.isPending}
              onCancel={() => setEditingSlip(null)}
            />
          )}

          {/* Bulk WhatsApp Modal */}
          {showBulkWAModal && (
            <BulkWAModal
              records={payrollData}
              month={month}
              year={year}
              onClose={() => setShowBulkWAModal(false)}
            />
          )}
        </div>
      )}

      {activeTab === 'kasbon' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
            <div>
              <h3 className="font-extrabold text-suka-brown text-sm">Pinjaman Kasbon Staf</h3>
              <p className="text-xs text-suka-gray-500">Kelola batas kasbon, persetujuan pinjaman, dan cicilan potongan gaji.</p>
            </div>
            <Button
              type="button"
              onClick={() => setShowKasbonForm(true)}
              className="bg-suka-orange hover:bg-suka-orange/90 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
            >
              <Plus size={15} /> Tambah Kasbon
            </Button>
          </div>

          {loadingKasbon ? (
            <div className="flex justify-center p-12">
              <Spinner />
            </div>
          ) : (
            <CashAdvanceTable
              rows={kasbonData}
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
