'use client'

import { useState } from 'react'
import { CheckCircle2, RotateCcw, User, Building2, Calendar, FileText, AlertCircle } from 'lucide-react'
import { Button, CurrencyInput } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'
import { validateKasbonApproval } from '@/lib/kasbonApprovalValidation'
import type { CashAdvanceRow } from '@/hooks/useCashAdvances'

interface KasbonApproveModalProps {
  target: CashAdvanceRow
  onClose: () => void
  onSubmit: (params: { id: string; amount: number; approvalNote?: string }) => void
  submitting: boolean
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function KasbonApproveModal({
  target,
  onClose,
  onSubmit,
  submitting,
}: KasbonApproveModalProps) {
  const requestedAmount = Number(target.amount) || 0
  const [approvedAmount, setApprovedAmount] = useState<number>(requestedAmount)
  const [approvalNote, setApprovalNote] = useState<string>('')
  const [touched, setTouched] = useState<boolean>(false)

  const validation = validateKasbonApproval(requestedAmount, approvedAmount, approvalNote)
  const staffName = target.outlet_staff?.name || 'Karyawan'
  const roleName = target.outlet_staff?.role?.replace('_', ' ') || 'Staff'
  const outletName = target.outlet_staff?.outlets?.name || 'Pusat'
  const installmentMonths = target.installment_months || 1

  const reqDate = target.created_at
    ? new Date(target.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!validation.isValid || submitting) return

    onSubmit({
      id: target.id,
      amount: approvedAmount,
      approvalNote: approvalNote.trim() || undefined,
    })
  }

  const handleResetAmount = () => {
    setApprovedAmount(requestedAmount)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl border border-suka-gray-200 animate-in zoom-in-95 my-6">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-suka-gray-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h3 className="font-bold text-suka-brown text-base">Setujui Permohonan Kasbon</h3>
            <p className="text-xs text-suka-gray-500 mt-0.5">
              Tentukan nominal pencairan dan konfirmasi persetujuan kasbon staf.
            </p>
          </div>
        </div>

        {/* Ringkasan Pengajuan Staf */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-suka-ink">
              <User size={13} className="text-stone-400" />
              {staffName}
              <span className="text-[10px] text-stone-500 font-normal">({roleName})</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-stone-500 font-mono">
              <Calendar size={12} className="text-stone-400" />
              {reqDate}
            </span>
          </div>

          <div className="flex items-center justify-between text-stone-600 border-t border-stone-200/60 pt-2">
            <span className="flex items-center gap-1">
              <Building2 size={12} className="text-stone-400" />
              Outlet: <strong>{outletName}</strong>
            </span>
            <span>
              Tenor:{' '}
              <strong>
                {installmentMonths} Bulan {installmentMonths === 1 ? '(Langsung lunas)' : `(${installmentMonths}x cicilan)`}
              </strong>
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-stone-200/60 pt-2">
            <span className="text-stone-500">Nominal Diajukan:</span>
            <span className="font-mono font-bold text-suka-brown text-sm">
              {formatRupiah(requestedAmount)}
            </span>
          </div>

          {target.reason && (
            <div className="border-t border-stone-200/60 pt-2 flex items-start gap-1.5 text-stone-600 italic">
              <FileText size={12} className="text-stone-400 shrink-0 mt-0.5" />
              <span>&ldquo;{target.reason}&rdquo;</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Nominal Disetujui */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>Nominal yang Disetujui (Rp) *</label>
              {validation.isAmountDifferent && (
                <button
                  type="button"
                  onClick={handleResetAmount}
                  className="inline-flex items-center gap-1 text-[11px] text-suka-orange hover:underline font-semibold cursor-pointer"
                >
                  <RotateCcw size={11} />
                  Reset ke Rp {requestedAmount.toLocaleString('id-ID')}
                </button>
              )}
            </div>
            <CurrencyInput
              className={inputClass}
              value={approvedAmount}
              onChange={(val) => {
                setApprovedAmount(val)
                setTouched(true)
              }}
              required
            />
            {installmentMonths > 1 && approvedAmount > 0 && (
              <p className="mt-1 text-[11px] text-stone-500 font-medium">
                Estimasi cicilan baru:{' '}
                <span className="font-bold text-emerald-700 font-mono">
                  {formatRupiah(Math.ceil(approvedAmount / installmentMonths))}
                </span>{' '}
                / bulan ({installmentMonths}x)
              </p>
            )}
          </div>

          {/* Alert jika nominal berbeda */}
          {validation.isAmountDifferent && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span>Nominal Disetujui Berbeda ({formatRupiah(approvedAmount)})</span>
              </div>
              <p className="leading-relaxed">
                Nominal persetujuan berbeda dari pengajuan awal ({formatRupiah(requestedAmount)}).{' '}
                <strong>Wajib mencantumkan alasan penyesuaian nominal</strong> di bawah ini agar jelas bagi karyawan dan pembukuan payroll.
              </p>
            </div>
          )}

          {/* Field Catatan / Alasan */}
          <div>
            <label className={labelClass}>
              {validation.isAmountDifferent ? (
                <>
                  Alasan Perubahan Nominal <span className="text-red-500">*</span>
                </>
              ) : (
                'Catatan Persetujuan (Opsional)'
              )}
            </label>
            <textarea
              rows={3}
              value={approvalNote}
              onChange={(e) => {
                setApprovalNote(e.target.value)
                setTouched(true)
              }}
              className={`${inputClass} ${
                touched && !validation.isValid && validation.isAmountDifferent
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : ''
              }`}
              placeholder={
                validation.isAmountDifferent
                  ? 'Contoh: Disesuaikan dengan batas plafon kasbon bulanan karyawan / kesepakatan bersama...'
                  : 'Contoh: Disetujui sesuai permohonan staf...'
              }
              required={validation.isAmountDifferent}
            />
            {touched && !validation.isValid && validation.error && (
              <p className="mt-1 text-[11px] text-red-600 font-semibold">{validation.error}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-suka-gray-100">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl font-bold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting || !validation.isValid}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} />
              {submitting ? 'Memproses...' : 'Setujui Kasbon'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
