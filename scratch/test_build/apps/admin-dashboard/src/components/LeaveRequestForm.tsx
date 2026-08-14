'use client'

import { useState, useMemo } from 'react'
import { Button } from '@suka/design-system'
import { useStaff } from '@/hooks/useStaff'

interface LeaveFormValues {
  staff_id: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string
  file?: File | null
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-sm font-semibold text-suka-ink'

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 0
}

export function LeaveRequestForm({
  onSubmit,
  submitting,
  onCancel,
}: {
  onSubmit: (values: LeaveFormValues) => void
  submitting: boolean
  onCancel?: () => void
}) {
  const { data: staffList = [] } = useStaff()
  const [staffId, setStaffId] = useState('')
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const days = useMemo(() => calcDays(startDate, endDate), [startDate, endDate])

  const selectedStaff = useMemo(
    () => staffList.find((s) => s.id === staffId),
    [staffList, staffId],
  )

  const quota = selectedStaff?.leave_quota ?? 0
  const exceedsQuota = days > 0 && days > quota

  const valid = staffId && startDate && endDate && days > 0 && (leaveType !== 'sick' || file !== null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSubmit({
      staff_id: staffId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days,
      reason: reason.trim(),
      file: leaveType === 'sick' ? file : null,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-suka-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      <h3 className="font-bold text-suka-ink text-base">Form Pengajuan Cuti</h3>

      {/* Staff picker */}
      <div>
        <label className={labelClass}>Karyawan</label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className={inputClass}
          required
        >
          <option value="">— Pilih karyawan —</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (sisa kuota: {s.leave_quota ?? 0} hari)
            </option>
          ))}
        </select>
      </div>

      {/* Leave type */}
      <div>
        <label className={labelClass}>Jenis Cuti</label>
        <select
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          className={inputClass}
        >
          <option value="annual">Cuti Tahunan</option>
          <option value="sick">Sakit</option>
          <option value="personal">Izin Pribadi</option>
          <option value="maternity">Cuti Melahirkan</option>
          <option value="other">Lainnya</option>
        </select>
      </div>

      {/* File Upload (Sakit) */}
      {leaveType === 'sick' && (
        <div>
          <label className={labelClass}>Bukti / Surat Sakit <span className="text-red-500">*</span></label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className={inputClass}
            required
          />
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Tanggal Mulai</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Tanggal Selesai</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
            className={inputClass}
            required
          />
        </div>
      </div>

      {/* Duration */}
      {days > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-suka-ink">Durasi:</span>
          <span className="rounded-full bg-suka-cream px-2.5 py-0.5 font-bold text-suka-brown text-xs">
            {days} hari
          </span>
          {exceedsQuota && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-amber-700 text-xs font-semibold">
              ⚠ Melebihi sisa kuota ({quota} hari)
            </span>
          )}
        </div>
      )}

      {/* Reason */}
      <div>
        <label className={labelClass}>Alasan / Keterangan</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Opsional: jelaskan alasan cuti..."
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl">
            Batal
          </Button>
        )}
        <Button type="submit" disabled={!valid || submitting} className="rounded-xl">
          {submitting ? 'Menyimpan...' : 'Ajukan Cuti'}
        </Button>
      </div>
    </form>
  )
}
