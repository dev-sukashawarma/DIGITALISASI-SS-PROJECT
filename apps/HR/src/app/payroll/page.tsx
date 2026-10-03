'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Download, DollarSign, Users, CreditCard, MessageSquare, Zap, ArrowRight, RefreshCw, Banknote, Sparkles, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { usePayroll } from '@/hooks/usePayroll'
import { useOutlets } from '@/hooks/useOutlets'
import { usePayrollMutations } from '@/hooks/usePayrollMutations'
import { PayrollTable } from '@/components/modules/PayrollTable'
import { PayrollSlipForm } from '@/components/modules/PayrollSlipForm'
import { BulkWAModal } from '@/components/modules/BulkWAModal'
import { formatRupiah } from '@/lib/format'
import { exportCsv } from '@/lib/exportCsv'
import { getPayrollBreakdown } from '@/lib/payrollBreakdown'
import { isRendyOrDeveloperStaff, KANTOR_PUSAT_ID } from '@/lib/staffFilters'
import type { PayrollRecord } from '@/lib/types'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function PayrollPage() {
  // Payroll states
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [editingSlip, setEditingSlip] = useState<PayrollRecord | null>(null)
  const [showBulkWAModal, setShowBulkWAModal] = useState(false)

  const monthOptions = useMemo(
    () => MONTHS.map((m, i) => ({ label: m, value: String(i + 1) })),
    []
  )

  // Hooks
  const { data: payrollData = [], isLoading: loadingPayroll } = usePayroll(month, year)
  const { data: outlets = [] } = useOutlets()
  const payrollMutations = usePayrollMutations()

  // Outlet Filter Options
  const outletOptions = useMemo(() => {
    const list = [{ label: 'Semua Outlet', value: '' }]
    const hasPusat = outlets.some((o) => o.id === KANTOR_PUSAT_ID)
    if (!hasPusat) {
      list.push({ label: 'KANTOR PUSAT', value: KANTOR_PUSAT_ID })
    }
    outlets.forEach((o) => {
      list.push({ label: o.name, value: o.id })
    })
    return list
  }, [outlets])

  // Filtered Payroll Data by Outlet
  const filteredPayrollData = useMemo(() => {
    if (!selectedOutlet) return payrollData

    return payrollData.filter((r) => {
      const staff = r.outlet_staff
      if (!staff) return false

      if (isRendyOrDeveloperStaff(staff as any)) {
        return (
          selectedOutlet === KANTOR_PUSAT_ID ||
          staff.outlet_id === selectedOutlet
        )
      }

      if (selectedOutlet === KANTOR_PUSAT_ID) {
        return (
          staff.outlet_id === KANTOR_PUSAT_ID ||
          staff.outlets?.name?.toLowerCase().includes('pusat') ||
          staff.role === 'staff_pusat' ||
          staff.role === 'developer'
        )
      }

      const targetOutlet = outlets.find((o) => o.id === selectedOutlet)
      if (staff.outlet_id === selectedOutlet) return true
      if (targetOutlet && staff.outlets?.name && staff.outlets.name.toLowerCase() === targetOutlet.name.toLowerCase()) {
        return true
      }

      return false
    })
  }, [payrollData, selectedOutlet, outlets])

  // Summary Totals for Cards
  const summaryTotals = useMemo(() => {
    let totalGajiPokok = 0
    let totalBonus = 0
    let totalKeseluruhan = 0

    filteredPayrollData.forEach((r) => {
      const b = getPayrollBreakdown(r)
      totalGajiPokok += b.basicSalary
      const bonus = (b.overtime + b.salesBonus) > 0 ? (b.overtime + b.salesBonus) : (Number(r.bonus) || 0)
      totalBonus += bonus
      totalKeseluruhan += b.takeHomePay
    })

    return {
      totalGajiPokok,
      totalBonus,
      totalKeseluruhan,
      staffCount: filteredPayrollData.length,
    }
  }, [filteredPayrollData])

  const hasSlips = payrollData.length > 0
  const isAllFinalized = hasSlips && payrollData.every((r) => r.status === 'finalized')
  const hasDrafts = hasSlips && payrollData.some((r) => r.status === 'draft')

  // Payroll Actions
  const handleGenerate = () => {
    if (!confirm(`Generate slip gaji untuk semua staf aktif periode ${MONTHS[month - 1]} ${year}?`)) return

    payrollMutations.generate.mutate(
      { month, year },
      {
        onSuccess: (count) =>
          toast.success(
            `Berhasil membuat ${count} slip gaji (Bonus Penjualan & Denda Telat otomatis terkalkulasi)`
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
            `Berhasil menyinkronkan denda absensi dan bonus penjualan otomatis untuk ${count} slip gaji draft!`
          ),
        onError: (e: any) => toast.error(e.message || 'Gagal menyinkronkan data otomatis'),
      }
    )
  }

  const handleSyncSalary = (forceAll: boolean = true) => {
    const msg = `Sync SEMUA gaji pokok & tunjangan dari Database Karyawan ke seluruh slip draft ${MONTHS[month - 1]} ${year}? (Bonus, lembur, dan kasbon yang sudah dihitung akan tetap dipertahankan)`
    if (!confirm(msg)) return

    payrollMutations.syncSalaryFromDatabase.mutate(
      { month, year, forceAll },
      {
        onSuccess: ({ updatedCount, skippedCount }) => {
          if (updatedCount === 0) {
            toast.info(`Tidak ada slip yang perlu diupdate${skippedCount > 0 ? ` (${skippedCount} tidak ditemukan di Database Karyawan)` : ''}`)
          } else {
            toast.success(
              `Berhasil update gaji pokok ${updatedCount} slip${skippedCount > 0 ? ` (${skippedCount} dilewati)` : ''}`
            )
          }
        },
        onError: (e: any) => toast.error(e.message || 'Gagal sync gaji dari database'),
      }
    )
  }

  const handleFinalize = () => {
    if (
      !confirm(
        `Finalize semua slip gaji periode ${MONTHS[month - 1]} ${year}?\n\nPerhatian:\n1. Slip yang sudah final tidak bisa diedit kembali.\n2. Potongan kasbon pada slip akan otomatis memotong sisa hutang karyawan di Modul Kasbon dan mencatat pembayaran cicilan secara resmi.`
      )
    )
      return

    payrollMutations.finalizeAll.mutate(
      { month, year },
      {
        onSuccess: (res: any) =>
          toast.success(
            `Semua slip gaji berhasil di-finalize! (${res?.settledKasbonCount || 0} pembayaran kasbon berhasil disinkronkan ke Modul Kasbon)`
          ),
        onError: (e: any) => toast.error(e.message || 'Gagal finalize slip'),
      }
    )
  }

  const handleFinalizeSlip = (id: string) => {
    const slip = payrollData.find((s) => s.id === id)
    const staffName = slip?.outlet_staff?.name || 'staf'
    if (
      !confirm(
        `Finalize slip gaji untuk ${staffName}?\n\nSlip yang sudah final tidak bisa diedit kembali, dan potongan kasbon (jika ada) akan otomatis dicatat sebagai pembayaran cicilan di Modul Kasbon.`
      )
    )
      return

    payrollMutations.finalizeSlip.mutate(
      { id },
      {
        onSuccess: () =>
          toast.success(
            `Slip gaji ${staffName} berhasil di-finalize dan potongan kasbon telah disinkronkan ke Modul Kasbon!`
          ),
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
    if (!filteredPayrollData.length) {
      toast.error('Tidak ada data payroll untuk diexport')
      return
    }

    const rows = filteredPayrollData.map((r) => {
      const b = getPayrollBreakdown(r)
      return {
        Nama: r.outlet_staff?.name || '-',
        Role: r.outlet_staff?.role || '-',
        Outlet: isRendyOrDeveloperStaff(r.outlet_staff as any) ? 'Kantor Pusat' : (r.outlet_staff?.outlets?.name || 'Pusat'),
        Periode: `${r.period_month}/${r.period_year}`,
        'Gaji Pokok': b.basicSalary,
        'Tunjangan Makan': b.mealAllowance,
        'Tunjangan Transportasi': b.transportAllowance,
        'Tunjangan Telekomunikasi': b.communicationAllowance,
        'Sales Bonus': b.salesBonus,
        'Tunjangan Jabatan': b.positionAllowance,
        Lembur: b.overtime,
        'Potongan Kasbon': b.cashAdvanceDeduction,
        'Potongan BPJS': b.bpjsDeduction,
        'Denda Telat': b.lateDeduction,
        'Potongan Lain': b.otherDeduction,
        'Total Penerimaan': b.totalEarnings,
        'Total Potongan': b.totalDeductions,
        'Total Gaji Bersih (THP)': b.takeHomePay,
        Status: r.status,
      }
    })

    const outletLabel = selectedOutlet
      ? `_${(outlets.find((o) => o.id === selectedOutlet)?.name || 'Outlet').replace(/[^a-zA-Z0-9]/g, '_')}`
      : ''

    exportCsv(
      rows,
      Object.keys(rows[0]).map((k) => ({ key: k as any, label: k })),
      `Payroll_SukaHR${outletLabel}_${MONTHS[month - 1]}_${year}`
    )
    toast.success('Data payroll berhasil diexport ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penggajian (Payroll) &amp; Slip Gaji"
        description="Kalkulasi gaji otomatis, cetak slip resmi A5, pengiriman slip via WhatsApp (WAHA), dan sinkronisasi potongan denda absensi &amp; kasbon."
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Live Realtime Sync Aktif</span>
        </div>
      </PageHeader>

      {/* Quick Link Banner to Perizinan & Kasbon */}
      <div className="bg-[#FDF9F3] border border-suka-orange/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-suka-orange flex items-center justify-center shrink-0 font-bold">
            <CreditCard size={18} />
          </div>
          <div>
            <p className="text-xs font-extrabold text-suka-brown">Modul Kasbon &amp; Perizinan Terpadu</p>
            <p className="text-[11px] text-suka-gray-500">
              Pengajuan kasbon, persetujuan pinjaman, dan pembayaran cicilan kini dikelola di Pusat Perizinan &amp; Kasbon.
            </p>
          </div>
        </div>
        <Link
          href="/perizinan/kasbon"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-orange-50 border border-suka-orange/30 text-suka-orange rounded-xl text-xs font-extrabold transition-all shrink-0 self-start sm:self-center"
        >
          <span>Buka Modul Kasbon</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="space-y-6">
        {/* Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                options={monthOptions}
                value={String(month)}
                onChange={(val) => setMonth(Number(val))}
                placeholder="Pilih Bulan"
                className="min-w-[130px]"
              />
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-bold font-mono outline-none focus:border-suka-orange bg-white text-suka-ink"
              />
              <div className="flex items-center gap-1.5">
                <Select
                  options={outletOptions}
                  value={selectedOutlet}
                  onChange={setSelectedOutlet}
                  placeholder="Semua Outlet"
                  searchable={true}
                  searchPlaceholder="Cari outlet..."
                  className="min-w-[190px]"
                />
                {selectedOutlet && (
                  <button
                    type="button"
                    onClick={() => setSelectedOutlet('')}
                    className="px-2.5 py-2 text-xs font-semibold text-suka-gray-500 hover:text-suka-ink bg-stone-50 hover:bg-stone-100 border border-suka-gray-200 rounded-xl transition-colors cursor-pointer"
                    title="Reset ke Semua Outlet"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                onClick={() => {
                  if (filteredPayrollData.length === 0) {
                    toast.error('Belum ada slip gaji untuk dikirim pada filter atau periode ini.')
                    return
                  }
                  setShowBulkWAModal(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                <MessageSquare size={15} />
                <span>Kirim Massal WhatsApp (WAHA)</span>
              </Button>
              {/* Status Badge jika seluruh slip periode ini sudah di-Finalize */}
              {isAllFinalized && (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Periode Terfinalisasi ({payrollData.length} Slip)</span>
                </div>
              )}

              {/* Tombol Generate hanya muncul jika BELUM ADA slip sama sekali di bulan ini */}
              {!hasSlips && (
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={payrollMutations.generate.isPending}
                  className="bg-suka-orange hover:bg-suka-orange/90 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                >
                  {payrollMutations.generate.isPending ? <Spinner size={16} /> : 'Generate Slip'}
                </Button>
              )}

              {/* Tombol Sinkronisasi & Finalisasi hanya muncul jika masih ada slip Draft dan belum Finalized */}
              {!isAllFinalized && hasDrafts && (
                <>
                  <Button
                    type="button"
                    onClick={() => handleSyncSalary(true)}
                    disabled={payrollMutations.syncSalaryFromDatabase.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                    title="Ambil gaji pokok dan tunjangan terbaru dari Database Karyawan ke seluruh slip draft."
                  >
                    {payrollMutations.syncSalaryFromDatabase.isPending ? (
                      <Spinner size={16} />
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        <span>Sync Gaji dari DB</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSyncAttendance}
                    disabled={payrollMutations.syncAttendanceDeductions.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                    title="Hitung ulang denda keterlambatan absensi dan bonus porsi penjualan otomatis untuk seluruh slip draft"
                  >
                    {payrollMutations.syncAttendanceDeductions.isPending ? (
                      <Spinner size={16} />
                    ) : (
                      <>
                        <Zap size={14} />
                        <span>Sinkron Absensi &amp; Bonus</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFinalize}
                    disabled={payrollMutations.finalizeAll.isPending}
                    className="bg-suka-brown hover:bg-suka-brown/90 text-white font-bold rounded-xl text-xs shadow-sm"
                  >
                    {payrollMutations.finalizeAll.isPending ? <Spinner size={16} /> : 'Finalize Semua'}
                  </Button>
                </>
              )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Card 1: TOTAL GAJI POKOK */}
              <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <Banknote size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-suka-gray-500 uppercase truncate">Total Gaji Pokok</p>
                  <p className="text-xl font-black text-suka-ink mt-0.5 font-mono">
                    {formatRupiah(summaryTotals.totalGajiPokok)}
                  </p>
                </div>
              </div>

              {/* Card 2: TOTAL BONUS */}
              <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                  <Sparkles size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-suka-gray-500 uppercase truncate">Total Bonus</p>
                  <p className="text-xl font-black text-emerald-700 mt-0.5 font-mono">
                    {formatRupiah(summaryTotals.totalBonus)}
                  </p>
                </div>
              </div>

              {/* Card 3: TOTAL KESELURUHAN */}
              <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center font-bold shrink-0">
                  <DollarSign size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-suka-gray-500 uppercase truncate">Total Keseluruhan</p>
                  <p className="text-xl font-black text-suka-ink mt-0.5 font-mono">
                    {formatRupiah(summaryTotals.totalKeseluruhan)}
                  </p>
                </div>
              </div>

              {/* Card 4: JUMLAH STAF */}
              <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <Users size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-800 uppercase truncate">Jumlah Staf</p>
                  <p className="text-xl font-black text-emerald-900 mt-0.5">
                    {summaryTotals.staffCount} Orang
                  </p>
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
            <PayrollTable
              rows={filteredPayrollData}
              onEdit={setEditingSlip}
              onFinalizeSlip={handleFinalizeSlip}
            />
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
              records={filteredPayrollData}
              month={month}
              year={year}
              onClose={() => setShowBulkWAModal(false)}
            />
          )}
        </div>
    </div>
  )
}
