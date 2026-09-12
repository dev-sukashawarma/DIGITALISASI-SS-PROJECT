'use client'

import type { PerformanceRecord } from '@/lib/types'
import { formatRupiah } from '@/lib/format'

const GRADE_BADGES: Record<'A' | 'B' | 'C' | 'D', { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  B: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  C: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  D: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

export function PerformanceTable({ rows }: { rows: PerformanceRecord[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3.5">Nama Karyawan</th>
              <th className="px-4 py-3.5">Outlet &amp; Jabatan</th>
              <th className="px-4 py-3.5 text-center">Hari Kerja</th>
              <th className="px-4 py-3.5 text-center">Ketepatan Waktu</th>
              <th className="px-4 py-3.5 text-center">Presensi (%)</th>
              <th className="px-4 py-3.5 text-right">Total Telat</th>
              <th className="px-4 py-3.5 text-right">Bonus Crew</th>
              <th className="px-4 py-3.5 text-center">Nilai KPI</th>
              <th className="px-4 py-3.5 text-center">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {rows.map((r) => {
              const gradeCfg = GRADE_BADGES[r.grade] || GRADE_BADGES.C
              return (
                <tr key={r.staff_id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-suka-ink text-sm">
                    {r.staff_name}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold text-suka-ink">{r.outlet_name}</div>
                    <div className="text-[11px] font-semibold text-suka-brown uppercase">
                      {r.role}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-mono font-bold text-gray-700">
                    {r.total_working_days} Hari
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold ${
                        r.punctuality_rate >= 90
                          ? 'bg-emerald-50 text-emerald-700'
                          : r.punctuality_rate >= 75
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {r.punctuality_rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-mono font-bold text-gray-700">
                    {r.attendance_rate}%
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-gray-700">
                    {r.total_late_minutes > 0 ? (
                      <span className="text-amber-700 font-bold">{r.total_late_minutes} mnt</span>
                    ) : (
                      '0 mnt'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono font-bold text-emerald-700">
                    {r.crew_bonus > 0 ? formatRupiah(r.crew_bonus) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-mono font-black text-suka-brown">
                    {r.kpi_score} / 100
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs border ${gradeCfg.bg} ${gradeCfg.text} ${gradeCfg.border}`}
                    >
                      {r.grade}
                    </span>
                  </td>
                </tr>
              )
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                  Tidak ada data performa karyawan untuk periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
