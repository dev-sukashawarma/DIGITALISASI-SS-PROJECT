'use client'

import { useState, useMemo } from 'react'
import {
  ArrowRight,
  ShieldCheck,
  Ban,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  User,
  ShieldAlert,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import type { EmergencyCrewAssignment } from '@/lib/types'
import { useEmergencyMutations } from '@/hooks/useEmergencyBackup'
import { toast } from 'sonner'

interface EmergencyTableProps {
  assignments: EmergencyCrewAssignment[]
  isLoading: boolean
  onOpenCreateModal: () => void
}

function formatDateIndo(dateStr: string) {
  try {
    const date = new Date(`${dateStr}T00:00:00+07:00`)
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}

function formatTime(isoStr?: string | null) {
  if (!isoStr) return '-'
  try {
    const date = new Date(isoStr)
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB'
  } catch {
    return '-'
  }
}

export function EmergencyTable({ assignments, isLoading, onOpenCreateModal }: EmergencyTableProps) {
  const todayWib = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
    []
  )

  const { cancel } = useEmergencyMutations()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  const handleCancelAssignment = async (id: string, staffName: string) => {
    try {
      setCancellingId(id)
      await cancel.mutateAsync(id)
      toast.success(`Penugasan BKO darurat untuk ${staffName} berhasil dibatalkan`)
      setConfirmCancelId(null)
    } catch (err: any) {
      toast.error(err.message || 'Gagal membatalkan penugasan darurat')
    } finally {
      setCancellingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-suka-gray-100 bg-white p-12 text-center shadow-xs">
        <div className="flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs font-semibold text-suka-gray-400">
            Memuat data penugasan darurat kru...
          </p>
        </div>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-suka-gray-100 bg-white p-12 text-center shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange mx-auto mb-3">
          <ShieldCheck size={28} />
        </div>
        <h4 className="text-base font-extrabold text-[#4A1713]">
          Tidak Ada Penugasan BKO Darurat
        </h4>
        <p className="text-xs text-suka-gray-500 max-w-sm mx-auto mt-1 mb-5">
          Seluruh kru reguler bertugas sesuai Home Outlet masing-masing atau tidak ada data yang cocok dengan filter yang dipilih.
        </p>
        <Button
          onClick={onOpenCreateModal}
          className="bg-suka-orange text-white hover:bg-suka-orange/90 text-xs font-bold gap-2 mx-auto"
        >
          + Buat Penugasan Darurat Baru
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-suka-gray-100 bg-white shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-suka-gray-100 bg-[#FAF7F2] text-[#4A1713] uppercase tracking-wider text-[10px] font-black">
              <th className="py-3.5 px-4">Tanggal Penugasan</th>
              <th className="py-3.5 px-4">Kru Reguler</th>
              <th className="py-3.5 px-4">Rute Perbantuan (BKO)</th>
              <th className="py-3.5 px-4">Presensi di Lokasi BKO</th>
              <th className="py-3.5 px-4">Alasan & Pembuat</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            {assignments.map((item) => {
              const isToday = item.assignment_date === todayWib
              const isPast = item.assignment_date < todayWib
              const hasAttended = Boolean(item.today_attendance?.has_attended)

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-suka-gray-50/70 transition-colors ${
                    item.status === 'cancelled'
                      ? 'bg-suka-gray-50/40 opacity-70'
                      : isToday
                      ? 'bg-amber-50/15'
                      : ''
                  }`}
                >
                  {/* Tanggal Penugasan */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-suka-orange shrink-0" />
                      <div>
                        <div className="font-extrabold text-[#4A1713]">
                          {formatDateIndo(item.assignment_date)}
                        </div>
                        {isToday && (
                          <span className="inline-block mt-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500 text-white">
                            Hari Ini
                          </span>
                        )}
                        {isPast && item.status !== 'cancelled' && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-suka-gray-100 text-suka-gray-500">
                            Selesai
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Kru Reguler */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-suka-orange/15 text-suka-orange font-black flex items-center justify-center text-xs shrink-0">
                        {item.staff?.name ? item.staff.name.charAt(0).toUpperCase() : 'K'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#4A1713] truncate">
                          {item.staff?.name || 'Karyawan'}
                        </div>
                        <div className="text-[10px] text-suka-gray-400 flex items-center gap-1.5">
                          <span className="bg-suka-gray-100 text-suka-gray-600 px-1 rounded font-semibold">
                            Kru Reguler
                          </span>
                          {item.staff?.phone && <span>{item.staff.phone}</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Rute Perbantuan BKO */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <div className="bg-suka-gray-100 text-suka-gray-700 px-2 py-1 rounded-lg text-[11px] font-semibold truncate max-w-[120px]">
                        {item.origin_outlet?.name || 'Home Outlet'}
                      </div>
                      <ArrowRight size={13} className="text-suka-orange shrink-0" />
                      <div className="bg-amber-100/90 text-amber-900 border border-amber-300/60 px-2 py-1 rounded-lg text-[11px] font-extrabold truncate max-w-[140px]">
                        {item.target_outlet?.name || 'Outlet BKO'}
                      </div>
                    </div>
                  </td>

                  {/* Presensi di Lokasi BKO */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.status === 'cancelled' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-suka-gray-100 text-suka-gray-500">
                        <Ban size={11} /> Dibatalkan
                      </span>
                    ) : hasAttended ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Hadir di Lokasi BKO
                        </span>
                        <div className="text-[10px] text-suka-gray-500 pl-1">
                          Masuk: {formatTime(item.today_attendance?.first_in)}
                        </div>
                      </div>
                    ) : isToday ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                        <Clock size={11} className="text-amber-600" />
                        Menunggu Absen Kiosk
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-suka-gray-100 text-suka-gray-500">
                        <AlertCircle size={11} />
                        Tidak Tercatat Absen
                      </span>
                    )}
                  </td>

                  {/* Alasan & Pembuat */}
                  <td className="py-3 px-4 max-w-[180px]">
                    <div className="text-[11px] text-[#4A1713] truncate font-medium">
                      {item.reason || '-'}
                    </div>
                    <div className="text-[10px] text-suka-gray-400 mt-0.5 truncate">
                      Oleh: {item.assigned_by_staff?.name || 'Admin'}
                    </div>
                  </td>

                  {/* Status Penugasan */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {item.status === 'active' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                        Aktif
                      </span>
                    ) : item.status === 'completed' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-suka-gray-100 text-suka-gray-600">
                        Selesai
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        Dibatalkan
                      </span>
                    )}
                  </td>

                  {/* Aksi */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {item.status === 'active' && (
                      <>
                        {confirmCancelId === item.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] text-red-600 font-bold">Yakin?</span>
                            <button
                              type="button"
                              onClick={() => handleCancelAssignment(item.id, item.staff?.name || '')}
                              disabled={cancellingId === item.id}
                              className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black hover:bg-red-700 transition-colors"
                            >
                              {cancellingId === item.id ? '...' : 'Ya'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(null)}
                              className="px-2 py-1 rounded-lg bg-suka-gray-100 text-suka-gray-600 text-[10px] font-bold hover:bg-suka-gray-200 transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(item.id)}
                            className="text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 font-semibold transition-colors"
                          >
                            Batalkan BKO
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
