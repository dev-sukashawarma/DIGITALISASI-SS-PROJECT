'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Printer,
  UploadCloud,
  CheckCircle2,
  Search,
  Building2,
  Eye,
  Calendar,
  Receipt,
  FileText
} from 'lucide-react'
import { toast } from 'sonner'
import { useOfficeVouchers } from '@/hooks/useOfficeVouchers'
import { OFFICE_DIVISIONS, VOUCHER_STATUS_META, type OfficeVoucher } from '@/lib/officeVoucher'
import { CreateVoucherModal } from '@/components/CreateVoucherModal'
import { SettleVoucherModal } from '@/components/SettleVoucherModal'
import { VerifyVoucherModal } from '@/components/VerifyVoucherModal'
import { generateVoucherPDF } from '@/utils/voucherPdfGenerator'

export default function OfficeExpensesPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [selectedDivision, setSelectedDivision] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [settlingVoucher, setSettlingVoucher] = useState<OfficeVoucher | null>(null)
  const [verifyingVoucher, setVerifyingVoucher] = useState<OfficeVoucher | null>(null)
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null)

  const {
    vouchers,
    isLoading,
    createVoucher,
    isCreating,
    settleVoucher,
    isSettling,
    verifyVoucher,
    isVerifying,
    rejectVoucher,
    isRejecting
  } = useOfficeVouchers(selectedMonth)

  // Filtered vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (selectedDivision !== 'all' && v.division !== selectedDivision) return false
      if (selectedStatus !== 'all' && v.status !== selectedStatus) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNum = v.voucherNumber.toLowerCase().includes(q)
        const matchRcp = v.recipientName.toLowerCase().includes(q)
        const matchRsn = v.reason.toLowerCase().includes(q)
        const matchDiv = v.division.toLowerCase().includes(q)
        if (!matchNum && !matchRcp && !matchRsn && !matchDiv) return false
      }
      return true
    })
  }, [vouchers, selectedDivision, selectedStatus, searchQuery])

  // KPIs
  const stats = useMemo(() => {
    let totalAdvanceActive = 0
    let countAdvanceActive = 0
    let totalWaitingVerify = 0
    let countWaitingVerify = 0
    let totalVerifiedOpex = 0
    let totalRefundReturned = 0

    vouchers.forEach(v => {
      if (v.status === 'draft_advance') {
        totalAdvanceActive += v.advanceAmount
        countAdvanceActive++
      } else if (v.status === 'waiting_verification') {
        totalWaitingVerify += (v.realizedAmount || v.advanceAmount)
        countWaitingVerify++
      } else if (v.status === 'verified') {
        totalVerifiedOpex += (v.realizedAmount || v.advanceAmount)
        totalRefundReturned += (v.refundAmount || 0)
      }
    })

    return {
      totalAdvanceActive,
      countAdvanceActive,
      totalWaitingVerify,
      countWaitingVerify,
      totalVerifiedOpex,
      totalRefundReturned
    }
  }, [vouchers])

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) {
      toast.error('Tidak ada data voucher pengajuan dana untuk diekspor.')
      return
    }

    try {
      const headers = ['No', 'No. Voucher', 'Tanggal', 'Nama Pemohon', 'Divisi', 'Kategori OPEX', 'Keperluan Belanja', 'Uang Muka (Rp)', 'Riil Belanja (Rp)', 'Sisa Kembalian (Rp)', 'Status', 'Bukti Nota']
      const rows = filteredVouchers.map((v, idx) => [
        idx + 1,
        `"${v.voucherNumber}"`,
        `"${v.date}"`,
        `"${(v.recipientName || '').replace(/"/g, '""')}"`,
        `"${(v.division || '').replace(/"/g, '""')}"`,
        `"${(v.categoryLabel || '').replace(/"/g, '""')}"`,
        `"${(v.reason || '').replace(/"/g, '""')}"`,
        v.advanceAmount,
        v.status === 'draft_advance' ? '-' : (v.realizedAmount || v.advanceAmount),
        v.refundAmount || 0,
        `"${(VOUCHER_STATUS_META[v.status]?.label || v.status).replace(/"/g, '""')}"`,
        `"${v.receiptUrl ? 'Ada Struk' : 'Belum Ada'}"`
      ])

      const csvContent = '\uFEFF' + [
        headers.join(','),
        ...rows.map(e => e.join(','))
      ].join('\r\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `Pengajuan_Dana_Kantor_${selectedMonth}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Berhasil mengunduh ${filteredVouchers.length} voucher ke file CSV!`)
    } catch (e: any) {
      toast.error('Gagal mengekspor file CSV: ' + e.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" /> Kantor Pusat & Head Office
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Kas & Pengajuan Dana Kantor
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            SOP Pengajuan Uang Muka, Cetak Voucher PDF, Realisasi Nota Belanja, & Verifikasi OPEX Kantor
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-blue-600 font-bold px-3.5 py-2.5 rounded-xl text-sm transition-all border border-blue-200 cursor-pointer shadow-2xs"
          >
            <FileText className="w-4 h-4" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-amber-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Pengajuan Dana</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Uang Muka Aktif (Menunggu Struk)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-gray-900">
              Rp {stats.totalAdvanceActive.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {stats.countAdvanceActive} Pengajuan
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Uang telah diserahkan, menunggu bukti belanja</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Menunggu Verifikasi Finance</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-gray-900">
              Rp {stats.totalWaitingVerify.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {stats.countWaitingVerify} Nota
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Struk sudah diupload, siap diverifikasi</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">OPEX Terverifikasi (Bulan Ini)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-700">
              Rp {stats.totalVerifiedOpex.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Resmi masuk ke perhitungan Buku Kas kantor</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Sisa Kembalian Kembali ke Kas</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-gray-800">
              Rp {stats.totalRefundReturned.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Total selisih uang kembali dari belanja</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Month Picker */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer"
            />
          </div>

          {/* Division Filter */}
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
          >
            <option value="all">🏢 Semua Divisi</option>
            {OFFICE_DIVISIONS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
          >
            <option value="all">🔘 Semua Status</option>
            <option value="draft_advance">⏳ Uang Muka (Menunggu Struk)</option>
            <option value="waiting_verification">📑 Menunggu Verifikasi Finance</option>
            <option value="verified">✅ Terverifikasi (Masuk OPEX)</option>
            <option value="rejected">❌ Ditolak</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari voucher / pemohon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-amber-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-gray-400">
            Memuat data pengajuan dana kantor...
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Belum Ada Pengajuan Kas Kantor</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Belum ada data voucher pengajuan dana pada filter ini. Klik tombol di atas untuk membuat pengajuan baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3.5">No. Voucher & Tanggal</th>
                  <th className="px-4 py-3.5">Nama Pemohon</th>
                  <th className="px-4 py-3.5">Divisi</th>
                  <th className="px-4 py-3.5">Kategori OPEX</th>
                  <th className="px-4 py-3.5">Keperluan Belanja</th>
                  <th className="px-4 py-3.5 text-right">Uang Muka</th>
                  <th className="px-4 py-3.5 text-right">Riil Belanja</th>
                  <th className="px-4 py-3.5 text-center">Bukti Nota</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVouchers.map((v) => {
                  const statusMeta = VOUCHER_STATUS_META[v.status] || VOUCHER_STATUS_META.draft_advance
                  const hasReceipt = Boolean(v.receiptUrl)

                  return (
                    <tr key={v.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* Voucher & Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-bold text-amber-700 block font-mono text-[11px]">
                          {v.voucherNumber}
                        </span>
                        <span className="text-[10px] text-gray-400">{v.date}</span>
                      </td>

                      {/* Nama Pemohon */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold text-gray-900">
                        {v.recipientName}
                      </td>

                      {/* Divisi */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200">
                          {v.division}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-800 font-semibold text-[10px] border border-amber-100">
                          {v.categoryLabel}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="truncate text-gray-700 font-medium" title={v.reason}>
                          {v.reason}
                        </p>
                      </td>

                      {/* Advance Amount */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-bold text-gray-900">
                        Rp {v.advanceAmount.toLocaleString('id-ID')}
                      </td>

                      {/* Realized Amount */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {v.status === 'draft_advance' ? (
                          <span className="text-gray-400 italic text-[11px]">- (Menunggu Struk)</span>
                        ) : (
                          <div>
                            <span className="font-bold text-gray-900 block">
                              Rp {(v.realizedAmount || v.advanceAmount).toLocaleString('id-ID')}
                            </span>
                            {v.refundAmount ? (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                Sisa: +Rp {v.refundAmount.toLocaleString('id-ID')}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>

                      {/* Bukti Nota */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {hasReceipt ? (
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptUrl(v.receiptUrl || null)}
                            title="Klik untuk melihat bukti nota / struk"
                            className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-lg text-[10px] border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Lihat Nota</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">
                            {v.status === 'draft_advance' ? 'Belum Ada' : '-'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusMeta.badgeCls}`}>
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Cetak PDF Voucher */}
                          <button
                            type="button"
                            onClick={() => generateVoucherPDF(v)}
                            title="Cetak Formulir Voucher (PDF)"
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Upload / Settle Nota */}
                          {v.status === 'draft_advance' && (
                            <button
                              type="button"
                              onClick={() => setSettlingVoucher(v)}
                              title="Upload Struk & Input Realisasi Biaya"
                              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer shadow-xs"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>Upload Nota</span>
                            </button>
                          )}

                          {/* Verifikasi Finance */}
                          {v.status === 'waiting_verification' && (
                            <button
                              type="button"
                              onClick={() => setVerifyingVoucher(v)}
                              title="Verifikasi & Approve OPEX"
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verifikasi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALS */}
      <CreateVoucherModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (data) => {
          return await createVoucher(data)
        }}
        isSubmitting={isCreating}
      />

      <SettleVoucherModal
        voucher={settlingVoucher}
        isOpen={Boolean(settlingVoucher)}
        onClose={() => setSettlingVoucher(null)}
        onSubmit={async (data) => {
          await settleVoucher(data)
        }}
        isSubmitting={isSettling}
      />

      <VerifyVoucherModal
        voucher={verifyingVoucher}
        isOpen={Boolean(verifyingVoucher)}
        onClose={() => setVerifyingVoucher(null)}
        onVerify={async (data) => {
          await verifyVoucher(data)
        }}
        onReject={async (data) => {
          await rejectVoucher(data)
        }}
        isProcessing={isVerifying || isRejecting}
      />

      {/* Preview Receipt Modal */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" onClick={() => setPreviewReceiptUrl(null)}>
          <div className="bg-white p-4 rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-800">Lampiran Bukti Nota / Invoice</span>
              <button onClick={() => setPreviewReceiptUrl(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-800">
                ✖
              </button>
            </div>
            {previewReceiptUrl.match(/\.(jpeg|jpg|png|webp|gif)/i) || previewReceiptUrl.startsWith('data:image') ? (
              <img src={previewReceiptUrl} alt="Nota" className="max-h-[70vh] rounded-xl object-contain" />
            ) : (
              <iframe src={previewReceiptUrl} className="w-full h-96 rounded-xl border border-gray-200" title="Nota PDF" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
