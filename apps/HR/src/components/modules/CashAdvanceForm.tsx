'use client'

import { useState } from 'react'
import { Button, CurrencyInput } from '@suka/design-system'
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
  const [reason, setReason] = useState('')

  const [payAmount, setPayAmount] = useState<number>(0)
  const [note, setNote] = useState('')

  const { data: staffList = [] } = useStaff()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'kasbon') {
      if (!staffId || !amount) return
      onSubmit({ staff_id: staffId, amount, reason: reason.trim() })
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
                <select
                  className={inputClass}
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  required
                >
                  <option value="">— Pilih Karyawan —</option>
                  {staffList
                    .filter((s) => s.role !== 'kiosk')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.outlets?.name || 'Pusat'} — {s.role})
                      </option>
                    ))}
                </select>
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
