'use client'

import { useState } from 'react'
import { Eye, MapPin } from 'lucide-react'
import type { AttendanceLog } from '@/lib/types'
import { formatJamWib } from '@/lib/format'
import { AttendancePhotoModal, type AttendancePhotoInfo } from './AttendancePhotoModal'

export function AttendanceTable({ rows }: { rows: AttendanceLog[] }) {
  const [activePhoto, setActivePhoto] = useState<AttendancePhotoInfo | null>(null)

  const statusBadge = (s: AttendanceLog['status'], lateMinutes: number) => {
    switch (s) {
      case 'hadir':
        return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">Hadir</span>
      case 'terlambat':
        return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">Telat ({lateMinutes} mnt)</span>
      case 'izin':
        return <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">Izin</span>
      case 'sakit':
        return <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">Sakit</span>
      case 'cuti':
        return <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">Cuti</span>
      case 'alfa':
        return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200">Alfa</span>
      default:
        return <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-600">{s}</span>
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nama &amp; Jabatan</th>
                <th className="px-4 py-3.5">Outlet</th>
                <th className="px-4 py-3.5">Tanggal</th>
                <th className="px-4 py-3.5">Clock In</th>
                <th className="px-4 py-3.5">Clock Out</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-center">Foto Selfie</th>
                <th className="px-4 py-3.5 text-center">GPS Map</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-suka-ink text-sm">{r.outlet_staff?.name ?? 'Staf'}</div>
                    <div className="text-xs text-suka-brown font-semibold">{r.outlet_staff?.role?.replace('_', ' ')}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700">{r.outlets?.name ?? 'Pusat'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{r.date}</td>
                  <td className="px-4 py-3 text-xs font-mono font-bold text-gray-800">
                    {formatJamWib(r.clock_in)}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">
                    {formatJamWib(r.clock_out)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(r.status, r.late_minutes)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.photo_url ? (
                      <button
                        onClick={() =>
                          setActivePhoto({
                            url: r.photo_url!,
                            title: `Presensi Masuk: ${r.outlet_staff?.name ?? 'Staf'}`,
                            staffName: r.outlet_staff?.name ?? 'Staf',
                            outletName: r.outlets?.name ?? 'Pusat',
                            timestamp: formatJamWib(r.clock_in),
                            actionType: 'Clock In Selfie',
                            lat: r.lat,
                            lng: r.lng,
                            notes: r.notes || undefined,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold text-amber-900 transition-colors cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Lihat Foto</span>
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.lat && r.lng ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold text-blue-800 transition-colors"
                        title="Buka titik presensi di Google Maps"
                      >
                        <MapPin size={12} />
                        <span>Maps</span>
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                    Tidak ada log absensi yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activePhoto && (
        <AttendancePhotoModal
          photo={activePhoto}
          onClose={() => setActivePhoto(null)}
        />
      )}
    </>
  )
}
