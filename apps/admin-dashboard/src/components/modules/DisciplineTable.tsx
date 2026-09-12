'use client'

import { CheckCircle2 } from 'lucide-react'
import type { DisciplineRecord, WarningLevel } from '@/lib/types'

const LEVEL_BADGES: Record<WarningLevel, { bg: string; text: string; border: string }> = {
  'Teguran': { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' },
  'Teguran Lisan': { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' },
  'SP1': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'SP2': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'SP3': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Skorsing': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

export function DisciplineTable({
  rows,
  onResolve,
}: {
  rows: DisciplineRecord[]
  onResolve: (id: string) => void
}) {
  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    } catch {
      return iso
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3.5">Nama &amp; Outlet</th>
              <th className="px-4 py-3.5">Tingkat SP</th>
              <th className="px-4 py-3.5">Tgl Pelanggaran</th>
              <th className="px-4 py-3.5">Alasan / Kronologi</th>
              <th className="px-4 py-3.5">Rencana Perbaikan</th>
              <th className="px-4 py-3.5">Berlaku Sampai</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {rows.map((r) => {
              const badge = LEVEL_BADGES[r.warning_level] || LEVEL_BADGES.SP1
              return (
                <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-suka-ink text-sm">{r.outlet_staff?.name || 'Staff'}</div>
                    <div className="text-xs text-suka-brown font-semibold">
                      {r.outlet_staff?.outlets?.name || 'Pusat'} &bull; {r.outlet_staff?.role?.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {r.warning_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">
                    {fmtDate(r.incident_date || r.issue_date)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-[220px]">
                    <p className="font-medium truncate" title={r.reason}>
                      {r.reason}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                    {r.action_plan || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">
                    {fmtDate(r.expires_at || r.expiry_date)}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={11} /> Selesai
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'active' && (
                      <button
                        onClick={() => onResolve(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-2xs hover:bg-emerald-100 transition-all cursor-pointer"
                        title="Tandai Selesai / Masa Sanksi Habis"
                      >
                        <CheckCircle2 size={13} />
                        <span>Selesai</span>
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                  Tidak ada catatan Surat Peringatan (SP) atau pelanggaran disiplin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
