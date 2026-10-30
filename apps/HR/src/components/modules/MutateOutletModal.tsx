'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeftRight,
  Building2,
  History,
} from 'lucide-react'
import { Button } from '@suka/design-system'
import type { StaffRow, Outlet } from '@/lib/types'
import {
  mutateStaffOutletAction,
  getStaffMutationHistory,
} from '@/app/actions/users'

interface MutateOutletModalProps {
  staff: StaffRow
  outlets: Outlet[]
  onClose: () => void
  onSuccess: (message: string) => void
}

const REASON_PRESETS = [
  'Rotasi Cabang Berkala',
  'Kebutuhan Tenaga Operasional Cabang',
  'Promosi Jabatan / Penugasan Khusus',
  'Permintaan Karyawan (Domisili / Pribadi)',
  'Pembukaan Cabang Baru',
  'Penyesuaian Jam Operasional / Shift',
  'Lainnya',
]

export function MutateOutletModal({
  staff,
  outlets,
  onClose,
  onSuccess,
}: MutateOutletModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const [effectiveDate, setEffectiveDate] = useState<string>(today)
  const [targetOutletId, setTargetOutletId] = useState<string>('')
  const [selectedReason, setSelectedReason] = useState<string>(REASON_PRESETS[0])
  const [customReason, setCustomReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Riwayat mutasi sebelumnya
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true)
  const [showHistory, setShowHistory] = useState<boolean>(false)

  const originOutletId = staff.outlet_id
  const originOutletName = staff.outlets?.name || 'Kantor Pusat'

  // Filter outlet tujuan: aktif dan bukan outlet asal
  const availableOutlets = outlets.filter(
    (o) => o.is_active !== false && o.id !== originOutletId
  )

  useEffect(() => {
    let active = true
    async function loadHistory() {
      setLoadingHistory(true)
      try {
        const res = await getStaffMutationHistory(staff.id)
        if (active && res.ok) {
          setHistory(res.data || [])
        }
      } catch {
        if (active) setHistory([])
      } finally {
        if (active) setLoadingHistory(false)
      }
    }
    loadHistory()
    return () => {
      active = false
    }
  }, [staff.id])

  const finalReason = selectedReason === 'Lainnya' ? customReason.trim() : selectedReason

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetOutletId) {
      alert('Mohon pilih outlet tujuan mutasi.')
      return
    }
    if (!finalReason) {
      alert('Mohon pilih atau isi alasan mutasi.')
      return
    }

    setSubmitting(true)
    try {
      const res = await mutateStaffOutletAction({
        staffId: staff.id,
        targetOutletId,
        effectiveDate,
        reason: finalReason,
        notes: notes.trim() || undefined,
      })

      if (!res.ok) {
        throw new Error(res.error || res.message || 'Gagal memproses mutasi karyawan')
      }

      onSuccess(res.message)
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan mutasi cabang')
    } finally {
      setSubmitting(false)
    }
  }

  const roleName = staff.role?.replace(/_/g, ' ') || 'Staff'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-suka-gray-200 animate-in zoom-in-95 my-8 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3.5 border-b border-suka-gray-100 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200">
            <ArrowLeftRight size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-suka-brown text-lg">
              Mutasi Penugasan Outlet
            </h3>
            <p className="text-xs text-suka-gray-500 mt-0.5">
              Pindahkan penugasan cabang resmi karyawan dengan tanggal efektif dan log historis.
            </p>
          </div>
        </div>

        {/* Info Staf & Pergerakan Outlet */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-suka-ink">{staff.name}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wider text-[10px]">
              {roleName}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1 text-xs">
            {/* Origin Outlet */}
            <div className="flex-1 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                Outlet Asal (Saat Ini)
              </span>
              <span className="font-extrabold text-stone-800 flex items-center gap-1.5">
                <Building2 size={14} className="text-stone-400 shrink-0" />
                {originOutletName}
              </span>
            </div>

            <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-200/60 flex items-center justify-center text-indigo-700">
              <ArrowLeftRight size={14} />
            </div>

            {/* Target Outlet Selector */}
            <div className="flex-1 bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-indigo-600 block mb-1">
                Outlet Tujuan Baru *
              </span>
              <select
                value={targetOutletId}
                onChange={(e) => setTargetOutletId(e.target.value)}
                className="w-full text-xs font-bold text-suka-ink outline-none bg-transparent cursor-pointer"
                required
              >
                <option value="">— Pilih Cabang —</option>
                {availableOutlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-suka-brown mb-1.5">
                Tanggal Efektif Mutasi *
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-semibold text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
                required
              />
              <span className="text-[10px] text-stone-400 mt-1 block">
                Absensi & bonus mulai diperhitungkan di cabang baru sejak tanggal ini.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-suka-brown mb-1.5">
                Alasan Mutasi *
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
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

          {selectedReason === 'Lainnya' && (
            <div>
              <label className="block text-xs font-bold text-suka-brown mb-1.5">
                Alasan Mutasi Tertulis *
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Tuliskan alasan mutasi..."
                className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-suka-brown mb-1.5">
              Catatan / Instruksi HR (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Serah terima kunci outlet Paledang telah dilakukan kepada Leader Fahmi."
              className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
            />
          </div>

          {/* Toggle Riwayat Mutasi Sebelumnya */}
          <div className="border-t border-suka-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition-colors cursor-pointer"
            >
              <History size={14} />
              <span>
                {showHistory ? 'Sembunyikan' : 'Lihat'} Riwayat Mutasi Karyawan ({history.length})
              </span>
            </button>

            {showHistory && (
              <div className="mt-2.5 space-y-2 max-h-40 overflow-y-auto pr-1">
                {loadingHistory ? (
                  <div className="text-xs text-stone-400 italic">Memuat riwayat...</div>
                ) : history.length === 0 ? (
                  <div className="text-xs text-stone-400 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                    Belum ada catatan riwayat mutasi untuk karyawan ini.
                  </div>
                ) : (
                  history.map((h: any) => (
                    <div
                      key={h.id}
                      className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs space-y-1"
                    >
                      <div className="flex justify-between items-center font-bold text-stone-800">
                        <span className="flex items-center gap-1">
                          {h.origin_outlet?.name || 'Awal'} &rarr; {h.target_outlet?.name || 'Tujuan'}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500 font-normal">
                          {h.effective_date}
                        </span>
                      </div>
                      <div className="text-stone-600 text-[11px]">
                        Alasan: <strong>{h.reason}</strong>
                        {h.notes && <span className="italic text-stone-500"> &bull; &ldquo;{h.notes}&rdquo;</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

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
              disabled={submitting || !targetOutletId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <ArrowLeftRight size={14} />
              {submitting ? 'Memproses...' : 'Konfirmasi Mutasi Cabang'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
