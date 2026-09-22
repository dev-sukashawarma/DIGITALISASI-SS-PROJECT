'use client'

import { useState, useEffect } from 'react'
import { Button } from '@suka/design-system'
import { AlertTriangle, Info, Calendar } from 'lucide-react'
import { useStaff } from '@/hooks/useStaff'
import type { DisciplineRecord, WarningLevel } from '@/lib/types'
import { addMonths, getStaffActiveSpStatus } from '@/lib/disciplineUtils'

interface DisciplineFormModalProps {
  existingRecords?: DisciplineRecord[]
  onClose: () => void
  onSubmit: (record: Omit<DisciplineRecord, 'id'>) => void
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function DisciplineFormModal({ existingRecords = [], onClose, onSubmit }: DisciplineFormModalProps) {
  const { data: staffList = [] } = useStaff()
  const [staffId, setStaffId] = useState('')
  const [warningLevel, setWarningLevel] = useState<WarningLevel>('SP1')
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [actionPlan, setActionPlan] = useState('')

  // Hitung status aktif SP dan saran eskalasi untuk staf yang dipilih
  const spStatus = getStaffActiveSpStatus(staffId, existingRecords)

  // Otomatis pilih tingkat SP berikutnya saat staf dipilih
  useEffect(() => {
    if (staffId) {
      setWarningLevel(spStatus.nextSuggestedLevel)
    }
  }, [staffId, spStatus.nextSuggestedLevel])

  // Masa berlaku 3 bulan kalender penuh dari tanggal pelanggaran
  const calculatedExpiryDate = addMonths(incidentDate, 3)

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '—'
    const parts = dStr.split('-')
    if (parts.length !== 3) return dStr
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId || !reason) return

    onSubmit({
      staff_id: staffId,
      warning_level: warningLevel,
      incident_date: incidentDate,
      reason: reason.trim(),
      action_plan: actionPlan.trim() || undefined,
      issued_by: 'HR Manager',
      issued_at: new Date().toISOString(),
      expires_at: calculatedExpiryDate,
      status: 'active',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl space-y-4 animate-in zoom-in-95"
      >
        <div>
          <h3 className="text-base font-extrabold text-suka-brown">Terbitkan Surat Peringatan (SP) / Sanksi</h3>
          <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
            Masa berlaku SP adalah 3 bulan kalender. Pelanggaran berulang dalam 3 bulan akan otomatis dinaikkan tingkatannya.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          {/* 1. Pilih Karyawan */}
          <div>
            <label className={labelClass}>Karyawan Terkait</label>
            <select
              className={inputClass}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              required
            >
              <option value="">— Pilih Karyawan —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.outlets?.name || 'Pusat'} — {s.role})
                </option>
              ))}
            </select>
          </div>

          {/* Banner Riwayat & Rekomendasi Eskalasi SP */}
          {staffId && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                spStatus.activeLevel
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : spStatus.hasExpiredPreviousSp
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-stone-50 border-stone-200 text-stone-800'
              }`}
            >
              {spStatus.activeLevel ? (
                <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                {spStatus.activeLevel ? (
                  <>
                    <p className="font-bold">
                      ⚠️ Karyawan saat ini memiliki sanksi aktif: {spStatus.activeLevel}
                    </p>
                    <p className="text-[11px] opacity-90">
                      Masa berlaku s/d{' '}
                      <span className="font-semibold">
                        {formatDisplayDate(
                          spStatus.activeRecord?.expires_at || spStatus.activeRecord?.expiry_date || ''
                        )}
                      </span>
                      . Karena melanggar lagi dalam periode 3 bulan, tingkat SP otomatis disarankan naik ke{' '}
                      <span className="font-black underline">{spStatus.nextSuggestedLevel}</span>.
                    </p>
                  </>
                ) : spStatus.hasExpiredPreviousSp ? (
                  <>
                    <p className="font-bold">ℹ️ Status SP sebelumnya telah gugur / berakhir</p>
                    <p className="text-[11px] opacity-90">
                      Masa berlaku 3 bulan telah terlewati tanpa pelanggaran aktif. Sanksi baru direset kembali dimulai dari{' '}
                      <span className="font-black text-blue-800">SP1</span>.
                    </p>
                  </>
                ) : (
                  <p className="text-[11px]">
                    Karyawan belum memiliki catatan sanksi aktif. Tingkat SP awal dimulai dari{' '}
                    <span className="font-bold">SP1</span>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 2. Tingkat Peringatan & Tanggal Pelanggaran */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tingkat Peringatan</label>
              <select
                className={inputClass}
                value={warningLevel}
                onChange={(e) => setWarningLevel(e.target.value as WarningLevel)}
              >
                <option value="Teguran Lisan">Teguran Lisan</option>
                <option value="SP1">Surat Peringatan 1 (SP1)</option>
                <option value="SP2">Surat Peringatan 2 (SP2)</option>
                <option value="SP3">Surat Peringatan 3 (SP3 / Terakhir)</option>
                <option value="Skorsing">Skorsing</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Tanggal Pelanggaran</label>
              <input
                type="date"
                className={inputClass}
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Info Masa Berlaku 3 Bulan */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar size={14} className="text-suka-orange" />
              Masa Berlaku Sanksi (3 Bulan Kalender):
            </span>
            <span className="font-bold text-suka-brown font-mono">
              s/d {formatDisplayDate(calculatedExpiryDate)}
            </span>
          </div>

          {/* 3. Deskripsi & Rencana Perbaikan */}
          <div>
            <label className={labelClass}>Deskripsi Pelanggaran / Alasan SP</label>
            <textarea
              rows={3}
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan detail kronologi pelanggaran SOP atau tata tertib..."
              required
            />
          </div>

          <div>
            <label className={labelClass}>Rencana Perbaikan / Tindakan (Action Plan)</label>
            <textarea
              rows={2}
              className={inputClass}
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder="Contoh: Pembinaan shift, evaluasi berkala 1 bulan"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-suka-gray-100">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Batal
          </Button>
          <Button
            type="submit"
            className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
          >
            Terbitkan SP
          </Button>
        </div>
      </form>
    </div>
  )
}
