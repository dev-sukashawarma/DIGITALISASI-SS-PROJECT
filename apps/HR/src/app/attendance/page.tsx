'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { ATTENDANCE_PAGE_SIZE, EMPTY_SUMMARY, useAttendance } from '@/hooks/useAttendance'
import { exportAbsensiExcel } from '@/lib/exportAbsensiExcel'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Pagination } from '@/components/ui/Pagination'
import { todayWib } from '@/lib/dateIso'
import { useOutlets } from '@/hooks/useOutlets'
import { AttendanceFilters } from '@/components/modules/AttendanceFilters'
import { AttendanceTable } from '@/components/modules/AttendanceTable'
import type { AttendanceFilterValues } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = {
  all: 'Semua Status',
  hadir: 'Hadir Tepat Waktu',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  cuti: 'Cuti',
  alfa: 'Alfa',
}

function currentMonthRange(): { from: string; to: string } {
  // Bulan berjalan dalam WIB (bukan zona waktu browser)
  const [y, m] = todayWib().split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

function defaultFilter(): AttendanceFilterValues {
  const { from, to } = currentMonthRange()
  return { dateFrom: from, dateTo: to, outletId: 'all', status: 'all' }
}

export default function AttendancePage() {
  const [filter, setFilterState] = useState<AttendanceFilterValues>(defaultFilter)
  const [search, setSearchState] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  // Tunda query saat mengetik: pencarian dijalankan di database, jadi jangan tiap huruf.
  const debouncedSearch = useDebouncedValue(search, 350)
  const { data, isLoading, isFetching, exportAll } = useAttendance(filter, debouncedSearch, page)
  const { data: outlets = [] } = useOutlets()

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const summary = data?.summary ?? EMPTY_SUMMARY
  const totalPages = Math.max(1, Math.ceil(total / ATTENDANCE_PAGE_SIZE))

  // Filter/pencarian berubah → kembali ke halaman 1
  const setFilter = (v: AttendanceFilterValues) => {
    setFilterState(v)
    setPage(1)
  }
  const setSearch = (v: string) => {
    setSearchState(v)
    setPage(1)
  }

  // Halaman aktif bisa melewati jumlah halaman bila data berkurang (mis. realtime)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleExportExcel = async () => {
    if (total === 0) {
      toast.error('Tidak ada data absensi untuk diexport')
      return
    }
    setExporting(true)
    try {
      // Semua baris sesuai filter aktif (bukan hanya halaman yang tampil)
      const all = await exportAll()
      const outletLabel =
        filter.outletId === 'all' ? 'Semua Outlet' : outlets.find((o) => o.id === filter.outletId)?.name ?? '-'
      await exportAbsensiExcel(all.rows, {
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
        outletLabel,
        statusLabel: STATUS_LABEL[filter.status] ?? 'Semua Status',
        search: debouncedSearch,
      })
      toast.success(`${all.rows.length} catatan absensi berhasil di-export ke Excel`)
    } catch (err) {
      toast.error(`Gagal export: ${err instanceof Error ? err.message : 'kesalahan tak dikenal'}`)
    } finally {
      setExporting(false)
    }
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
            onClick={handleExportExcel}
            disabled={exporting}
            className="rounded-xl border border-suka-gray-200 gap-1.5 font-bold"
          >
            <FileSpreadsheet size={15} /> {exporting ? 'Menyiapkan…' : 'Export Excel'}
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
            <p className="text-2xl font-black text-slate-900">{summary.izin + summary.sakit + summary.cuti}</p>
            <p className="text-xs font-bold text-blue-700 uppercase">Izin / Sakit / Cuti</p>
            <p className="text-[11px] text-blue-700/80 font-semibold">
              {summary.izin} izin · {summary.sakit} sakit · {summary.cuti} cuti
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{summary.alfa}</p>
            <p className="text-xs font-bold text-red-700 uppercase">Alfa (Tidak Hadir)</p>
            <p className="text-[11px] text-red-700/80 font-semibold">Hari kerja tanpa absen &amp; tanpa izin</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <AttendanceFilters
          value={filter}
          onChange={setFilter}
          outlets={outlets}
          search={search}
          onSearchChange={setSearch}
        />
        <span className="text-xs text-suka-gray-500 font-medium">
          Total <strong>{total}</strong> catatan kehadiran
        </span>
      </div>

      {/* Attendance Table */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <AttendanceTable rows={rows} />
          <Pagination page={page} pageSize={ATTENDANCE_PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
