'use client'

import { useState, useMemo } from 'react'
import { Button, CurrencyInput } from '@suka/design-system'
import { Select } from '@/components/ui/Select'
import { useStaff } from '@/hooks/useStaff'
import { formatRupiah } from '@/lib/format'

interface CashAdvanceFormProps {
  mode: 'kasbon' | 'payment'
  onSubmit: (data: Record<string, any>) => void
  submitting: boolean
  onCancel?: () => void
  maxAmount?: number
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function CashAdvanceForm({
  mode,
  onSubmit,
  submitting,
  onCancel,
  maxAmount,
}: CashAdvanceFormProps) {
  const [staffId, setStaffId] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [installmentMonths, setInstallmentMonths] = useState<number>(1)
  const [reason, setReason] = useState('')

  const [payAmount, setPayAmount] = useState<number>(0)
  const [note, setNote] = useState('')

  const { data: staffList = [] } = useStaff()

  const staffOptions = useMemo(
    () => [
      { label: '— Pilih Karyawan —', value: '' },
      ...staffList
        .filter((s) => s.role !== 'kiosk')
        .map((s) => ({
          label: `${s.name} (${s.outlets?.name || 'Pusat'} — ${s.role})`,
          value: s.id,
        })),
    ],
    [staffList]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'kasbon') {
      if (!staffId || !amount) return
      onSubmit({
        staff_id: staffId,
        amount,
        reason: reason.trim(),
        installment_months: installmentMonths,
      })
    } else {
      if (!payAmount || payAmount <= 0) return
      onSubmit({ amount: payAmount, note: note.trim() || null })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl space-y-4 animate-in zoom-in-95"
      >
        <h3 className="text-base font-extrabold text-suka-brown">
          {mode === 'kasbon' ? 'Buat Pengajuan Kasbon Baru' : 'Bayar Cicilan Kasbon'}
        </h3>
        <p className="text-xs text-suka-gray-500 font-medium">
          {mode === 'kasbon'
            ? 'Catat pinjaman dana darurat karyawan.'
            : `Sisa hutang: ${maxAmount != null ? formatRupiah(maxAmount) : '—'}`}
        </p>

        <div className="space-y-3 pt-2">
          {mode === 'kasbon' ? (
            <>
              <div>
                <label className={labelClass}>Pilih Karyawan</label>
                <Select
                  options={staffOptions}
                  value={staffId}
                  onChange={setStaffId}
                  placeholder="— Pilih Karyawan —"
                  className="w-full"
                />
              </div>

              <div>
                <CurrencyInput
                  label="Jumlah Pinjaman (Rp)"
                  className={inputClass}
                  value={amount}
                  onChange={setAmount}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Tenor Cicilan (Bulan)</label>
                <select
                  className={inputClass}
                  value={installmentMonths}
                  onChange={(e) => setInstallmentMonths(Number(e.target.value))}
                >
                  <option value={1}>1 Bulan (Langsung lunas di payroll berikutnya)</option>
                  <option value={2}>2 Bulan (Cicil 2x)</option>
                  <option value={3}>3 Bulan (Cicil 3x)</option>
                  <option value={4}>4 Bulan (Cicil 4x)</option>
                  <option value={5}>5 Bulan (Cicil 5x)</option>
                  <option value={6}>6 Bulan (Cicil 6x)</option>
                </select>
                {amount > 0 && (
                  <p className="mt-1 text-[11px] text-suka-gray-500 font-medium">
                    Estimasi cicilan: <span className="font-bold text-suka-brown font-mono">{formatRupiah(Math.ceil(amount / (installmentMonths || 1)))}</span> / bulan
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Alasan / Keterangan Kasbon</label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Keperluan darurat keluarga / berobat"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <CurrencyInput
                  label="Jumlah Pembayaran (Rp)"
                  className={inputClass}
                  value={payAmount}
                  onChange={(v) => setPayAmount(maxAmount != null ? Math.min(v, maxAmount) : v)}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Catatan Pembayaran</label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Potong gaji bulan berjalan / setor tunai"
                />
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-suka-gray-100">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl font-bold"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white"
          >
            {submitting ? 'Menyimpan...' : mode === 'kasbon' ? 'Simpan Kasbon' : 'Bayar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
