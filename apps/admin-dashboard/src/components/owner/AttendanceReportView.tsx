// @ts-nocheck
'use client'

import React, { useState, useMemo } from 'react'
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
  Search,
  Camera,
  Building2,
  UserCheck,
  ImageOff,
  LogOut
} from 'lucide-react'
import type { Outlet } from '@/lib/types'
import { StealthPhotoModal, type StealthPhotoInfo } from './StealthPhotoModal'

export interface AttendanceRecordExt {
  id: string
  staff_id: string
  staff_name: string
  staff_role: string
  outlet_id: string
  outlet_name: string
  date: string
  clock_in: string | null
  clock_out: string | null
  status: 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa' | 'cuti' | string
  late_minutes: number
  out_status?: string | null
  out_minutes?: number | null
  notes: string | null
  stealth_photo_in_url?: string | null
  stealth_photo_out_url?: string | null
}

interface AttendanceReportViewProps {
  outlets: Outlet[]
  records: AttendanceRecordExt[]
  selectedOutletId: string
  onOutletChange: (outletId: string) => void
  dateFrom: string
  dateTo: string
}

export function AttendanceReportView({
  outlets,
  records,
  selectedOutletId,
  onOutletChange,
  dateFrom,
  dateTo,
}: AttendanceReportViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activePhoto, setActivePhoto] = useState<StealthPhotoInfo | null>(null)

  // Filtered records
  const filteredData = useMemo(() => {
    return records.filter((r) => {
      // Filter Outlet
      if (selectedOutletId !== 'all' && r.outlet_id !== selectedOutletId) {
        return false
      }
      // Filter Status
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = r.staff_name.toLowerCase().includes(q)
        const matchRole = r.staff_role.toLowerCase().includes(q)
        const matchOutlet = r.outlet_name.toLowerCase().includes(q)
        const matchNotes = r.notes?.toLowerCase().includes(q) ?? false
        if (!matchName && !matchRole && !matchOutlet && !matchNotes) {
          return false
        }
      }
      return true
    })
  }, [records, selectedOutletId, statusFilter, searchQuery])

  // Summary Metrics
  const summary = useMemo(() => {
    let hadir = 0
    let terlambat = 0
    let izinSakit = 0
    let alfa = 0
    for (const r of filteredData) {
      if (r.status === 'hadir') hadir++
      else if (r.status === 'terlambat') terlambat++
      else if (['izin', 'sakit', 'cuti'].includes(r.status)) izinSakit++
      else if (r.status === 'alfa') alfa++
    }
    return { hadir, terlambat, izinSakit, alfa, total: filteredData.length }
  }, [filteredData])

  const formatDate = (iso: string) => {
    try {
      const [y, m, d] = iso.split('-')
      return `${d}/${m}/${y}`
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Summary KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums text-slate-900">{summary.hadir}</p>
              <p className="text-xs font-semibold text-emerald-700">Hadir Tepat Waktu</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums text-slate-900">{summary.terlambat}</p>
              <p className="text-xs font-semibold text-amber-700">Terlambat Shift</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-200">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums text-slate-900">{summary.izinSakit}</p>
              <p className="text-xs font-semibold text-blue-700">Izin / Sakit / Cuti</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 border border-red-200">
              <XCircle size={20} />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums text-slate-900">{summary.alfa}</p>
              <p className="text-xs font-semibold text-red-700">Alfa / Tanpa Keterangan</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table Bar Quick Filters & Actions ───────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Status Kehadiran Dropdown */}
          <div className="relative">
            <UserCheck size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-suka-orange focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Status Kehadiran</option>
              <option value="hadir">Hadir Tepat Waktu</option>
              <option value="terlambat">Terlambat</option>
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
              <option value="alfa">Alfa</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama karyawan / catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-suka-orange focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── Table Log Absensi ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Nama &amp; Role Karyawan</th>
                <th className="p-3.5">Outlet &amp; Tanggal</th>
                <th className="p-3.5 text-center">Jam Masuk &amp; Foto Kamera</th>
                <th className="p-3.5 text-center">Jam Pulang &amp; Foto Kamera</th>
                <th className="p-3.5">Status Masuk</th>
                <th className="p-3.5">Status Pulang &amp; Durasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Tidak ada rekap absensi yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Nama & Role */}
                    <td className="p-3.5">
                      <div className="font-extrabold text-slate-900">{row.staff_name}</div>
                      <div className="text-[10px] uppercase font-bold text-suka-orange">
                        {row.staff_role}
                      </div>
                    </td>

                    {/* Outlet & Tanggal */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{formatDate(row.date)}</div>
                      <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                        <Building2 size={12} className="text-suka-orange" />
                        {row.outlet_name}
                      </div>
                    </td>

                    {/* Jam Masuk & Foto Kamera */}
                    <td className="p-3.5 text-center">
                      <div className="font-mono font-bold text-slate-800 text-sm">
                        {row.clock_in ? row.clock_in.slice(0, 5) : '-'}
                      </div>
                      {row.stealth_photo_in_url ? (
                        <button
                          onClick={() =>
                            setActivePhoto({
                              url: row.stealth_photo_in_url!,
                              title: `Foto Presensi Masuk - ${row.staff_name}`,
                              timestamp: `${formatDate(row.date)} Jam ${row.clock_in ? row.clock_in.slice(0, 5) : ''} WIB`,
                              staffName: row.staff_name,
                              outletName: row.outlet_name,
                              actionType: 'Presensi Masuk (Awal Shift)',
                              notes: row.notes ?? undefined,
                            })
                          }
                          className="mt-1 relative inline-block overflow-hidden rounded-xl border-2 border-emerald-500 shadow-sm hover:scale-105 transition-transform group"
                        >
                          <img
                            src={row.stealth_photo_in_url}
                            alt="Foto Presensi Masuk"
                            className="h-10 w-10 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={12} />
                          </div>
                          <span className="absolute bottom-0 right-0 bg-emerald-600 px-1 py-0.2 text-[7px] text-white font-extrabold uppercase">
                            MASUK
                          </span>
                        </button>
                      ) : (
                        <div className="mt-1 flex flex-col items-center justify-center text-slate-400">
                          <ImageOff size={14} />
                          <span className="text-[9px] font-semibold italic text-slate-400 mt-0.5">Tanpa Foto Masuk</span>
                        </div>
                      )}
                    </td>

                    {/* Jam Pulang & Foto Kamera */}
                    <td className="p-3.5 text-center">
                      <div className="font-mono font-bold text-slate-800 text-sm">
                        {row.clock_out ? row.clock_out.slice(0, 5) : '-'}
                      </div>
                      {row.stealth_photo_out_url ? (
                        <button
                          onClick={() =>
                            setActivePhoto({
                              url: row.stealth_photo_out_url!,
                              title: `Foto Presensi Pulang - ${row.staff_name}`,
                              timestamp: `${formatDate(row.date)} Jam ${row.clock_out ? row.clock_out.slice(0, 5) : ''} WIB`,
                              staffName: row.staff_name,
                              outletName: row.outlet_name,
                              actionType: 'Presensi Pulang (Selesai Shift)',
                              notes: row.notes ?? undefined,
                            })
                          }
                          className="mt-1 relative inline-block overflow-hidden rounded-xl border-2 border-blue-500 shadow-sm hover:scale-105 transition-transform group"
                        >
                          <img
                            src={row.stealth_photo_out_url}
                            alt="Foto Presensi Pulang"
                            className="h-10 w-10 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={12} />
                          </div>
                          <span className="absolute bottom-0 right-0 bg-blue-600 px-1 py-0.2 text-[7px] text-white font-extrabold uppercase">
                            PULANG
                          </span>
                        </button>
                      ) : (
                        <div className="mt-1 flex flex-col items-center justify-center text-slate-400">
                          <ImageOff size={14} />
                          <span className="text-[9px] font-semibold italic text-slate-400 mt-0.5">Tanpa Foto Pulang</span>
                        </div>
                      )}
                    </td>

                    {/* Status Masuk */}
                    <td className="p-3.5">
                      {row.status === 'hadir' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                          <CheckCircle2 size={12} /> Hadir
                        </span>
                      )}
                      {row.status === 'terlambat' && (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 border border-amber-300">
                            <Clock size={12} /> Terlambat
                          </span>
                          <p className="text-[11px] font-bold text-amber-700">
                            + {row.late_minutes} menit
                          </p>
                        </div>
                      )}
                      {['izin', 'sakit', 'cuti'].includes(row.status) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800 border border-blue-300 uppercase">
                          <ShieldAlert size={12} /> {row.status}
                        </span>
                      )}
                      {row.status === 'alfa' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-800 border border-red-300">
                          <XCircle size={12} /> Alfa
                        </span>
                      )}
                    </td>

                    {/* Status Pulang & Durasi */}
                    <td className="p-3.5">
                      {row.clock_out ? (
                        <div className="space-y-1">
                          {row.out_status === 'pulang_telat' && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-300">
                                <Clock size={11} /> Pulang Telat (+{row.out_minutes ?? 0} m)
                              </span>
                              <p className="text-[10px] font-bold text-slate-500">
                                Jam {row.clock_out.slice(0, 5)} WIB
                              </p>
                            </>
                          )}
                          {row.out_status === 'lebih_awal' && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-800 border border-blue-300">
                                <LogOut size={11} /> Pulang Cepet (-{row.out_minutes ?? 0} m)
                              </span>
                              <p className="text-[10px] font-bold text-slate-500">
                                Jam {row.clock_out.slice(0, 5)} WIB
                              </p>
                            </>
                          )}
                          {(row.out_status === 'tepat' || (!row.out_status && (!row.out_minutes || row.out_minutes === 0))) && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-300">
                                <CheckCircle2 size={11} /> Pulang Tepat Waktu
                              </span>
                              <p className="text-[10px] font-bold text-slate-500">
                                Jam {row.clock_out.slice(0, 5)} WIB
                              </p>
                            </>
                          )}
                        </div>
                      ) : row.notes ? (
                        <span className="text-slate-600 text-[11px] font-medium max-w-xs block">{row.notes}</span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-medium">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox Modal */}
      <StealthPhotoModal photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </div>
  )
}

