'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { useStaff } from '@/hooks/useStaff'
import type { DisciplineRecord, WarningLevel } from '@/lib/types'

interface DisciplineFormModalProps {
  onClose: () => void
  onSubmit: (record: Omit<DisciplineRecord, 'id'>) => void
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function DisciplineFormModal({ onClose, onSubmit }: DisciplineFormModalProps) {
  const { data: staffList = [] } = useStaff()
  const [staffId, setStaffId] = useState('')
  const [warningLevel, setWarningLevel] = useState<WarningLevel>('SP1')
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [actionPlan, setActionPlan] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId || !reason) return

    const expDate = new Date(incidentDate)
    expDate.setDate(expDate.getDate() + 180)

    onSubmit({
      staff_id: staffId,
      warning_level: warningLevel,
      incident_date: incidentDate,
      reason: reason.trim(),
      action_plan: actionPlan.trim() || undefined,
      issued_by: 'HR Manager',
      issued_at: new Date().toISOString(),
      expires_at: expDate.toISOString().split('T')[0],
      status: 'active',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl space-y-4 animate-in zoom-in-95"
      >
        <h3 className="text-base font-extrabold text-suka-brown">Terbitkan Surat Peringatan (SP) / Sanksi</h3>
        <p className="text-xs text-suka-gray-500 font-medium">
          Dokumentasi formal pelanggaran disiplin &amp; tata tertib operasional F&amp;B.
        </p>

        <div className="space-y-3 pt-2">
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
