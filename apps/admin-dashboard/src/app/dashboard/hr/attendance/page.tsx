'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarPlus,
  Download,
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
  Sun,
  Moon,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useAttendance } from '@/hooks/useAttendance'
import { useAttendanceMutations } from '@/hooks/useAttendanceMutations'
import type { AttendanceFormValues } from '@/hooks/useAttendanceMutations'
import { AttendanceFilters } from '@/components/AttendanceFilters'
import { AttendanceForm } from '@/components/AttendanceForm'
import { AttendanceTable } from '@/components/AttendanceTable'
import { exportCsv } from '@/lib/exportCsv'
import type { AttendanceLog, AttendanceFilterValues } from '@/lib/types'

export const dynamic = 'force-dynamic'

/* ─── Helpers ───────────────────────────────────────────────────────── */

function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  }
}

const DEFAULT_FILTER: AttendanceFilterValues = {
  dateFrom: currentMonthRange().from,
  dateTo: currentMonthRange().to,
  outletId: '',
  status: 'all',
}

function fmtDateCell(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtTimeCell(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function AttendancePage() {
  const [filter, setFilter] = useState<AttendanceFilterValues>(DEFAULT_FILTER)
  const { data: rows = [], isLoading } = useAttendance(filter)
  const { create, update, remove } = useAttendanceMutations()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AttendanceLog | null>(null)

  /* ── Summary counts ──────────────────────────────────────────────── */
  const summary = useMemo(() => {
    let hadir = 0
    let terlambat = 0
    let izinSakit = 0
    let alfa = 0
    for (const r of rows) {
      switch (r.status) {
        case 'hadir':
          hadir++
          break
        case 'terlambat':
          terlambat++
          break
        case 'izin':
        case 'sakit':
          izinSakit++
          break
        case 'alfa':
          alfa++
          break
      }
    }
    return { hadir, terlambat, izinSakit, alfa }
  }, [rows])

  /* ── CRUD handlers ───────────────────────────────────────────────── */

  function handleCreate(values: AttendanceFormValues) {
    create.mutate(values, {
      onSuccess: () => {
        toast.success('Absensi berhasil ditambahkan')
        setShowForm(false)
      },
      onError: (e: any) => toast.error(e.message ?? 'Gagal menyimpan'),
    })
  }

  function handleUpdate(values: AttendanceFormValues) {
    if (!editing) return
    update.mutate({ id: editing.id, ...values }, {
      onSuccess: () => {
        toast.success('Absensi berhasil diperbarui')
        setEditing(null)
      },
      onError: (e: any) => toast.error(e.message ?? 'Gagal memperbarui'),
    })
  }

  function handleDelete(row: AttendanceLog) {
    const staffName = row.outlet_staff?.name ?? 'data'
    if (!confirm(`Hapus absensi ${staffName} tanggal ${fmtDateCell(row.date)}?`)) return
    remove.mutate(row.id, {
      onSuccess: () => toast.success('Absensi dihapus'),
      onError: (e: any) => toast.error(e.message ?? 'Gagal menghapus'),
    })
  }

  /* ── CSV export ──────────────────────────────────────────────────── */

  function handleExport() {
    if (rows.length === 0) {
      toast.error('Tidak ada data untuk diexport')
      return
    }

    const flat = rows.map((r) => ({
      nama: r.outlet_staff?.name ?? '',
      role: r.outlet_staff?.role ?? '',
      outlet: r.outlets?.name ?? '',
      tanggal: fmtDateCell(r.date),
      clock_in: fmtTimeCell(r.clock_in),
      clock_out: fmtTimeCell(r.clock_out),
      status: r.status,
      terlambat_menit: r.late_minutes,
      catatan: r.notes ?? '',
    }))

    exportCsv(flat, [
      { key: 'nama', label: 'Nama' },
      { key: 'role', label: 'Role' },
      { key: 'outlet', label: 'Outlet' },
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'clock_in', label: 'Clock In' },
      { key: 'clock_out', label: 'Clock Out' },
      { key: 'status', label: 'Status' },
      { key: 'terlambat_menit', label: 'Terlambat (menit)' },
      { key: 'catatan', label: 'Catatan' },
    ], `absensi_${filter.dateFrom}_${filter.dateTo}`)

    toast.success('CSV berhasil didownload')
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-suka-ink">Absensi &amp; Shift</h2>
          <p className="text-sm text-suka-gray-500">
            Rekap kehadiran karyawan &amp; informasi shift kerja.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl border border-suka-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-suka-ink shadow-sm transition-all hover:bg-suka-gray-50"
          >
            <Download size={16} />
            Export CSV
          </button>
          <Button
            onClick={() => {
              setEditing(null)
              setShowForm((v) => !v)
            }}
            className="flex items-center gap-2 rounded-xl"
          >
            <CalendarPlus size={18} />
            Tambah Absensi
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Hadir"
          count={summary.hadir}
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-600"
          border="border-emerald-200"
        />
        <SummaryCard
          label="Terlambat"
          count={summary.terlambat}
          icon={Clock}
          color="bg-amber-50 text-amber-600"
          border="border-amber-200"
        />
        <SummaryCard
          label="Izin / Sakit"
          count={summary.izinSakit}
          icon={ShieldAlert}
          color="bg-blue-50 text-blue-600"
          border="border-blue-200"
        />
        <SummaryCard
          label="Alfa"
          count={summary.alfa}
          icon={XCircle}
          color="bg-red-50 text-red-600"
          border="border-red-200"
        />
      </div>

      {/* ── Shift Info Panel ────────────────────────────────────────── */}
      {/* (Dihapus sesuai permintaan user) */}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <AttendanceFilters value={filter} onChange={setFilter} defaultValue={DEFAULT_FILTER} />

      {/* ── Create Form ─────────────────────────────────────────────── */}
      {showForm && !editing && (
        <div className="rounded-2xl border-2 border-suka-orange/40 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Form Absensi Baru</h3>
          <AttendanceForm
            onSubmit={handleCreate}
            submitting={create.isPending}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* ── Edit Form ───────────────────────────────────────────────── */}
      {editing && (
        <div className="rounded-2xl border-2 border-blue-300 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">
            Edit Absensi — {editing.outlet_staff?.name ?? ''}
          </h3>
          <AttendanceForm
            onSubmit={handleUpdate}
            submitting={update.isPending}
            initial={{
              staff_id: editing.staff_id,
              outlet_id: editing.outlet_id,
              date: editing.date,
              clock_in: editing.clock_in ?? '',
              clock_out: editing.clock_out ?? '',
              status: editing.status,
              late_minutes: editing.late_minutes,
              notes: editing.notes ?? '',
              staffRole: editing.outlet_staff?.role,
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      <AttendanceTable
        rows={rows}
        onEdit={(row) => {
          setShowForm(false)
          setEditing(row)
        }}
        onDelete={handleDelete}
      />
    </div>
  )
}

/* ─── Summary Card ──────────────────────────────────────────────────── */

function SummaryCard({
  label,
  count,
  icon: Icon,
  color,
  border,
}: {
  label: string
  count: number
  icon: React.ElementType
  color: string
  border: string
}) {
  return (
    <div className={`rounded-xl border ${border} bg-white p-4 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-suka-ink">{count}</p>
          <p className="text-xs text-suka-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}
