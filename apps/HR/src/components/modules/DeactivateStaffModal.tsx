'use client'

import { useState, useEffect } from 'react'
import {
  UserMinus,
  Calendar,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Clock,
  Banknote,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'
import type { StaffRow } from '@/lib/types'
import {
  getStaffSettlementPreview,
  deactivateStaffWithSettlementAction,
  type SettlementCalculationPreview,
} from '@/app/actions/users'

interface DeactivateStaffModalProps {
  staff: StaffRow
  onClose: () => void
  onSuccess: () => void
}

const REASON_PRESETS = [
  'Resign Sukarela (Mengundurkan Diri)',
  'Habis Masa Kontrak',
  'Pemutusan Hubungan Kerja (PHK)',
  'Mangkir / Berhenti Tanpa Pemberitahuan',
  'Kesehatan / Alasan Medis',
  'Lainnya',
]

export function DeactivateStaffModal({ staff, onClose, onSuccess }: DeactivateStaffModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const [resignDate, setResignDate] = useState<string>(today)
  const [selectedPreset, setSelectedPreset] = useState<string>(REASON_PRESETS[0])
  const [customReason, setCustomReason] = useState<string>('')
  const [createDraftSlip, setCreateDraftSlip] = useState<boolean>(true)

  const [loadingPreview, setLoadingPreview] = useState<boolean>(true)
  const [preview, setPreview] = useState<SettlementCalculationPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Fetch live settlement calculation when date changes
  useEffect(() => {
    let active = true
    async function load() {
      setLoadingPreview(true)
      setPreviewError(null)
      try {
        const res = await getStaffSettlementPreview(staff.id, resignDate)
        if (!active) return
        if (res.ok && res.data) {
          setPreview(res.data)
        } else {
          setPreviewError(res.error || 'Gagal memuat rekap settlement')
        }
      } catch (err: any) {
        if (!active) return
        setPreviewError(err.message || 'Terjadi kesalahan sistem')
      } finally {
        if (active) setLoadingPreview(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [staff.id, resignDate])

  const finalReason = selectedPreset === 'Lainnya' ? customReason.trim() : selectedPreset

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!finalReason) {
      alert('Mohon pilih atau isi alasan penonaktifan karyawan.')
      return
    }

    setSubmitting(true)
    try {
      const settlementDraft = preview
        ? {
            basicSalary: preview.basicSalaryProrated,
            allowanceMeal: preview.allowanceMealProrated,
            allowancePosition: preview.allowancePosition,
            salesBonus: preview.salesBonusEstimated,
            deductionLate: preview.lateDeduction,
            deductionKasbon: preview.kasbonDeduction,
            totalSalary: preview.takeHomePay,
            periodMonth: preview.periodMonth,
            periodYear: preview.periodYear,
          }
        : undefined

      const res = await deactivateStaffWithSettlementAction({
        staffId: staff.id,
        resignDate,
        inactiveReason: finalReason,
        createDraftSlip,
        settlementDraft,
      })

      if (!res.ok) {
        throw new Error(res.error || res.message || 'Gagal menonaktifkan karyawan')
      }

      onSuccess()
    } catch (err: any) {
      alert(err.message || 'Gagal menonaktifkan staf')
    } finally {
      setSubmitting(false)
    }
  }

  const roleName = staff.role?.replace(/_/g, ' ') || 'Staff'
  const outletName = staff.outlets?.name || 'Pusat'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-suka-gray-200 animate-in zoom-in-95 my-8 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3.5 border-b border-suka-gray-100 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
            <UserMinus size={24} />
          </div>
          <div>
            <h3 className="font-extrabold text-suka-brown text-lg">
              Nonaktifkan Akun & Settlement Terakhir
            </h3>
            <p className="text-xs text-suka-gray-500 mt-0.5">
              Formulir penonaktifan akun karyawan beserta kalkulasi resep hak & potongan gaji terakhir.
            </p>
          </div>
        </div>

        {/* Info Karyawan */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <div className="text-sm font-bold text-suka-ink">{staff.name}</div>
            <div className="text-stone-500 font-medium capitalize mt-0.5">
              {roleName} &bull; <span className="font-semibold text-stone-700">{outletName}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Gaji Pokok Terdaftar</div>
            <div className="font-mono font-bold text-suka-brown text-sm">
              {staff.financials?.basic_salary ? formatRupiah(staff.financials.basic_salary) : 'Rp 0'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form Input Alasan & Tanggal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-suka-brown mb-1.5">
                Tanggal Efektif Keluar *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={resignDate}
                  onChange={(e) => setResignDate(e.target.value)}
                  className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-semibold text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-suka-brown mb-1.5">
                Alasan Penonaktifan *
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-semibold text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
              >
                {REASON_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPreset === 'Lainnya' && (
            <div>
              <label className="block text-xs font-bold text-suka-brown mb-1.5">
                Keterangan Alasan Lainnya *
              </label>
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Tuliskan alasan penonaktifan secara rinci..."
                className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
                required
              />
            </div>
          )}

          {/* Section: Resep & Preview Settlement */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <span className="flex items-center gap-2 font-black text-amber-900 text-xs uppercase tracking-wider">
                <Receipt size={15} className="text-amber-600" />
                Resep Rekap Settlement Terakhir (Bulan {preview?.periodMonth || '-'}/{preview?.periodYear || '-'})
              </span>
              {loadingPreview && (
                <span className="text-[11px] text-amber-700 font-medium animate-pulse">
                  Menghitung...
                </span>
              )}
            </div>

            {previewError ? (
              <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{previewError}</span>
              </div>
            ) : preview ? (
              <div className="space-y-2 text-xs">
                {/* Kehadiran */}
                <div className="flex items-center justify-between text-stone-700 bg-white/70 px-3 py-2 rounded-xl border border-stone-200/60">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-stone-400" />
                    Kehadiran Periode s/d {resignDate}:
                  </span>
                  <span className="font-bold text-suka-ink font-mono">
                    {preview.daysPresent} Hari Kerja &bull; Telat: {preview.lateMinutes} mnt
                  </span>
                </div>

                {/* Komponen Hak */}
                <div className="bg-white/70 p-3 rounded-xl border border-stone-200/60 space-y-1.5">
                  <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    Hak Penghasilan (Prorata 26 Hari)
                  </div>
                  <div className="flex justify-between items-center text-stone-600">
                    <span>
                      Gaji Pokok ({preview.daysPresent}/26 hr):
                    </span>
                    <span className="font-mono font-semibold text-stone-800">
                      {formatRupiah(preview.basicSalaryProrated)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-stone-600">
                    <span>
                      Uang Kehadiran / Makan ({preview.daysPresent}/26 hr):
                    </span>
                    <span className="font-mono font-semibold text-stone-800">
                      {formatRupiah(preview.allowanceMealProrated)}
                    </span>
                  </div>

                  {preview.salesBonusEstimated > 0 && (
                    <div className="flex justify-between items-center text-stone-600">
                      <span>Estimasi Bonus Penjualan Berjalan:</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        +{formatRupiah(preview.salesBonusEstimated)}
                      </span>
                    </div>
                  )}

                  {preview.lateDeduction > 0 && (
                    <div className="flex justify-between items-center text-stone-600">
                      <span>Denda Telat ({preview.lateMinutes} mnt x Rp 1.000):</span>
                      <span className="font-mono font-semibold text-red-600">
                        -{formatRupiah(preview.lateDeduction)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-stone-200 pt-1.5 flex justify-between items-center font-bold text-stone-800">
                    <span>Subtotal Hak Karyawan:</span>
                    <span className="font-mono text-suka-brown">
                      {formatRupiah(preview.subtotalHak)}
                    </span>
                  </div>
                </div>

                {/* Komponen Potongan Kasbon */}
                <div className="bg-white/70 p-3 rounded-xl border border-stone-200/60 space-y-1.5">
                  <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    Kewajiban Kasbon Karyawan
                  </div>
                  <div className="flex justify-between items-center text-stone-600">
                    <span>Total Sisa Kasbon Aktif:</span>
                    <span className="font-mono font-semibold text-amber-800">
                      {formatRupiah(preview.totalKasbonRemaining)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-stone-600">
                    <span>Potongan Kasbon di Settlement:</span>
                    <span className="font-mono font-semibold text-red-600">
                      -{formatRupiah(preview.kasbonDeduction)}
                    </span>
                  </div>

                  {preview.kasbonDeficit > 0 && (
                    <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[11px] mt-1">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>Defisit Hutang Kasbon: {formatRupiah(preview.kasbonDeficit)}</strong>. Hak gaji tidak mencukupi sisa kasbon. Sisa hutang tetap tercatat aktif untuk penagihan manual oleh HR.
                      </span>
                    </div>
                  )}
                </div>

                {/* Total Take Home Pay */}
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3.5 shadow-sm">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                      Gaji Bersih Terakhir (Take Home Pay)
                    </div>
                    <div className="text-[10px] text-emerald-100/80">
                      Hak gaji dikurangi pelunasan kasbon
                    </div>
                  </div>
                  <div className="text-xl font-mono font-black">
                    {formatRupiah(preview.takeHomePay)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Opsi Sinkron ke Payroll */}
          <label className="flex items-center gap-2.5 text-xs text-stone-700 font-medium cursor-pointer p-2 rounded-xl hover:bg-stone-50 transition-colors">
            <input
              type="checkbox"
              checked={createDraftSlip}
              onChange={(e) => setCreateDraftSlip(e.target.checked)}
              className="rounded text-suka-orange focus:ring-suka-orange h-4 w-4"
            />
            <span>
              Buat / perbarui draft slip gaji periode berjalan di <strong>Modul Payroll</strong> dengan rincian settlement di atas.
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2.5 border-t border-suka-gray-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting || loadingPreview}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
            >
              {submitting ? 'Memproses...' : 'Konfirmasi & Nonaktifkan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
