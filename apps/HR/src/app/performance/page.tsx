'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Award, Download, Sparkles, CheckCircle2, Clock } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePerformance } from '@/hooks/usePerformance'
import { useOutlets } from '@/hooks/useOutlets'
import { PerformanceTable } from '@/components/modules/PerformanceTable'
import { formatRupiah } from '@/lib/format'
import { exportCsv } from '@/lib/exportCsv'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function PerformancePage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [outletFilter, setOutletFilter] = useState('all')

  const { data: rows = [], isLoading } = usePerformance(month, year, outletFilter)
  const { data: outlets = [] } = useOutlets()

  // Summary Metrics
  const summary = useMemo(() => {
    if (!rows.length) {
      return { avgScore: 0, gradeACount: 0, avgPunctuality: 0, totalBonus: 0 }
    }

    const totalScore = rows.reduce((acc, r) => acc + r.kpi_score, 0)
    const gradeACount = rows.filter((r) => r.grade === 'A').length
    const totalPunctuality = rows.reduce((acc, r) => acc + r.punctuality_rate, 0)
    const totalBonus = rows.reduce((acc, r) => acc + r.crew_bonus, 0)

    return {
      avgScore: Math.round(totalScore / rows.length),
      gradeACount,
      avgPunctuality: Math.round(totalPunctuality / rows.length),
      totalBonus,
    }
  }, [rows])

  const handleExportCsv = () => {
    if (!rows.length) {
      toast.error('Tidak ada data performa untuk diexport')
      return
    }

    const flat = rows.map((r) => ({
      nama: r.staff_name,
      outlet: r.outlet_name,
      role: r.role,
      periode: r.period,
      hari_kerja: r.total_working_days,
      ketepatan_waktu: `${r.punctuality_rate}%`,
      presensi: `${r.attendance_rate}%`,
      total_telat_menit: r.total_late_minutes,
      bonus_crew: r.crew_bonus,
      skor_kpi: r.kpi_score,
      grade: r.grade,
    }))

    exportCsv(
      flat,
      [
        { key: 'nama', label: 'Nama Karyawan' },
        { key: 'outlet', label: 'Outlet' },
        { key: 'role', label: 'Jabatan' },
        { key: 'periode', label: 'Periode' },
        { key: 'hari_kerja', label: 'Hari Kerja' },
        { key: 'ketepatan_waktu', label: 'Ketepatan Waktu' },
        { key: 'presensi', label: 'Presensi Kehadiran' },
        { key: 'total_telat_menit', label: 'Total Telat (Menit)' },
        { key: 'bonus_crew', label: 'Bonus Crew' },
        { key: 'skor_kpi', label: 'Skor KPI' },
        { key: 'grade', label: 'Grade Evaluasi' },
      ],
      `Evaluasi_KPI_Performa_SukaHR_${MONTHS[month - 1]}_${year}`
    )
    toast.success('Laporan performa KPI berhasil di-export ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evaluasi Performa &amp; KPI Karyawan"
        description="Analisis performa ketepatan waktu, kedisiplinan absensi, evaluasi KPI, dan insentif bonus crew per outlet."
      >
        <Button
          type="button"
          variant="ghost"
          onClick={handleExportCsv}
          className="rounded-xl border border-suka-gray-200 gap-1.5 font-bold"
        >
          <Download size={15} /> Export CSV
        </Button>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center font-bold">
            <Award size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase">Rata-rata Skor KPI</p>
            <p className="text-2xl font-black text-suka-ink mt-0.5">{summary.avgScore} / 100</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase">Karyawan Grade A</p>
            <p className="text-2xl font-black text-emerald-900 mt-0.5">{summary.gradeACount} Staf</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-800 uppercase">Rata-rata Tepat Waktu</p>
            <p className="text-2xl font-black text-blue-900 mt-0.5">{summary.avgPunctuality}%</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-purple-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-purple-800 uppercase">Total Bonus Crew</p>
            <p className="text-xl font-black text-purple-900 mt-0.5">{formatRupiah(summary.totalBonus)}</p>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-suka-orange bg-white text-suka-ink"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-bold font-mono outline-none focus:border-suka-orange bg-white text-suka-ink"
          />
        </div>

        <select
          value={outletFilter}
          onChange={(e) => setOutletFilter(e.target.value)}
          className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-suka-orange bg-white text-suka-ink shadow-xs"
        >
          <option value="all">Semua Outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <PerformanceTable rows={rows} />
      )}
    </div>
  )
}
