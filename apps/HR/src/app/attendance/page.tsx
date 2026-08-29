'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Download, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAttendance } from '@/hooks/useAttendance'
import { useOutlets } from '@/hooks/useOutlets'
import { AttendanceFilters } from '@/components/modules/AttendanceFilters'
import { AttendanceTable } from '@/components/modules/AttendanceTable'
import { exportCsv } from '@/lib/exportCsv'
import type { AttendanceFilterValues } from '@/lib/types'

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
  outletId: 'all',
  status: 'all',
}

export default function AttendancePage() {
  const [filter, setFilter] = useState<AttendanceFilterValues>(DEFAULT_FILTER)
  const { data: rows = [], isLoading } = useAttendance(filter)
  const { data: outlets = [] } = useOutlets()

  // Summary Metrics
  const summary = useMemo(() => {
    let hadir = 0
    let terlambat = 0
    let izinSakit = 0
    let alfa = 0

    for (const r of rows) {
      if (r.status === 'hadir') hadir++
      else if (r.status === 'terlambat') terlambat++
      else if (r.status === 'izin' || r.status === 'sakit' || r.status === 'cuti') izinSakit++
      else if (r.status === 'alfa') alfa++
    }

    return { hadir, terlambat, izinSakit, alfa, total: rows.length }
  }, [rows])

  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast.error('Tidak ada data absensi untuk diexport')
      return
    }

    const flat = rows.map((r) => ({
      nama: r.outlet_staff?.name ?? '',
      role: r.outlet_staff?.role ?? '',
      outlet: r.outlets?.name ?? '',
      tanggal: r.date,
      clock_in: r.clock_in ? new Date(r.clock_in).toLocaleTimeString('id-ID') : '—',
      clock_out: r.clock_out ? new Date(r.clock_out).toLocaleTimeString('id-ID') : '—',
      status: r.status,
      terlambat_menit: r.late_minutes,
      ada_foto: r.photo_url ? 'Ya' : 'Tidak',
      gps_lat: r.lat || '',
      gps_lng: r.lng || '',
      catatan: r.notes ?? '',
    }))

    exportCsv(
      flat,
      [
        { key: 'nama', label: 'Nama Staf' },
        { key: 'role', label: 'Jabatan' },
        { key: 'outlet', label: 'Outlet' },
        { key: 'tanggal', label: 'Tanggal' },
        { key: 'clock_in', label: 'Clock In' },
        { key: 'clock_out', label: 'Clock Out' },
        { key: 'status', label: 'Status Kehadiran' },
        { key: 'terlambat_menit', label: 'Terlambat (Menit)' },
        { key: 'ada_foto', label: 'Verifikasi Selfie' },
        { key: 'gps_lat', label: 'Latitude' },
        { key: 'gps_lng', label: 'Longitude' },
        { key: 'catatan', label: 'Catatan' },
      ],
      `Rekap_Absensi_SukaHR_${filter.dateFrom}_sd_${filter.dateTo}`
    )
    toast.success('Rekap absensi berhasil di-export ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi &amp; Verifikasi Selfie GPS"
        description="Audit kehadiran karyawan harian, jepretan kamera sistem, dan radius koordinat outlet."
      >
        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Realtime</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={handleExportCsv}
            className="rounded-xl border border-suka-gray-200 gap-1.5 font-bold"
          >
            <Download size={15} /> Export CSV
          </Button>
        </div>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{summary.hadir}</p>
            <p className="text-xs font-bold text-emerald-700 uppercase">Tepat Waktu</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{summary.terlambat}</p>
            <p className="text-xs font-bold text-amber-700 uppercase">Terlambat</p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{summary.izinSakit}</p>
            <p className="text-xs font-bold text-blue-700 uppercase">Izin / Sakit</p>
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{summary.alfa}</p>
            <p className="text-xs font-bold text-red-700 uppercase">Alfa</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <AttendanceFilters value={filter} onChange={setFilter} outlets={outlets} />
        <span className="text-xs text-suka-gray-500 font-medium">
          Total <strong>{rows.length}</strong> catatan kehadiran
        </span>
      </div>

      {/* Attendance Table */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <AttendanceTable rows={rows} />
      )}
    </div>
  )
}
