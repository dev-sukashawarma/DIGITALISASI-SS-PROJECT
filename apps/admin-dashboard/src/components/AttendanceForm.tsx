'use client'

import { useEffect, useMemo } from 'react'
import { useStaff } from '@/hooks/useStaff'
import type { AttendanceStatus, StaffRow } from '@/lib/types'
import type { AttendanceFormValues } from '@/hooks/useAttendanceMutations'

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'terlambat', label: 'Terlambat' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'alfa', label: 'Alfa' },
  { value: 'cuti', label: 'Cuti' },
  { value: 'libur', label: 'Libur' },
]

/** Roles that use the evening shift (13:00–22:00) */
const EVENING_ROLES = ['crew', 'kitchen', 'kiosk']

function getShiftForRole(role: string): { start: string; end: string; label: string } {
  if (EVENING_ROLES.includes(role)) {
    return { start: '13:00', end: '22:00', label: 'Siang–Malam (13:00 – 22:00)' }
  }
  return { start: '08:00', end: '17:00', label: 'Pagi–Sore (08:00 – 17:00)' }
}

/**
 * Calculate late minutes by comparing clock_in time against the shift start time.
 * Returns 0 if on time or early.
 */
function calcLateMinutes(clockIn: string, shiftStart: string): number {
  const [ciH, ciM] = clockIn.split(':').map(Number)
  const [ssH, ssM] = shiftStart.split(':').map(Number)
  const diffMin = ciH * 60 + ciM - (ssH * 60 + ssM)
  return diffMin > 0 ? diffMin : 0
}

interface Props {
  onSubmit: (values: AttendanceFormValues) => void
  submitting: boolean
  initial?: Partial<AttendanceFormValues> & { staffRole?: string }
  onCancel?: () => void
}

export function AttendanceForm({ onSubmit, submitting, initial, onCancel }: Props) {
  const { data: staffList = [] } = useStaff()

  // Form state stored individually so shift info reacts to staff selection
  const today = new Date().toISOString().slice(0, 10)

  const defaultValues: AttendanceFormValues = {
    staff_id: initial?.staff_id ?? '',
    outlet_id: initial?.outlet_id ?? '',
    date: initial?.date ?? today,
    clock_in: initial?.clock_in ?? '',
    clock_out: initial?.clock_out ?? '',
    status: initial?.status ?? 'hadir',
    late_minutes: initial?.late_minutes ?? 0,
    notes: initial?.notes ?? '',
  }

  // We use uncontrolled-ish form via a ref-driven approach using a <form> and FormData.
  // But for the reactive shift badge and auto-calculate, we need state for staff_id, clock_in, status.
  const activeStaff = useMemo(
    () => staffList.filter((s) => s.status === 'active'),
    [staffList],
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const staffId = fd.get('staff_id') as string
    const selectedStaff = staffList.find((s) => s.id === staffId)
    const outletId = selectedStaff?.outlet_id ?? (fd.get('outlet_id') as string)
    const clockIn = (fd.get('clock_in') as string) || null
    const clockOut = (fd.get('clock_out') as string) || null
    const status = fd.get('status') as AttendanceStatus
    const notes = (fd.get('notes') as string) || null

    // Auto-calculate late_minutes if status is terlambat
    let lateMinutes = Number(fd.get('late_minutes')) || 0
    if (status === 'terlambat' && clockIn && selectedStaff) {
      const shift = getShiftForRole(selectedStaff.role)
      lateMinutes = calcLateMinutes(clockIn, shift.start)
    }

    onSubmit({
      staff_id: staffId,
      outlet_id: outletId,
      date: fd.get('date') as string,
      clock_in: clockIn,
      clock_out: clockOut,
      status,
      late_minutes: lateMinutes,
      notes,
    })
  }

  const inputCls =
    'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
  const labelCls = 'mb-1 block text-sm font-semibold text-suka-ink'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Staff */}
        <div>
          <label className={labelCls}>Karyawan *</label>
          <select name="staff_id" required className={inputCls} defaultValue={defaultValues.staff_id} id="att-staff">
            <option value="">Pilih karyawan</option>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>
          <ShiftBadge staffList={staffList} />
        </div>

        {/* Hidden outlet_id — auto-filled from selected staff */}
        <input type="hidden" name="outlet_id" value={defaultValues.outlet_id} />

        {/* Date */}
        <div>
          <label className={labelCls}>Tanggal *</label>
          <input type="date" name="date" required className={inputCls} defaultValue={defaultValues.date} />
        </div>

        {/* Clock In */}
        <div>
          <label className={labelCls}>Clock In</label>
          <input type="time" name="clock_in" className={inputCls} defaultValue={defaultValues.clock_in ?? ''} />
        </div>

        {/* Clock Out */}
        <div>
          <label className={labelCls}>Clock Out</label>
          <input type="time" name="clock_out" className={inputCls} defaultValue={defaultValues.clock_out ?? ''} />
        </div>

        {/* Status */}
        <div>
          <label className={labelCls}>Status *</label>
          <select name="status" required className={inputCls} defaultValue={defaultValues.status}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Late Minutes */}
        <div>
          <label className={labelCls}>Terlambat (menit)</label>
          <input
            type="number"
            name="late_minutes"
            min={0}
            className={inputCls}
            defaultValue={defaultValues.late_minutes}
            placeholder="Otomatis jika status terlambat"
          />
          <p className="mt-1 text-xs text-suka-gray-400">
            Dihitung otomatis jika status = Terlambat
          </p>
        </div>

        {/* Notes */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls}>Catatan</label>
          <textarea
            name="notes"
            rows={2}
            className={inputCls + ' resize-none'}
            defaultValue={defaultValues.notes ?? ''}
            placeholder="Keterangan opsional…"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-suka-orange px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-suka-orange/90 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan…' : initial?.staff_id ? 'Simpan Perubahan' : 'Tambah Absensi'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-suka-gray-200 px-5 py-2.5 text-sm font-medium text-suka-gray-500 transition-all hover:bg-suka-gray-50"
          >
            Batal
          </button>
        )}
      </div>
    </form>
  )
}

/* ─── Shift Badge (reactive to select changes) ─────────────────────── */

function ShiftBadge({
  staffList,
}: {
  staffList: StaffRow[]
}) {
  // We read the select element's value on change to show the right shift.
  // Using a small effect to listen for changes on the sibling select.
  useEffect(() => {
    const select = document.getElementById('att-staff') as HTMLSelectElement | null
    const badge = document.getElementById('att-shift-badge')
    if (!select || !badge) return

    function update() {
      const staffId = select!.value
      const staff = staffList.find((s) => s.id === staffId)
      if (!staff) {
        badge!.textContent = ''
        badge!.className = 'hidden'
        return
      }
      const shift = getShiftForRole(staff.role)
      badge!.textContent = `🕐 Shift: ${shift.label}`
      badge!.className =
        'mt-1.5 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700'
    }

    update()
    select.addEventListener('change', update)
    return () => select.removeEventListener('change', update)
  }, [staffList])

  return <div id="att-shift-badge" className="hidden" />
}
